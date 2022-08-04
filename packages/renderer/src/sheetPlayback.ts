import { PlaybackManager } from './playback'

import * as Tone from 'tone'
import log from 'loglevel'
import { Midi, Track } from '@tonejs/midi'
import { Note as MidiNote } from '@tonejs/midi/src/Note'

import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import * as Chord from './chord'
import { BPMControl } from './numberControl'
import {
  MidiInpainter,
  SheetData,
  SheetInpainter,
} from './sheet/sheetInpainter'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import { ControlChange } from '@tonejs/midi/src/ControlChange'
import { PiaInpainter } from './piano_roll/pianoRollInpainter'
import { PianoRollInpainterGraphicalView } from './piano_roll/pianoRollInpainterGraphicalView'
import { ToneEvent } from 'tone'
import { sequenceProtoToMidi } from '@magenta/music/esm/core/midi_io'

type NoteWithMIDIChannel = {
  name: string
  time: string
  timeTicks: number
  velocity: number
  duration: number
  durationTicks: number
  midiChannel: number
}

class InpaintablePart<TODOREMOVETHIS> extends Tone.Part<NoteWithMIDIChannel> {
  clearRegion(startTicks: number, endTicks: number): void {
    const events = [...this._events]
    let numCleared = 0
    events.forEach((e: Tone.ToneEvent<NoteWithMIDIChannel>) => {
      if (e.value.timeTicks >= startTicks && e.value.timeTicks < endTicks) {
        this.remove(`${e.startOffset}i`)
        numCleared += 1
      }
    })
  }
}

export default class MidiSheetPlaybackManager<
  InpainterT extends MidiInpainter<{ midi: Midi }, never> = MidiInpainter<
    { midi: Midi },
    never
  >
> extends PlaybackManager<InpainterT> {
  readonly bpmControl: BPMControl
  protected supportsMidi = false

  protected playbackLookahead: number = 0.1
  protected interactiveLookahead: number = 0.05

  protected _loopEnd: Tone.Unit.Time | null = null

  public get loopEnd(): Tone.Unit.Time | null {
    return this._loopEnd
  }
  public set loopEnd(loopEnd: Tone.Unit.Time | null) {
    if (this.loopEnd == loopEnd) {
      return
    }
    this._loopEnd = loopEnd
    this.transport.loop = loopEnd != null
    if (loopEnd != null) {
      this.transport.loopEnd = loopEnd
    }
  }

  // TODO(@tbazin): set-up chords instrument simply as an additional MIDI channel
  // and treat it like the other instruments
  readonly useChordsInstrument: boolean

  _playNote: (time: number, event: NoteWithMIDIChannel) => void = () => {}
  get playNote(): (time: number, event: NoteWithMIDIChannel) => void {
    return this._playNote
  }
  set playNote(playNote: (time: number, event: NoteWithMIDIChannel) => void) {
    this.midiParts.forEach((midiParts) =>
      midiParts.forEach((part) => {
        part.callback = playNote
      })
    )
    this._playNote = playNote
  }

  constructor(
    inpainter: InpainterT,
    bpmControl: BPMControl,
    useChordsInstrument = false
  ) {
    super(inpainter)
    if (this.inpainter.PPQ != null) {
      this.transport.PPQ = this.inpainter.PPQ
    }
    if (this.inpainter.forceDuration_ticks != null) {
      this.loopEnd = `${this.inpainter.forceDuration_ticks}i`
    }
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

    // inpainter.on('clear', (inpaintingRegion: [number, number]) => {
    //   if (this.loopEnd == null) {
    //     return
    //   }
    //   const ticksStart = Math.round(
    //     inpaintingRegion[0] * this.transport.toTicks(this.loopEnd)
    //   )
    //   const ticksEnd = Math.round(
    //     inpaintingRegion[1] * this.transport.toTicks(this.loopEnd)
    //   )
    //   this.getPlayingMidiParts().forEach((part) =>
    //     part.clearRegion(ticksStart, ticksEnd)
    //   )
    //   this.getPlayingControlChanges().forEach((part) =>
    //     part.clearRegion(ticksStart, ticksEnd)
    //   )
    // })
  }

  protected clearRegion(inpaintingRegionTicks: [number, number]) {
    const parts = this.getPlayingMidiParts()
    parts.forEach((part) => part.clearRegion(...inpaintingRegionTicks))
    const controlChanges = this.getPlayingControlChanges()
    controlChanges.forEach((part) => part.clearRegion(...inpaintingRegionTicks))
  }

  protected onInpainterChange(data: {
    midi: Midi
    inpaintingRegionTicks?: [number, number]
    newNotes?: object
    durationTicks?: number
  }): void {
    // FIXME(@tbazin, 2022/07/31): Fix this!! breaks NONOTO looping
    const totalDurationTicks =
      this.inpainter.forceDuration_ticks != null
        ? this.inpainter.forceDuration_ticks
        : Math.round(
            (data.midi.durationTicks / data.midi.header.ppq) *
              this.transport.PPQ
          )

    let inpaintingRegionTicks: [number, number] | undefined = undefined
    if (data.inpaintingRegionTicks != null) {
      inpaintingRegionTicks = data.inpaintingRegionTicks?.map(
        (timestamp: number) =>
          Math.round((timestamp / data.midi.header.ppq) * this.transport.PPQ)
      ) as [number, number]
    }
    if (data.newNotes == undefined && inpaintingRegionTicks != undefined) {
      this.clearRegion(inpaintingRegionTicks)
    }
    if (data.newNotes != undefined && inpaintingRegionTicks != undefined) {
      data.newNotes
      this.loadMidi(
        new Midi(sequenceProtoToMidi(data.newNotes)),
        undefined,
        true
      )
    } else {
      this.loopEnd = `${totalDurationTicks}i`
      this.loadMidi(data.midi, inpaintingRegionTicks)
    }
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

  protected registerTempoUpdateCallback(): void {
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
      const currentMidiOutput = await MidiOut.getOutput()
      if (currentMidiOutput) {
        this.playNote = (time: number, event: NoteWithMIDIChannel) => {
          currentMidiOutput.playNote(event.name, {
            // https://github.com/Tonejs/Tone.js/issues/805#issuecomment-955812985
            time: '+' + ((time - this.transport.now()) * 1000).toFixed(),
            duration:
              this.transport.toSeconds(`${event.durationTicks}i`) * 1000,
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
              time: this.transport.toSeconds(time),
              velocity: event.velocity,
            })
            currentInstrument.keyUp({
              note: event.name,
              time:
                this.transport.toSeconds(time) +
                this.transport.toSeconds(`${event.durationTicks}i`),
            })
          } else if ('triggerAttackRelease' in currentInstrument) {
            currentInstrument.triggerAttackRelease(
              event.name,
              `${event.durationTicks}i`,
              time,
              event.velocity
            )
          }
          log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event))
        }
      }
    }
  }

  protected triggerPedalCallback: (
    time: Tone.Unit.Time,
    event: ControlChange
  ) => void = (time: Tone.Unit.Time, event: ControlChange) => {
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

  protected midiParts_A = new Map<
    number,
    InpaintablePart<NoteWithMIDIChannel>
  >()
  protected midiParts_B = new Map<
    number,
    InpaintablePart<NoteWithMIDIChannel>
  >()
  protected controlChanges_A = new Map<number, InpaintablePart<ControlChange>>()
  protected controlChanges_B = new Map<number, InpaintablePart<ControlChange>>()
  protected get midiParts(): Map<
    number,
    InpaintablePart<NoteWithMIDIChannel>
  >[] {
    return [this.midiParts_A, this.midiParts_B]
  }
  protected get controlChanges(): Map<
    number,
    InpaintablePart<ControlChange>
  >[] {
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
      return 0
    } else {
      return 1
    }
  }

  protected get nextMidiPartsIndex(): number {
    return 1 - this.playingMidiPartsIndex
  }

  protected getPlayingMidiParts(): Map<
    number,
    InpaintablePart<NoteWithMIDIChannel>
  > {
    return this.midiParts[this.playingMidiPartsIndex]
  }

  protected getNextMidiParts(): Map<
    number,
    InpaintablePart<NoteWithMIDIChannel>
  > {
    return this.midiParts[this.nextMidiPartsIndex]
  }

  protected getPlayingControlChanges(): Map<
    number,
    InpaintablePart<ControlChange>
  > {
    return this.controlChanges[this.playingMidiPartsIndex]
  }

  protected getNextControlChanges(): Map<
    number,
    InpaintablePart<ControlChange>
  > {
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

  protected scheduleTrackToInstrument(
    midiTrack: Track,
    midiChannel = 1,
    parts: Map<number, InpaintablePart<NoteWithMIDIChannel>>,
    controlChanges: Map<number, InpaintablePart<ControlChange>>,
    originalPPQ: number,
    inpaintingRegion?: [number, number],
    doNotClearExisting?: boolean
  ): void {
    const notes: MidiNote[] = midiTrack.notes
    let notesWithChannel: NoteWithMIDIChannel[] = notes.map((note) => {
      const noteJson = note.toJSON()
      const timeTicks = Math.round(
        (noteJson.ticks / originalPPQ) * this.transport.PPQ
      )
      const durationTicks = Math.round(
        (noteJson.durationTicks / originalPPQ) * this.transport.PPQ
      )
      return {
        name: noteJson.name,
        time: `${timeTicks}i`,
        timeTicks: timeTicks,
        duration: `${durationTicks}i`,
        durationTicks: durationTicks,
        velocity: noteJson.velocity,
        midiChannel: midiChannel,
        originalTimeTicks: noteJson.ticks,
      }
    })

    // const copySkippedNotesToPartEnd = (
    //   part: Tone.Part,
    //   notes: { time: number }[]
    // ) => {
    //   notes.forEach((note) => {
    //     if (note.time < this.transport.context.lookAhead) {
    //       part.add(8 + note.time, note)
    //     }
    //   })
    // }

    let part = parts.get(midiChannel)
    if (part == undefined) {
      log.debug('Creating new part')
      part = new InpaintablePart<NoteWithMIDIChannel>(
        (time, note: NoteWithMIDIChannel) => {
          this.playNote(time, note)
        },
        notesWithChannel
      )
      // copySkippedNotesToPartEnd(part, notesWithChannel)
      part.mute = true
      part.mute = false // TODO: check this
      // @HACK(@tbazin): offsetting the lookAhead to ensure perfect synchronization when
      // using Ableton Link, the downside is that it skips the first few notes,
      // one possible solution would be to copy them back at the part's end
      part.start(0, this.transport.context.lookAhead) // schedule events on the Tone timeline
      parts.set(midiChannel, part)
    } else {
      part.mute = true
      part.mute = false // TODO: check this
      if (doNotClearExisting || inpaintingRegion != null) {
        // part.clearRegion(...inpaintingRegion)
      } else {
        part.clear()
      }

      if (inpaintingRegion != null) {
        notesWithChannel = notesWithChannel.filter(
          (e) =>
            e.timeTicks >= inpaintingRegion[0] &&
            e.timeTicks < inpaintingRegion[1]
        )
      }

      notesWithChannel.forEach((noteEvent) => {
        part.add(noteEvent)
      })
      // copySkippedNotesToPartEnd(part, notesWithChannel)
    }
    part.start(0, this.transport.context.lookAhead) // schedule events on the Tone timeline
    if (this.loopEnd != null) {
      part.loop = true
      part.loopEnd = this.loopEnd
    } else {
      part.loop = false
    }
    return

    // schedule the pedal
    const pedalControlChanges = midiTrack.controlChanges[64]
    if (pedalControlChanges != undefined) {
      let controlChangesPart = controlChanges.get(midiChannel)
      if (controlChangesPart == undefined) {
        controlChangesPart = new InpaintablePart<ControlChange>(
          this.triggerPedalCallback,
          pedalControlChanges
        )
        // copySkippedNotesToPartEnd(controlChangesPart, pedalControlChanges)
        controlChangesPart.mute = true
        controlChanges.set(midiChannel, controlChangesPart)
      } else {
        controlChangesPart.mute = true
        controlChangesPart.clear()
        pedalControlChanges.forEach((controlChange: ControlChange) => {
          controlChangesPart.add(controlChange)
        })
        // copySkippedNotesToPartEnd(controlChangesPart, pedalControlChanges)
      }
      controlChangesPart.start(0)
      if (this.loopEnd != null) {
        controlChangesPart.loop = true
        controlChangesPart.loopEnd = this.loopEnd
      } else {
        controlChangesPart.loop = false
      }
    }
  }

  // FIXME(theis): critical bug in MIDI scheduling
  // timing becomes completely wrong at high tempos
  // should implement a MusicXML to Tone.js formatter instead, using
  // musical rhythm notation rather than concrete seconds-based timing
  protected loadMidi(
    midi: Midi,
    inpaintingRegion?: [number, number],
    doNotClearExisting?: boolean
  ): void {
    if (!this.transport.loop) {
      this.transport.loop = true
      this.transport.loopStart = 0
    }

    // assumes constant BPM or defaults to 120BPM if no tempo information available
    const BPM = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120
    if (!midi.header.timeSignatures[0]) {
      // TODO insert warning wrong Flask server
      // TODO create a test for the flask server
    }
    // must set the Transport BPM to that of the midi for proper scheduling
    // TODO(theis): this will probably lead to phase-drift if repeated
    // updates are performed successively, should catch up somehow on
    // the desynchronisation introduced by this temporary tempo change
    // this.transport.bpm.value = BPM

    // Required for Tone.Time conversions to properly work
    // this.transport.timeSignature = midi.header.timeSignatures[0].timeSignature

    const playingParts = this.getPlayingMidiParts()
    const playingControlChanges = this.getPlayingControlChanges()
    // const nextParts = this.getNextMidiParts()
    // const nextControlChanges = this.getNextControlChanges()
    midi.tracks.forEach((track, index) => {
      // midiChannels start at 1
      const midiChannel = index + 1
      this.scheduleTrackToInstrument(
        track,
        midiChannel,
        playingParts,
        playingControlChanges,
        midi.header.ppq,
        inpaintingRegion,
        doNotClearExisting
      )
      // if (true || !playingParts.has(midiChannel)) {
      //   console.log('creating playing part')
      //   this.scheduleTrackToInstrument(
      //     track,
      //     midiChannel,
      //     playingParts,
      //     playingControlChanges,
      //     BPM,
      //     inpaintingRegion
      //   )
      // }
    })

    // change Transport BPM back to the displayed value
    // FIXME(theis): if this.bpmControl.value is a floor'ed value, this is wrong
    // this.transport.bpm.value = this.bpmControl.value

    // this.switchTracks()
  }

  scheduleChordsPlayer(
    midiChannel: number,
    inpainter: SheetInpainterGraphicalView
  ): void {
    throw new Error('Update to use ticks based timing')
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

class PianoRollPlaybackManager extends MidiSheetPlaybackManager<PiaInpainter> {
  constructor(
    inpainter: InpainterT,
    bpmControl: BPMControl,
    useChordsInstrument: boolean
    // pianoRollInpainterGraphicalView: PianoRollInpainterGraphicalView
  ) {
    super(inpainter, bpmControl, false)
  }
}
