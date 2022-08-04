import { Midi } from '@tonejs/midi'
import * as Tone from 'tone'
import log from 'loglevel'
import {
  UndoableInpainter,
  UndoableInpainterEdit,
} from '../inpainter/inpainter'

// import { ValueStart, ValueEnd } from './ButtonsTimer'
import {
  extractSelectedRegion,
  pianorollify,
} from './interactivePianoRollVisualizer'
import { NoteSequence, INoteSequence } from '@magenta/music/es6/protobuf'
import {
  midiToSequenceProto,
  sequenceProtoToMidi,
} from '@magenta/music/esm/core/midi_io'
import * as mm_sequences from '@magenta/music/esm/core/sequences'

import './MusicApi.scss'
import {
  convertPiaNoteToNoteSequenceNote,
  noteSequenceToPiaJSON,
  PiaData,
  PiaNoteData,
} from './piaAPI'
import { UndoManager } from 'typed-undo'
import { Note } from '@tonejs/midi/dist/Note'

export interface PianoRollData {
  noteSequence: NoteSequence
  midi: Midi
  newNotes?: NoteSequence
  inpaintingRegionTicks?: [number, number]
  partialUpdate?: boolean
  durationTicks?: number
}

export class PiaInpainter extends UndoableInpainter<PianoRollData> {
  protected createUndoableEdit(
    previousValue: PianoRollData,
    newValue: PianoRollData,
    canBeMerged: boolean
  ): UndoableInpainterEdit<PianoRollData> {
    const previousValueCopy = {
      ...previousValue,
    }
    const newValueCopy = {
      ...newValue,
    }
    previousValueCopy.newNotes = newValueCopy.newNotes = undefined
    previousValueCopy.inpaintingRegionTicks =
      newValueCopy.inpaintingRegionTicks = undefined
    return super.createUndoableEdit(
      previousValueCopy,
      newValueCopy,
      canBeMerged
    )
  }

  get noteSequence(): NoteSequence {
    return this.value.noteSequence
  }

  constructor(
    defaultApiAddress: URL,
    undoManager: UndoManager,
    forceDuration_ticks?: number
  ) {
    super(defaultApiAddress, undoManager)
    this.forceDuration_ticks = forceDuration_ticks
  }

  protected get forceDuration_seconds(): number | undefined {
    return this.forceDuration_ticks != undefined
      ? this.forceDuration_ticks / this.PPQ / (this.referenceBPM / 60)
      : undefined
  }

  readonly referenceBPM: number = 120
  readonly forceDuration_ticks: number | undefined
  static readonly PPQ: number = 192
  get PPQ() {
    return PiaInpainter.PPQ
  }

  protected onUndo(): void {
    this.abortCurrentRequests(false)
    this.emit('ready')
  }

  protected async apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<PianoRollData> {
    throw Error('Not implemented')
  }

  protected abortController: AbortController = this.createAbortController()

  protected createAbortController(): AbortController {
    const abortController = new AbortController()
    abortController.signal.addEventListener('abort', () => {
      this.emit('ready')
      this.isInRequest = false
    })
    return abortController
  }
  protected async abortCurrentRequests(undoLastChanges: boolean = true): void {
    this.abortController.abort()
    if (undoLastChanges && this.undoManager.canUndo()) {
      this.undoManager.undo()
      this.undoManager.pop()
      await PiaInpainter.delay(50)
    }
    this.abortController = this.createAbortController()
  }
  protected isInRequest: boolean = false

  protected static async delay(delay: number): Promise<void> {
    return new Promise((vars) => setTimeout(vars, delay))
  }

  protected async _apiRequest(
    regionStartQuarters: number,
    regionEndQuarters: number,
    regionTicks: [number, number]
  ): Promise<NoteSequence> {
    if (this.isInRequest) {
      await this.abortCurrentRequests()
    }
    this.emit('busy')
    this.isInRequest = true
    // ;[regionStartQuarters, regionEndQuarters] = regionTicks.map((ticks) =>
    //   this.value.midi.header.ticksToSeconds(ticks)
    // )
    const [initialNotesBeforeRegion, selectedRegion, initialNotesAfterRegion] =
      extractSelectedRegion(
        this.noteSequence,
        regionStartQuarters,
        regionEndQuarters
      )
    this.clearRegion(regionTicks, selectedRegion)

    const piaInputData_json = noteSequenceToPiaJSON(
      this.noteSequence,
      regionStartQuarters,
      regionEndQuarters
    )
    // setting the infos we gonna send to the API
    let requestOptions = {
      crossDomain: true,
      method: 'POST',
      body: JSON.stringify(piaInputData_json),
    }
    let isFirstRequest = true
    console.log('Waiting....')

    let responseJSON: Partial<{
      case: 'continue' | 'start'
      notes_region: any[]
      done: boolean
      clip_end: number
    }> = {
      notes_region: [],
      done: false,
    }
    let notesResult: any[] = []
    let noteSequence_notes: NoteSequence.INote[] = []
    let inpaintedNoteSequence: NoteSequence | null = null

    const triggerNewRequest = async (requestOptions: RequestInit) => {
      this.emit('busy')
      requestOptions.signal = this.abortController.signal
      const response = fetch('https://pia.api.cslmusic.team/', requestOptions)
      return response
    }

    const makeCurrentInpaintedNoteSequence = (responseJSON: PiaData) => {
      noteSequence_notes = [
        ...initialNotesBeforeRegion,
        ...notesResult,
        ...initialNotesAfterRegion,
      ]
      const currentNoteSequence = this.noteSequence
      inpaintedNoteSequence = new NoteSequence({
        ...currentNoteSequence.toJSON(),
        notes: noteSequence_notes,
      })
      inpaintedNoteSequence = mm_sequences.trim(
        inpaintedNoteSequence,
        0,
        this.forceDuration_ticks
          ? this.value.midi.header.ticksToSeconds(
              (this.forceDuration_ticks / this.PPQ) * this.value.midi.header.ppq
            )
          : undefined ?? currentNoteSequence.totalTime,
        true
      )
      return inpaintedNoteSequence
    }

    function removePotentialDuplicateFirstNote(
      incomingNotes: NoteSequence.Note[]
    ) {
      if (initialNotesBeforeRegion.length > 0 && incomingNotes.length > 0) {
        const lastNotePrevious =
          initialNotesBeforeRegion[initialNotesBeforeRegion.length - 1]
        const firstNoteIncoming = incomingNotes[0]
        if (
          lastNotePrevious.pitch == firstNoteIncoming.pitch &&
          lastNotePrevious.startTime != null &&
          lastNotePrevious.endTime != null &&
          Math.abs(lastNotePrevious.startTime - firstNoteIncoming.startTime) <
            0.1 &&
          Math.abs(lastNotePrevious.endTime - firstNoteIncoming.endTime) < 0.1
        ) {
          incomingNotes.reverse().pop()
          incomingNotes.reverse()
        }
      }
    }

    const handleNewNotes: (
      response: Response
    ) => Promise<NoteSequence> = async (response: Response) => {
      const responseJSON = await response.json()
      const newNotesPia: PiaNoteData[] | undefined = responseJSON.notes_region
      if (newNotesPia == undefined) {
        throw Error('API Error')
      }
      const incomingNotes = newNotesPia
        .map(convertPiaNoteToNoteSequenceNote)
        .map((note) => ({ ...note, instrument: 1 }))
      if (isFirstRequest) {
        isFirstRequest = false
        removePotentialDuplicateFirstNote(incomingNotes)
      }
      notesResult.push(...incomingNotes)

      const currentNoteSequence = makeCurrentInpaintedNoteSequence(responseJSON)
      // trigger intermediate value update
      this.updateNoteSequence(
        currentNoteSequence,
        new NoteSequence({
          ...currentNoteSequence.toJSON(),
          notes: incomingNotes,
        }),
        false,
        !responseJSON.done,
        regionTicks
      )

      if (!responseJSON.done) {
        // we are not done yet, schedule next request
        // update the request for the next chunk
        responseJSON.case = 'continue'
        requestOptions.body = JSON.stringify(responseJSON)
        return triggerNewRequest(requestOptions).then(async (response) =>
          handleNewNotes(response)
        )
      } else {
        this.isInRequest = false
        return currentNoteSequence
      }
    }

    // launch the initial request
    return triggerNewRequest(requestOptions).then(handleNewNotes)
  }

  protected defaultTimeout: number = 10000
  protected defaultExponentialBackoffDelay: number = 256

  async generate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout: number = 25000,
    apiAddress?: URL
  ): Promise<this> {
    return super.generate(queryParameters, jsonData, timeout, apiAddress)
  }

  protected get valueAsJSONData(): Record<string, any> {
    return noteSequenceToPiaJSON(
      this.value.noteSequence,
      0,
      this.value.noteSequence.totalTime ?? 0
    )
  }

  protected clearRegion(
    regionTimestampsTicks: [number, number],
    selectedRegion: NoteSequence.Note[]
  ) {
    if (this.value.midi.header.ppq != this.value.noteSequence.ticksPerQuarter) {
      throw Error('Incoherent state')
    }
    const regionTimestampsNotesequence = regionTimestampsTicks.map((ticks) =>
      this.value.midi.header.ticksToSeconds(ticks)
    )
    console.log('regionTimestampsNotesequence', regionTimestampsNotesequence)

    const noteSequence = new NoteSequence({
      ...this.value.noteSequence.toJSON(),
      notes: this.value.noteSequence.notes.filter(
        (note) =>
          note.startTime != null &&
          (note.startTime < regionTimestampsNotesequence[0] ||
            note.startTime >= regionTimestampsNotesequence[1])
      ),
    })
    const midi = new Midi(sequenceProtoToMidi(noteSequence))
    this.setValueInteractive(
      {
        midi: midi,
        noteSequence: noteSequence,
        inpaintingRegionTicks: regionTimestampsTicks,
        removeNotes: selectedRegion,
      },
      false,
      true
    )
  }

  protected async updateNoteSequence(
    noteSequence: NoteSequence,
    newNotes?: NoteSequence,
    silent: boolean = true,
    canBeMerged: boolean = false,
    regionTimestampsTicks?: [number, number]
  ): Promise<PianoRollData> {
    const midi = new Midi(sequenceProtoToMidi(noteSequence))
    const newData: PianoRollData = {
      noteSequence: noteSequence,
      midi: midi,
      newNotes: newNotes,
      partialUpdate: canBeMerged,
      inpaintingRegionTicks: regionTimestampsTicks,
    }
    this.setValueInteractive(newData, silent, canBeMerged)
    return newData
  }
  protected async updateMidi(
    midi: Midi,
    silent: boolean = true,
    canBeMerged: boolean = false
  ): Promise<PianoRollData> {
    const noteSequence = midiToSequenceProto(midi.toArray())
    const newData = { noteSequence: noteSequence, midi: midi }
    this.setValueInteractive(newData, silent, canBeMerged)
    return newData
  }

  protected flattenTempoChanges(midi: Midi): Midi {
    const newMidi = midi.clone()
    const tracks = newMidi.tracks
    newMidi.tracks = tracks
      .filter((track) => track.notes.length > 0)
      .map((track) => {
        track.notes = track.notes.map((note) => {
          const startTicks = Math.round(
            midi.header.ticksToSeconds(note.ticks) * 2 * midi.header.ppq
          )
          const endTicks =
            startTicks +
            Math.round(
              midi.header.ticksToSeconds(note.durationTicks) *
                2 *
                midi.header.ppq
            )
          const noteRetempo = new Note(
            { midi: note.midi, ticks: startTicks, velocity: note.velocity },
            { ticks: endTicks, velocity: note.noteOffVelocity },
            midi.header
          )
          return noteRetempo
        })
        return track
      })

    newMidi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }]
    newMidi.header.tempos = [{ bpm: 120, time: 0, ticks: 0 }]
    // newMidi.header._ppq = this.PPQ
    return newMidi
    // return midi
  }

  protected eraseMidiTimeSignaturesAndTempo(midi: Midi): Midi {
    const newMidi = midi.clone()
    newMidi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }]
    newMidi.header.tempos = [{ bpm: 120, time: 0, ticks: 0 }]
    return newMidi
    // return midi
  }

  protected eraseMidiTimeSignaturesAndTempoNoteSequence(
    noteSequence: NoteSequence
  ): NoteSequence {
    return new NoteSequence({
      ...noteSequence.toJSON(),
      tempos: [noteSequence.tempos[0]],
      timeSignatures: [noteSequence.timeSignatures[0]],
    })
  }

  async loadFile(
    midiFile: File,
    queryParameters: string[],
    silent: boolean = true
  ): Promise<this> {
    this.emit('busy')
    const midiInitWithTempoChanges = this.flattenTempoChanges(
      new Midi(await midiFile.arrayBuffer())
    )
    const forceDuration_secondsNoteSequence = this.forceDuration_ticks
      ? midiInitWithTempoChanges.header.ticksToSeconds(
          (this.forceDuration_ticks / this.PPQ) *
            midiInitWithTempoChanges.header.ppq
        )
      : undefined
    console.log(
      'forceDuration_secondsNoteSequence: ',
      forceDuration_secondsNoteSequence
    )
    const noteSequence = pianorollify(
      midiToSequenceProto(midiInitWithTempoChanges.toArray()),
      forceDuration_secondsNoteSequence
    )
    // const noteSequence = mm_sequences.trim(
    //   midiToSequenceProto(midiInitWithTempoChanges.toArray()),
    //   0,
    //   forceDuration_secondsNoteSequence,
    //   true
    // )
    const midi = new Midi(sequenceProtoToMidi(noteSequence))

    this.setValueInteractive(
      {
        noteSequence: noteSequence,
        midi: midi,
      },
      silent
    )
    this.emit('ready')
    return this
  }

  async dummyGenerate(
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    const midiFile = new File(
      [
        (
          await Midi.fromUrl('./assets/mozart-symphony41-3-piano.mid')
        ).toArray(),
      ],
      'assets/mozart-symphony41-3-piano.mid'
    )
    return this.loadFile(midiFile, queryParameters, silent)
  }
}
