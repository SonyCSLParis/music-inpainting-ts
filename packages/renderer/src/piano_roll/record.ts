import * as ControlLabels from '../controlLabels'
import { PiaInpainter } from './pianoRollInpainter'
import { BPMControl } from '../numberControl'
import * as MidiIn from '../midiIn'

import {
  Recorder,
  BaseRecorderCallback,
} from '@magenta/music/esm/core/recorder'
import { Metronome } from '@magenta/music/esm/core/metronome'
import { NoteSequence } from '@magenta/music/es6/protobuf'
import { ToneMidiInput } from '../midi_io/midiInput'
import { pianorollify } from './interactivePianoRollVisualizer'
import { NoSpecialKeysAudioKeys } from '../audiokeys/focusedAudiokeys'
import * as Instruments from '../../instruments/instruments'
import { PlaybackManager } from '../playback'
import { Inpainter } from '../inpainter/inpainter'
import { PianoRollInpainterGraphicalView } from './pianoRollInpainterGraphicalView'
import type { VisualizerConfig } from '@magenta/music/esm/core/visualizer'
import { Midi } from '@tonaljs/tonal'

//@ts-expect-error
export class FixedRecorder extends Recorder {
  inpainter: Inpainter | null = null

  // fixes a bug in mm.Recorder not accessing the correct value for
  // `startRecordingAtFirstNote`
  get startRecordingAtFirstNote(): boolean {
    //@ts-expect-error
    return this.config.startRecordingAtFirstNote
  }

  set startRecordingAtFirstNote(startRecordingAtFirstNote: boolean) {
    //@ts-expect-error
    this.config.startRecordingAtFirstNote = startRecordingAtFirstNote
  }

  noteOn(pitch: number, velocity: number, timeStamp: number) {
    super.noteOn(pitch, velocity, timeStamp)
    this.inpainter?.emit('grow-note', this.onNotes.get(pitch))
  }
  noteOff(pitch: number, velocity: number, timeStamp: number) {
    super.noteOff(pitch, timeStamp)
  }
}

export class DesktopKeyboardEnabledRecorder extends FixedRecorder {
  readonly desktopKeyboard = new NoSpecialKeysAudioKeys({
    polyphony: Infinity,
    rows: 2,
    rootNote: 60,
    layoutIndependentMapping: true,
  })

  async initialize(): Promise<void> {
    await super.initialize()
    this.desktopKeyboard.down((note) => {
      if (this.isRecording()) {
        const noteName = Midi.midiToNoteName(note.note)
        Instruments.keyDown(noteName, note.velocity / 127)

        if (this.firstNoteTimestamp == undefined) {
          this.firstNoteTimestamp = performance.now()
        }
        this.noteOn(note.note, note.velocity, performance.now())
      }
    })
    this.desktopKeyboard.up((note) => {
      if (this.isRecording()) {
        const noteName = Midi.midiToNoteName(note.note)
        Instruments.keyUp(noteName, note.velocity / 127)

        this.noteOff(note.note, note.velocity, performance.now())
        if (this.callbackObject && this.callbackObject.run) {
          this.callbackObject.run(this.getNoteSequence())
        }
      }
    })
  }
}

export class MyCallback extends BaseRecorderCallback {
  protected readonly inpainter: PiaInpainter
  protected previousLength: number = 0

  constructor(inpainter: PiaInpainter) {
    super()
    this.inpainter = inpainter
  }

  run(noteSequence: NoteSequence): void {
    if (noteSequence == null) {
      return
    }
    noteSequence.totalTime = 60
    const newNote = noteSequence.notes[noteSequence.notes.length - 1]
    if (
      newNote.startTime == null ||
      newNote.startTime > noteSequence.totalTime
    ) {
      return
    }
    noteSequence.tempos = [{ time: 0, qpm: this.inpainter.tempo }]
    noteSequence.ticksPerQuarter = this.inpainter.PPQ
    this.inpainter.addNewNotesStepByStep([newNote], 10, false, false)
    this.previousLength = noteSequence.notes.length
  }

  noteOn(pitch: number, velocity: number, device: EventTarget): void {}

  noteOff(pitch: number, velocity: number, device: EventTarget): void {}
}

export class MidiRecorder {
  static readyForRecordingClasses: string[] = [
    'record-button--ready-for-recording',
  ]
  static recordingClasses: string[] = ['record-button--recording']
  static waitingClass: string = 'record-button--waiting'
  static spinningClass = 'fa-spin'

  protected readonly recorder: FixedRecorder
  protected readonly inpainter: PiaInpainter
  protected readonly playbackManager: PlaybackManager
  protected readonly inpainterGraphicalView: PianoRollInpainterGraphicalView
  protected previousInpainterGraphicalViewConfig?: VisualizerConfig
  protected midiInputListener?: ToneMidiInput

  protected metronome?: Metronome
  protected readonly bpmControl?: BPMControl

  protected parent: HTMLElement | null = null
  protected container: HTMLElement | null = null
  protected interfaceContainer: HTMLElement | null = null
  protected interface: HTMLElement | null = null

  constructor(
    recorder: DesktopKeyboardEnabledRecorder,
    inpainter: PiaInpainter,
    inpainterGraphicalView: PianoRollInpainterGraphicalView,
    playbackManager: PlaybackManager,
    metronome?: Metronome,
    bpmControl?: BPMControl
  ) {
    this.recorder = recorder
    this.inpainter = inpainter
    this.inpainterGraphicalView = inpainterGraphicalView
    this.playbackManager = playbackManager
    this.metronome = metronome
    this.bpmControl = bpmControl

    if (this.bpmControl != null) {
      this.bpmControl.on('interface-tempo-changed', (bpm: number) => {
        this.recorder.setTempo(bpm)
      })
    }
  }

  async render(parent: HTMLElement) {
    this.parent = parent
    this.parent.classList.add('advanced')

    const midiInputListener = await MidiIn.getMidiInputListener()
    if (midiInputListener == null) {
      return
    }
    this.midiInputListener = midiInputListener
    this.midiInputListener?.on('keyDown', (e) => {
      Instruments.keyDown(e.note, e.velocity)
    })
    this.midiInputListener?.on('keyUp', (e) => {
      Instruments.keyUp(e.note, e.velocity)
    })

    this.container = document.createElement('div')
    this.container.classList.add('record-controls-container')
    this.container.classList.add('control-item')
    parent.appendChild(this.container)

    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.classList.add('record-button-container')
    this.interfaceContainer.classList.add('control-item')
    this.container.appendChild(this.interfaceContainer)

    ControlLabels.createLabel(
      this.interfaceContainer,
      'record-button-label',
      false,
      undefined,
      parent
    )

    this.interface = document.createElement('i')
    this.interface.classList.add('record-button-interface')
    this.interfaceContainer.appendChild(this.interface)

    this.setWaitingClass()
    this.recorder.initialize().then(() => {
      this.unsetWaitingClass()
      this.setRecordingClass(false)
    })
    this.interface.addEventListener('click', async () => {
      await this.toggleRecording()
    })
  }

  protected setWaitingClass(): void {
    if (this.interface == null) {
      return
    }
    // Replace the playback icon with a rotating 'wait' icon until
    // playback state correctly updated
    this.interface.classList.add(MidiRecorder.waitingClass)
    this.interface.classList.remove(
      ...MidiRecorder.recordingClasses,
      ...MidiRecorder.readyForRecordingClasses
    )
    this.interface.classList.add(MidiRecorder.spinningClass)
  }

  protected unsetWaitingClass(): void {
    if (this.interface == null) {
      return
    }
    // Remove rotating 'wait' icon
    this.interface.classList.remove(MidiRecorder.waitingClass)
    this.interface.classList.remove(MidiRecorder.spinningClass)
  }

  protected setRecordingClass(isRecording: boolean) {
    if (this.interfaceContainer == null || this.interface == null) {
      return
    }
    // Update Play/Stop CSS classes
    if (isRecording) {
      this.interface.classList.add(...MidiRecorder.recordingClasses)
      this.interface.classList.remove(...MidiRecorder.readyForRecordingClasses)

      // updates interface colors
      this.interfaceContainer.classList.add('active')
    } else {
      this.interface.classList.add(...MidiRecorder.readyForRecordingClasses)
      this.interface.classList.remove(...MidiRecorder.recordingClasses)

      // updates interface colors
      this.interfaceContainer.classList.remove('active')
    }
    this.unsetWaitingClass()
  }

  async toggleRecording(): Promise<void> {
    if (!this.recorder.isRecording()) {
      await this.startRecording()
    } else {
      await this.stopRecording()
    }
  }

  async startRecording(): Promise<void> {
    const startTime =
      (this.playbackManager.transport.toSeconds(
        this.playbackManager.transport.position
      ) /
        this.playbackManager.transport.bpm.value) *
      60
    await this.playbackManager.disable()
    this.recorder.callbackObject.previousLength = 0
    console.log(this.midiInputListener?.deviceId)
    console.log(this.recorder.getMIDIInputs())
    this.inpainter.clear()

    this.previousInpainterGraphicalViewConfig = {
      ...this.inpainterGraphicalView.visualizer._config,
    }
    this.inpainterGraphicalView.visualizer._config.minPitch = 0
    this.inpainterGraphicalView.visualizer._config.maxPitch = 127

    this.recorder.start(
      this.recorder
        .getMIDIInputs()
        .filter(
          (midiInput) =>
            this.midiInputListener?.deviceId == 'all' ||
            midiInput.id == this.midiInputListener?.deviceId
        )
    )
    this.setRecordingClass(true)
  }

  async stopRecording(): Promise<void> {
    this.recorder.stop()
    this.inpainterGraphicalView.visualizer._config =
      this.previousInpainterGraphicalViewConfig

    let recordedNoteSequence = this.recorder.getNoteSequence()
    if (recordedNoteSequence != null) {
      recordedNoteSequence = pianorollify(recordedNoteSequence)
      recordedNoteSequence.ticksPerQuarter = this.inpainter.PPQ
      recordedNoteSequence.notes = Array.from(
        new Set(recordedNoteSequence.notes)
      )
      recordedNoteSequence.tempos = [{ time: 0, qpm: this.inpainter.tempo }]
      this.inpainter.updateNoteSequence(recordedNoteSequence)
    }

    await this.playbackManager.enable()
    this.setRecordingClass(false)
  }
}
