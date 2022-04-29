import { PlaybackManager } from './playback'

import * as Tone from 'tone'
import * as log from 'loglevel'
import { Midi, Track } from '@tonejs/midi'
import { Note as MidiNote } from '@tonejs/midi/src/Note'
import { WebMidi } from 'webmidi'
import $ from 'jquery'

import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import * as Chord from './chord'
import { BPMControl } from './numberControl'
import { SheetData, SheetInpainter } from './sheet/sheetInpainter'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import { ControlChange } from '@tonejs/midi/src/ControlChange'

type NoteWithMIDIChannel = {
  name: string
  velocity: number
  duration: number
  midiChannel: number
}

export default class MidiSheetPlaybackManager extends PlaybackManager<SheetInpainter> {
  midiLatency = 0
  readonly bpmControl: BPMControl
  protected supportsMidi = false

  // TODO(@tbazin): set-up chords instrument simply as an additional MIDI channel
  // and treat it like the other instruments
  readonly useChordsInstrument: boolean

  _playNote: (time: Tone.Unit.Time, event: NoteWithMIDIChannel) => void
  get playNote(): (time: Tone.Unit.Time, event: NoteWithMIDIChannel) => void {
    return this._playNote
  }
  set playNote(
    playNote: (time: Tone.Unit.Time, event: NoteWithMIDIChannel) => void
  ) {
    this.midiParts.forEach((midiParts) =>
      midiParts.forEach((part) => {
        part.callback = playNote
      })
    )
    this._playNote = playNote
  }

  constructor(
    inpainter: SheetInpainter,
    bpmControl: BPMControl,
    useChordsInstrument = false
  ) {
    super(inpainter)
    this.bpmControl = bpmControl
    this.useChordsInstrument = useChordsInstrument
    this.transport.bpm.value = this.bpmControl.value
    this.registerTempoUpdateCallback()
    this.toggleLowLatency(false)
    void this.refreshPlayNoteCallback()

    this.checkMidiSupport()
      .then((supportsMidi) => {
        this.supportsMidi = supportsMidi
      })
      .catch(() => {
        this.supportsMidi = false
      })
  }

  // retrieve MIDI from sheet data
  // TODO(@tbazin, 2022/04/22): move the MIDI directly to the SheetData and
  // have it sent by the Flask server along with the sheet on every request
  // this will wallow natural updates of the DownloadButton
  protected async onInpainterChange(data: SheetData): Promise<void> {
    // HACK(@tbazin, 2022/04/22): hardcoded value
    // have the remote API send the sheet duration + time-signature within the JSON data
    // or retrieve it from the MusicXML in the browser?
    const sequenceDuration = Tone.Time('0:16:0')
    const midiConversionURL = new URL(
      'musicxml-to-midi',
      this.inpainter.defaultApiAddress
    )
    const midiBlobURL = await this.loadMidi(
      midiConversionURL.href,
      this.inpainter.currentXML,
      sequenceDuration.toBarsBeatsSixteenths()
    )
  }

  protected async checkMidiSupport(): Promise<boolean> {
    if (window.navigator.requestMIDIAccess != undefined) {
      return window.navigator
        .requestMIDIAccess()
        .then(() => true)
        .catch(() => false)
    } else {
      return false
    }
  }

  registerTempoUpdateCallback(): void {
    this.bpmControl.on('interface-tempo-changed', (newBpm: number) => {
      // HACK perform a comparison to avoid messaging loops, since
      // the link update triggers a bpm modification message
      this.transport.bpm.value = newBpm
    })
    this.bpmControl.on('interface-tempo-changed-silent', (newBpm: number) => {
      // HACK perform a comparison to avoid messaging loops, since
      // the link update triggers a bpm modification message
      this.transport.bpm.value = newBpm
    })
  }

  async refreshPlayNoteCallback(): Promise<void> {
    let getCurrentInstrument = Instruments.getCurrentInstrument
    if (this.useChordsInstrument) {
      getCurrentInstrument = Instruments.getCurrentChordsInstrument
    }

    let usesMidiOutput = false
    if (this.supportsMidi) {
      const getTimingOffset = () => {
        // https://github.com/Tonejs/Tone.js/issues/805#issuecomment-748172477
        return WebMidi.time - this.transport.now() * 1000
      }
      const currentMidiOutput = await MidiOut.getOutput()
      if (currentMidiOutput) {
        this.playNote = (time: number, event: NoteWithMIDIChannel) => {
          const absoluteTime = time * 1000 + getTimingOffset()
          currentMidiOutput.playNote(event.name, {
            time: absoluteTime,
            duration: event.duration * 1000,
            channels: event.midiChannel,
          })
        }
        usesMidiOutput = true
      }
    }
    if (!usesMidiOutput) {
      this.playNote = (time: number, event: NoteWithMIDIChannel) => {
        const currentInstrument = getCurrentInstrument(event.midiChannel)
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
      }
    }
  }

  triggerPedalCallback: (time: Tone.Unit.Time, event: ControlChange) => void = (
    time: Tone.Unit.Time,
    event: ControlChange
  ) => {
    const currentInstrument = Instruments.getCurrentInstrument()
    if ('pedalUp' in currentInstrument) {
      if (event.value) {
        currentInstrument.pedalDown({ time: time })
      } else {
        currentInstrument.pedalUp({ time: time })
      }
    }
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

  protected midiParts_A = new Map<number, Tone.Part<NoteWithMIDIChannel>>()
  protected midiParts_B = new Map<number, Tone.Part<NoteWithMIDIChannel>>()
  protected controlChanges_A = new Map<number, Tone.Part<ControlChange>>()
  protected controlChanges_B = new Map<number, Tone.Part<ControlChange>>()
  protected get midiParts(): Map<number, Tone.Part<NoteWithMIDIChannel>>[] {
    return [this.midiParts_A, this.midiParts_B]
  }
  protected get controlChanges(): Map<number, Tone.Part<ControlChange>>[] {
    return [this.controlChanges_A, this.controlChanges_B]
  }

  protected get aIsMuted(): boolean {
    return Array.from(this.midiParts_A.values()).every((part) => part.mute)
  }

  protected _currentTrackIsA = true
  protected get currentTrackIsA(): boolean {
    return this._currentTrackIsA
  }
  protected toggleTracks(): void {
    this._currentTrackIsA = !this.currentTrackIsA
  }

  protected get playingMidiPartsIndex(): number {
    if (this.currentTrackIsA) {
      return 1
    } else {
      return 0
    }
  }

  protected get nextMidiPartsIndex(): number {
    return 1 - this.playingMidiPartsIndex
  }

  protected getPlayingMidiParts(): Map<number, Tone.Part<NoteWithMIDIChannel>> {
    return this.midiParts[this.playingMidiPartsIndex]
  }

  protected getNextMidiParts(): Map<number, Tone.Part<NoteWithMIDIChannel>> {
    return this.midiParts[this.nextMidiPartsIndex]
  }

  protected getPlayingControlChanges(): Map<number, Tone.Part<ControlChange>> {
    return this.controlChanges[this.playingMidiPartsIndex]
  }

  protected getNextControlChanges(): Map<number, Tone.Part<ControlChange>> {
    return this.controlChanges[this.nextMidiPartsIndex]
  }

  protected switchTracks(): void {
    // TODO(@tbazin, 2022/04/29): add crossfade for smooth transitioning
    const playing = this.getPlayingMidiParts()
    const playingControlChanges = this.getPlayingControlChanges()
    const next = this.getNextMidiParts()
    const nextControlChanges = this.getNextControlChanges()
    this.toggleTracks()

    next.forEach((part) => {
      part.mute = false
    })
    playing.forEach((part) => {
      part.mute = true
    })
    nextControlChanges.forEach((controlChanges) => {
      controlChanges.mute = false
    })
    playingControlChanges.forEach((controlChanges) => {
      controlChanges.mute = true
    })
  }

  scheduleTrackToInstrument(
    sequenceDuration_barsBeatsSixteenth: string,
    midiTrack: Track,
    midiChannel = 1,
    nextParts: Map<number, Tone.Part<NoteWithMIDIChannel>>,
    nextControlChanges: Map<number, Tone.Part<ControlChange>>
  ): void {
    const notes: MidiNote[] = midiTrack.notes
    const notesWithChannel = notes.map((note) => {
      const noteJson = note.toJSON()
      return {
        ...noteJson,
        midiChannel: midiChannel,
        time: noteJson.time,
        duration: noteJson.duration - 0.01,
      }
    })

    const copySkippedNotesToPartEnd = (
      part: Tone.Part,
      notes: { time: number }[]
    ) => {
      notes.forEach((note) => {
        if (note.time < this.transport.context.lookAhead) {
          part.add(8 + note.time, note)
        }
      })
    }

    let part = nextParts.get(midiChannel)
    if (part == undefined) {
      log.debug('Creating new part')
      part = new Tone.Part<NoteWithMIDIChannel>((time, note) => {
        this.playNote(time, note)
      }, notesWithChannel)
      // copySkippedNotesToPartEnd(part, notesWithChannel)
      part.mute = true
      // @HACK(@tbazin): offsetting the lookAhead to ensure perfect synchronization when
      // using Ableton Link, the downside is that it skips the first few notes,
      // one possible solution would be to copy them back at the part's end
      part.start(0, +this.transport.context.lookAhead) // schedule events on the Tone timeline
      part.loop = true
      part.loopEnd = sequenceDuration_barsBeatsSixteenth
      nextParts.set(midiChannel, part)
    } else {
      part.mute = true
      part.clear()
      notesWithChannel.forEach((noteEvent) => {
        part.add(noteEvent)
      })
      // copySkippedNotesToPartEnd(part, notesWithChannel)
      part.loopEnd = sequenceDuration_barsBeatsSixteenth
    }

    // schedule the pedal
    const pedalControlChanges = midiTrack.controlChanges[64]
    if (pedalControlChanges != undefined) {
      let controlChangesPart = nextControlChanges.get(midiChannel)
      if (controlChangesPart == undefined) {
        controlChangesPart = new Tone.Part<ControlChange>(
          this.triggerPedalCallback,
          pedalControlChanges
        )
        // copySkippedNotesToPartEnd(controlChangesPart, pedalControlChanges)
        controlChangesPart.mute = true
        controlChangesPart.start(0)
        controlChangesPart.loop = true
        controlChangesPart.loopEnd = sequenceDuration_barsBeatsSixteenth
        nextControlChanges.set(midiChannel, controlChangesPart)
      } else {
        controlChangesPart.mute = true
        controlChangesPart.clear()
        pedalControlChanges.forEach((controlChange: ControlChange) => {
          controlChangesPart.add(controlChange)
        })
        // copySkippedNotesToPartEnd(controlChangesPart, pedalControlChanges)
        controlChangesPart.loopEnd = sequenceDuration_barsBeatsSixteenth
      }
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
    sequenceDuration_barsBeatsSixteenth: string
  ): Promise<string> {
    const serializer = new XMLSerializer()
    const payload = serializer.serializeToString(musicXML)

    $(document).ajaxError((error) => console.log(error))

    const midiBlobURL = this.midiRequestWithData(serverURL, payload, 'POST')
      .then(async ([midi, blobURL]) => {
        if (!this.transport.loop) {
          this.transport.loop = true
          this.transport.loopStart = 0
        }
        this.transport.loopEnd = sequenceDuration_barsBeatsSixteenth

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

        const nextParts = this.getNextMidiParts()
        const nextControlChanges = this.getNextControlChanges()
        const schedulingPromises = midi.tracks.map((track, index) => {
          // midiChannels start at 1
          const midiChannel = index + 1
          this.scheduleTrackToInstrument(
            sequenceDuration_barsBeatsSixteenth,
            track,
            midiChannel,
            nextParts,
            nextControlChanges
          )
        })
        await Promise.all(schedulingPromises)

        // change Transport BPM back to the displayed value
        // FIXME(theis): if this.bpmControl.value is a floor'ed value, this is wrong
        this.transport.bpm.value = this.bpmControl.value

        this.switchTracks()
        return blobURL
      })
      .catch((error) => {
        console.log(error)
        return ''
      })

    return midiBlobURL
  }

  scheduleChordsPlayer(
    midiChannel: number,
    inpainter: SheetInpainterGraphicalView
  ): void {
    // schedule callback to play the chords contained in the OSMD
    const playChord = (time: number) => {
      const currentStep = this.quartersProgress()
      if (currentStep % 2 == 0) {
        const chord =
          inpainter.chordSelectors[Math.floor(currentStep / 2)].currentChord
        const events = Chord.makeNoteEvents(chord, time, Tone.Time('2n'), 0.5)
        events.forEach((event) =>
          this.playNote(time, {
            name: event.name,
            duration: this.transport.toSeconds(event.duration),
            velocity: event.velocity,
            midiChannel: midiChannel,
          })
        )
      }
    }

    // FIXME(@tbazin): assumes a TimeSignature of 4/4
    new Tone.Loop(playChord, '4n').start(0)
  }

  disposeScheduledParts(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.midiParts.forEach((parts) => parts.forEach((part) => part.dispose()))
      resolve()
    })
  }
}
