// <reference path='./typing/jquery-exists.d.ts'/>

import { PlaybackManager } from './playback'

import * as Tone from 'tone'
import { Piano as PianoType } from '@tonejs/piano'
import * as log from 'loglevel'
import { Midi } from '@tonejs/midi'
import WebMidi from 'webmidi'
import $ from 'jquery'

const Nexus = require('./nexusColored')

import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import * as Chord from './chord'
import { BPMControl } from './numberControl'

import { SheetLocator } from './locator'

const scrollElementSelector = '.simplebar-content-wrapper'

$.fn.exists = function () {
  return this.length !== 0
}

export default class SheetPlaybackManager extends PlaybackManager<SheetLocator> {
  private getPlayNoteByMidiChannel(
    midiChannel: number,
    useChordsInstruments = false
  ) {
    let getCurrentInstrument = Instruments.getCurrentInstrument
    if (useChordsInstruments) {
      getCurrentInstrument = Instruments.getCurrentChordsInstrument
    }
    function getTimingOffset() {
      return WebMidi.time - Tone.getTransport().immediate() * 1000
    }

    const timingOffset = getTimingOffset()
    function playNote(time, event) {
      MidiOut.getOutput().then((currentMidiOutput) => {
        if (currentMidiOutput) {
          currentMidiOutput.playNote(event.name, midiChannel, {
            time: time * 1000 + getTimingOffset(),
            duration: event.duration * 1000,
          })
        }
      })

      const currentInstrument = getCurrentInstrument()
      if ('keyUp' in currentInstrument) {
        const piano: PianoType = <PianoType>currentInstrument
        piano.keyDown({
          note: event.name,
          time: time,
          velocity: event.velocity,
        })
        piano.keyUp({ note: event.name, time: time + event.duration })
      } else if ('triggerAttackRelease' in currentInstrument) {
        getCurrentInstrument().triggerAttackRelease(
          event.name,
          event.duration,
          time,
          event.velocity
        )
      }
      log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event))
    }
    return playNote
  }

  protected nowPlayingDisplayCallback(_: any, progress: number): void {
    super.nowPlayingDisplayCallback(null, progress)
    // scroll display to current step if necessary
    const step: number = Math.round(progress * this.sheetDuration_quarters)
    this.scrollToStep(step)
  }

  protected resetPlaybackPositionDisplay(): void {
    super.resetPlaybackPositionDisplay()
    this.resetScrollPosition()
  }

  private getTimecontainerPosition(
    step: number
  ): { left: number; right: number } {
    const containerElementSelector = $(
      `.timeContainer[containedQuarterNotes='${step}']`
    )

    if (!containerElementSelector.exists()) {
      throw new Error('Inaccessible step')
    }

    const containerElementStyle = containerElementSelector[0].style

    return {
      left: parseFloat(containerElementStyle.left),
      // FIXME implement and use timeContainer method
      right:
        parseFloat(containerElementStyle.left) +
        parseFloat(containerElementStyle.width),
    }
  }

  // TODO disabe scrooling behaviour when user touches scrollbar and re-enable it
  // on pressing stop (or add a 'track playback' button)

  private shortScroll: JQuery.Duration = 50

  private getDisplayCenterPosition_px(): number {
    // return the current position within the sheet display
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
    const currentSheetDisplayWidth: number = scrollContentElement.clientWidth
    const centerPosition: number =
      scrollContentElement.scrollLeft + currentSheetDisplayWidth / 2

    return centerPosition
  }

  protected scrollToStep(step: number) {
    // scroll display to keep the center of the currently playing
    // quarter note container in the center of the sheet window
    //
    // We do this by scheduling a scroll to the next step with duration
    // equal to one quarter-note time (dependent on the current BPM)
    // Inversely, scrolling to a position earlier in time (e.g. when pressing
    // stop or reaching the end of the loop) is super-fast
    log.debug(`Scrolling to step: ${step}`)
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
    const currentSheetDisplayWidth_px: number = scrollContentElement.clientWidth
    const currentCenterPosition_px: number = this.getDisplayCenterPosition_px()

    let positionTarget_px: number
    let newScrollLeft_px: number
    try {
      // try to retrieve the position of the (potentially non-existing) next
      // quarter-note
      const nextStepBoxDelimiters = this.getTimecontainerPosition(step)
      const nextStepBoxWidth_px: number =
        nextStepBoxDelimiters.right - nextStepBoxDelimiters.left
      log.debug(
        `nextStepPosition: [${nextStepBoxDelimiters.left}, ${nextStepBoxDelimiters.right}]`
      )

      // Center of the box containing the next quarter note
      const containerCenter =
        nextStepBoxDelimiters.left + nextStepBoxWidth_px / 2
      positionTarget_px = nextStepBoxDelimiters.right
    } catch (e) {
      // reached last container box
      // FIXME make and catch specific error
      const lastStepPosition = this.getTimecontainerPosition(step)
      log.debug(
        `Moving to end, lastStepPosition: [${lastStepPosition.left}, ${lastStepPosition.right}]`
      )

      // right-side delimiter of the last quarter note box
      const containerRight = lastStepPosition.right
      positionTarget_px = containerRight
    }
    newScrollLeft_px = positionTarget_px - currentSheetDisplayWidth_px / 2

    log.debug(`currentSheetDisplayWidth: ${currentSheetDisplayWidth_px}`)
    log.debug(`currentCenterPosition: ${currentCenterPosition_px}`)
    log.debug(`positionTarget: ${positionTarget_px}`)
    log.debug(`scrollOffsetTarget: ${newScrollLeft_px}`)
    if (currentCenterPosition_px > positionTarget_px) {
      // scrolling to a previous position: super-fast scroll
      $(scrollElementSelector).stop(true, false).animate(
        {
          scrollLeft: newScrollLeft_px,
        },
        10,
        'linear'
      )
    } else {
      // synchronize scrolling with the tempo for smooth scrolling
      const scrollDuration_ms = this.getInterbeatTime_s() * 1000
      $(scrollElementSelector).stop(true, false).animate(
        {
          scrollLeft: newScrollLeft_px,
        },
        scrollDuration_ms,
        'linear'
      )
    }
  }

  private resetScrollPosition(duration: JQuery.Duration = this.shortScroll) {
    this.scrollToStep(0)
  }

  // Return the time in seconds between beats
  private getInterbeatTime_s() {
    const currentBPM: number = Tone.getTransport().bpm.value
    const interbeatTime_s = 60 / currentBPM
    return interbeatTime_s
  }

  private midiParts: Tone.Part[] = []

  public scheduleTrackToInstrument(
    sequenceDuration_toneTime: Tone.TimeClass,
    midiTrack,
    midiChannel = 1
  ) {
    const notes = midiTrack.notes

    let playNote_callback
    playNote_callback = this.getPlayNoteByMidiChannel(midiChannel)

    const part = new Tone.Part(playNote_callback, notes)
    part.start(0) // schedule events on the Tone timeline
    part.loop = true
    part.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()
    this.midiParts.push(part)

    // schedule the pedal
    const sustain = new Tone.Part((time, event) => {
      const currentInstrument = Instruments.getCurrentInstrument()
      if ('pedalUp' in currentInstrument) {
        const piano = <PianoType>currentInstrument
        if (event.value) {
          piano.pedalDown({ time: time })
        } else {
          piano.pedalUp({ time: time })
        }
      }
    }, midiTrack.controlChanges[64]).start(0)

    log.trace('Midi track content')
    log.trace(midiTrack.noteOffs)
    log.trace(midiTrack.notes)

    // set correct loop points for all tracks and activate infinite looping
    for (const part of [sustain]) {
      part.loop = true
      part.loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()

      // add the part to the array of currently scheduled parts
      this.midiParts.push(part)
    }
  }

  private get sheetDuration_quarters(): number {
    const osmdContainer: HTMLElement = document.getElementById('osmd-container')
    if (osmdContainer === null) {
      throw new Error('Cannot access OSMD container')
    }
    const maxStep: number = parseInt(
      osmdContainer.getAttribute('sequenceDuration_quarters')
    )
    if (maxStep === null) {
      throw new Error(
        'Property sequenceDuration_quarters not found on OSMD container'
      )
    }
    return maxStep
  }

  protected getCurrentDisplayTimestep(): number {
    // HACK should use proper typings for Tone
    const [
      currentBar,
      currentQuarter,
      currentSixteenth,
    ] = Tone.getTransport().position.toString().split(':')

    const sheetDuration_quarters = this.sheetDuration_quarters

    // FIXME assumes a Time Signature of 4/4
    const currentStep: number =
      (4 * parseInt(currentBar) + parseInt(currentQuarter)) %
      sheetDuration_quarters
    return currentStep
  }

  private midiRequestWithData(
    url: string,
    data = null,
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
        for (
          let midiPartIndex = 0, numMidiParts = this.midiParts.length;
          midiPartIndex < numMidiParts;
          midiPartIndex++
        ) {
          const midiPart = this.midiParts.pop()
          midiPart.dispose()
        }

        Tone.getTransport().loop = true
        Tone.getTransport().loopStart = 0
        Tone.getTransport().loopEnd = sequenceDuration_toneTime.toBarsBeatsSixteenths()

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
        Tone.getTransport().bpm.value = BPM

        // Required for Tone.Time conversions to properly work
        Tone.getTransport().timeSignature =
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
        Tone.getTransport().bpm.value = bpmControl.value // WARNING if bpmCounter is a floor'ed value, this is wrong
        return blobURL
      })
      .catch((error) => {
        console.log(error)
        return ''
      })

    return midiBlobURL
  }

  scheduleChordsPlayer(sheetLocator: SheetLocator, midiChannel: number): void {
    // schedule callback to play the chords contained in the OSMD
    const useChordsInstruments = true

    const playChord = (time: number) => {
      const currentStep = this.getCurrentDisplayTimestep()
      if (currentStep % 2 == 0) {
        const chord =
          sheetLocator.chordSelectors[Math.floor(currentStep / 2)].currentChord
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
      this.midiParts.forEach((part) => part.dispose())
      resolve()
    })
  }
}
