// <reference path='./typing/jquery-exists.d.ts'/>

import { PlaybackManager } from './playback'

import * as Tone from 'tone'
import { Piano as PianoType } from '@tonejs/piano'
import * as log from 'loglevel'
import { Midi, Track } from '@tonejs/midi'
import { Note as MidiNote } from '@tonejs/midi/src/Note'
import WebMidi from 'webmidi'
import $ from 'jquery'

import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import * as Chord from './chord'
import { BPMControl } from './numberControl'
import { SheetLocator } from './locator'

$.fn.exists = function () {
  return this.length !== 0
}

export default class MidiSheetPlaybackManager extends PlaybackManager {
  private getPlayNoteByMidiChannel(
    midiChannel: number,
    useChordsInstruments = false
  ) {
    let getCurrentInstrument = Instruments.getCurrentInstrument
    if (useChordsInstruments) {
      getCurrentInstrument = Instruments.getCurrentChordsInstrument
    }
    const getTimingOffset = () => {
      // https://github.com/Tonejs/Tone.js/issues/805#issuecomment-748172477
      return WebMidi.time - this.transport.context.currentTime * 1000
    }

    const timingOffset = getTimingOffset()
    function playNote(time: number, event: Track.Note) {
      const currentInstrument = getCurrentInstrument(midiChannel)
      if (currentInstrument != null) {
        if ('keyUp' in currentInstrument) {
          currentInstrument.keyDown({
            note: event.name,
            time: time,
            velocity: event.velocity,
          })
          currentInstrument.keyUp({
            note: event.name,
            time: time + event.duration,
          })
        } else if ('triggerAttackRelease' in currentInstrument) {
          currentInstrument.triggerAttackRelease(
            event.name,
            event.duration,
            time,
            event.velocity
          )
        }
        log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event))
      }

      MidiOut.getOutput().then(
        (currentMidiOutput) => {
          if (currentMidiOutput) {
            currentMidiOutput.playNote(event.name, midiChannel, {
              time: time * 1000 + timingOffset,
              duration: event.duration * 1000,
            })
          }
        },
        (reason) => {
          log.error('Failed to retrieve current Midi Output with error: ')
          log.error(reason)
        }
      )
    }

    return playNote
  }

  protected quartersProgress(): number {
    const [currentBar, currentQuarter] = this.transport.position
      .toString()
      .split(':')
      .map((value) => Math.floor(parseFloat(value)))
      .slice(0, 2)

    // FIXME assumes a constant Time Signature of 4/4
    const currentStep: number = 4 * currentBar + currentQuarter // % sequenceDuration_quarters
    return currentStep
  }

  // Return the time in seconds between beats
  get interbeatTime_s(): number {
    const currentBPM: number = this.transport.bpm.value
    const interbeatTime_s = 60 / currentBPM
    return interbeatTime_s
  }

  protected midiParts_A = new Map<number, Tone.Part<MidiNote>>()
  protected midiParts_B = new Map<number, Tone.Part<MidiNote>>()
  protected get midiParts(): Map<number, Tone.Part<MidiNote>>[] {
    return [this.midiParts_A, this.midiParts_B]
  }

  protected getPlayingMidiParts(): Map<number, Tone.Part<MidiNote>> {
    if (this.midiParts_B.size == 0) {
      return this.midiParts_A
    } else {
      if (Array.from(this.midiParts_A.values())[0].mute) {
        return this.midiParts_B
      } else {
        return this.midiParts_A
      }
    }
  }

  protected getNextMidiParts(): Map<number, Tone.Part<MidiNote>> {
    if (this.midiParts_A.size == 0) {
      return this.midiParts_A
    } else {
      if (Array.from(this.midiParts_A.values())[0].mute) {
        return this.midiParts_A
      } else {
        return this.midiParts_B
      }
    }
  }

  protected switchTracks(): void {
    const playing = this.getPlayingMidiParts()
    const next = this.getNextMidiParts()
    next.forEach((part) => {
      part.mute = false
    })
    if (playing != next) {
      playing.forEach((part) => {
        part.mute = true
      })
    }
  }

  public scheduleTrackToInstrument(
    sequenceDuration_toneTime: Tone.TimeClass,
    midiTrack: Track,
    midiChannel = 1
  ) {
    const notes: MidiNote[] = midiTrack.notes

    const playNote_callback = this.getPlayNoteByMidiChannel(midiChannel)

    let part = this.getNextMidiParts().get(midiChannel)
    if (part == undefined) {
      log.debug('Creating new part')
      part = new Tone.Part<MidiNote>(playNote_callback, notes)
      part.mute = true

      part.start(0) // schedule events on the Tone timeline
      part.loop = true
      part.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()
      this.getNextMidiParts().set(midiChannel, part)
    } else {
      part.mute = true
      part.clear()
      notes.forEach((note) => {
        part.add(note)
      })
      part.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()
    }

    // FIXME(theis, 2021/05/28): re-enable this!
    console.log('FIXME: Schedule the pedal!')
    return

    // schedule the pedal
    const sustain = new Tone.Part((time, event) => {
      const currentInstrument = Instruments.getCurrentInstrument()
      if ('pedalUp' in currentInstrument) {
        if (event.value) {
          currentInstrument.pedalDown({ time: time })
        } else {
          currentInstrument.pedalUp({ time: time })
        }
      }
    }, midiTrack.controlChanges[64]).start(0)

    log.trace('Midi track content')
    log.trace(midiTrack.notes)

    // set correct loop points for all tracks and activate infinite looping
    for (const part of [sustain]) {
      part.loop = true
      part.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()

      // add the part to the array of currently scheduled parts
      this.getNextMidiParts().set(midiChannel + 1000, part)
    }
  }

  private midiRequestWithData(
    url: string,
    data?: Document | BodyInit,
    method = 'GET'
  ): Promise<[Midi, string]> {
    return new Promise<[Midi, string]>((success, fail) => {
      const request = new XMLHttpRequest()
      request.open(method, url)
      request.responseType = 'arraybuffer'
      // decode asynchronously
      request.addEventListener(
        'load',
        () => {
          if (request.readyState === 4 && request.status === 200) {
            const blob = new Blob([request.response], { type: 'audio/x-midi' })
            const blobURL: string = URL.createObjectURL(blob)
            success([new Midi(request.response), blobURL])
          } else {
            fail(request.status)
          }
        },
        { once: true }
      )
      request.addEventListener('error', fail, { once: true })
      request.send(data)
    })
  }

  // FIXME(theis): critical bug in MIDI scheduling
  // timing becomes completely wrong at high tempos
  // should implement a MusicXML to Tone.js formatter instead, using
  // musical rhythm notation rather than concrete seconds-based timing
  async loadMidi(
    serverURL: string,
    musicXML: XMLDocument,
    sequenceDuration_toneTime: Tone.TimeClass,
    bpmControl: BPMControl
  ): Promise<string> {
    const serializer = new XMLSerializer()
    const payload = serializer.serializeToString(musicXML)

    $(document).ajaxError((error) => console.log(error))

    const midiBlobURL = this.midiRequestWithData(serverURL, payload, 'POST')
      .then(([midi, blobURL]) => {
        if (!this.transport.loop) {
          this.transport.loop = true
          this.transport.loopStart = 0
        }
        this.transport.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()

        // assumes constant BPM or defaults to 120BPM if no tempo information available
        const BPM =
          midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120
        if (!midi.header.timeSignatures[0]) {
          // TODO insert warning wrong Flask server
          // TODO create a test for the flask server
        }
        // must set the Transport BPM to that of the midi for proper scheduling
        // TODO(theis): this will probably lead to phase-drift if repeated
        // updates are performed successively, should catch up somehow on
        // the desynchronisation introduced by this temporary tempo change
        this.transport.bpm.value = BPM

        // Required for Tone.Time conversions to properly work
        this.transport.timeSignature =
          midi.header.timeSignatures[0].timeSignature

        const numTracks = midi.tracks.length
        for (let trackIndex = 0; trackIndex < numTracks; trackIndex++) {
          const track = midi.tracks[trackIndex]
          // midiChannels start at 1
          const midiChannel = trackIndex + 1
          this.scheduleTrackToInstrument(
            sequenceDuration_toneTime,
            track,
            midiChannel
          )
        }

        // change Transport BPM back to the displayed value
        // FIXME(theis): if bpmCounter is a floor'ed value, this is wrong
        this.transport.bpm.value = bpmControl.value

        this.switchTracks()
        return blobURL
      })
      .catch((error) => {
        console.log(error)
        return ''
      })

    return midiBlobURL
  }

  scheduleChordsPlayer(midiChannel: number, locator: SheetLocator): void {
    // schedule callback to play the chords contained in the OSMD
    const useChordsInstruments = true

    const playChord = (time: number) => {
      const currentStep = this.quartersProgress()
      if (currentStep % 2 == 0) {
        const chord =
          locator.chordSelectors[Math.floor(currentStep / 2)].currentChord
        const events = Chord.getNoteEvents(
          chord.note + chord.accidental,
          chord.chordType,
          time,
          Tone.Time('2n'),
          0.5
        )
        const playNote = this.getPlayNoteByMidiChannel(
          midiChannel,
          useChordsInstruments
        )
        for (
          let eventIndex = 0, numEvents = events.length;
          eventIndex < numEvents;
          eventIndex++
        ) {
          playNote(time, events[eventIndex])
        }
      }
    }

    // FIXME assumes a TimeSignature of 4/4
    new Tone.Loop(playChord, '4n').start(0)
  }

  disposeScheduledParts(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.midiParts.forEach((parts) => parts.forEach((part) => part.dispose()))
      resolve()
    })
  }
}
