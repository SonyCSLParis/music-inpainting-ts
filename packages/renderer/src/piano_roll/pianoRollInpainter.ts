import { Midi } from '@tonejs/midi'
import * as Tone from 'tone'
import log from 'loglevel'
import {
  UndoableInpainter,
  UndoableInpainterEdit,
} from '../inpainter/inpainter'
import { PiaAPIManager, PiaData, PiaNoteData } from './piaAPI'

import SonyCslLogoNoTextUrl from '../../static/icons/logos/sonycsl-logo-no_text.svg'

// import { ValueStart, ValueEnd } from './ButtonsTimer'
import {
  extractSelectedRegion,
  pianorollify,
} from './interactivePianoRollVisualizer'
import { INoteSequence, NoteSequence } from '@magenta/music/es6/protobuf'
import {
  midiToSequenceProto,
  sequenceProtoToMidi,
} from '@magenta/music/esm/core/midi_io'
import { OnsetsAndFrames } from '@magenta/music/es6/transcription'
import * as mm_sequences from '@magenta/music/esm/core/sequences'

import { UndoManager } from 'typed-undo'
import { Note } from '@tonejs/midi/dist/Note'
import { Midi as TonalMidi } from '@tonaljs/tonal'

// TODO(@tbazin, 2022/08/10): clean this up
export interface PianoRollData {
  noteSequence: NoteSequence
  midi: Midi
  newNotes?: NoteSequence
  inpaintingRegionTicks?: [number, number]
  partialUpdate?: boolean
  durationTicks?: number
  removeNotes?: NoteSequence.Note[]
}

export class UndoablePiaEdit extends UndoableInpainterEdit<PianoRollData> {
  protected declare readonly type: 'clear-region' | 'validate' | undefined

  replace(oldEdit: UndoablePiaEdit): boolean {
    if (
      (oldEdit.type == 'clear-region' && this.type == 'validate') ||
      (oldEdit.type?.startsWith('clear') && this.type?.startsWith('clear'))
    ) {
      this.oldValue = oldEdit.oldValue
      return true
    }
    return false
  }
}

export class PiaInpainter extends UndoableInpainter<
  PianoRollData,
  never,
  NoteSequence.Note,
  UndoablePiaEdit
> {
  readonly apiManager: PiaAPIManager

  protected createUndoableEdit(
    previousValue: PianoRollData,
    newValue: PianoRollData,
    canBeMerged: boolean,
    type?: 'clear-region' | 'validate' | undefined
  ): UndoablePiaEdit {
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
      canBeMerged,
      type
    )
  }

  get noteSequence(): NoteSequence {
    return this.value.noteSequence
  }

  constructor(
    apiManager: PiaAPIManager,
    defaultApiAddress: URL,
    undoManager: UndoManager,
    forceDuration_ticks?: number
  ) {
    super(defaultApiAddress, undoManager, UndoablePiaEdit)
    this.apiManager = apiManager
    this.forceDuration_ticks = forceDuration_ticks
  }

  protected get forceDuration_seconds(): number | undefined {
    return this.forceDuration_ticks != undefined
      ? this.forceDuration_ticks / this.PPQ / (this.referenceBPM / 60)
      : undefined
  }

  readonly referenceBPM: number = 120
  readonly forceDuration_ticks: number | undefined
  static readonly PPQ: number = 5 * 192
  get PPQ() {
    return PiaInpainter.PPQ
  }

  protected onUndo(): void {
    if (this.isInRequest) {
      // if (this.undoManager.canUndo()) {
      //   // FIXME(@tbazin, 2022/09/02)
      //   this.undoManager.pop()
      // }
      if (
        this.undoManager.edits.length == 1 &&
        this.undoManager.edits[0].type == 'clear-region'
      ) {
        this.undoManager.pop()
      }
    }

    this.abortCurrentRequests()
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
  protected async abortCurrentRequests(
    undoLastChanges: boolean = true
  ): Promise<void> {
    this.abortController.abort()
    this.abortNoteByNoteUpdate()

    this.abortController = this.createAbortController()
  }
  protected isInRequest: boolean = false

  protected static async delay(delay: number): Promise<void> {
    return new Promise((vars) => setTimeout(vars, delay))
  }

  protected resizeSelectedRegionEnd(
    regionEndQuarters: number
  ): [number, number] {
    const sortedNotes = this.noteSequence.notes
      .filter((note) => note.startTime != undefined)
      .sort((a, b) => a.startTime ?? 0 - (b.startTime ?? 0))
    const firstIndexAfterRegion = sortedNotes.findIndex(
      (note) => note.startTime != null && note.startTime > regionEndQuarters
    )
    if (firstIndexAfterRegion > 0) {
      const startTimeOfLastNoteInRegion =
        sortedNotes[firstIndexAfterRegion - 1].startTime
      return [
        startTimeOfLastNoteInRegion as number,
        sortedNotes[firstIndexAfterRegion].startTime as number,
      ]
    } else if (firstIndexAfterRegion == 0) {
      return [
        regionEndQuarters,
        sortedNotes[firstIndexAfterRegion].startTime as number,
      ]
    } else {
      return [regionEndQuarters, regionEndQuarters]
    }
  }

  protected moveSelectionToTime(
    selection: NoteSequence.Note[],
    newTimeOfFirstEvent: number
  ): void {
    const timeOfFirstEvent = Math.min(
      ...selection
        .filter((note) => note.startTime != undefined)
        .map((note) => note.startTime)
    )
    const offset = newTimeOfFirstEvent - timeOfFirstEvent
    // const movedNotes = selection.map(note => {return {
    //   ...note,
    //   startTime: note.startTime + offset
    // }})
    this.emit('move', selection, offset)
  }

  protected async inpaintRegion(
    regionStartQuarters: number,
    regionEndQuarters: number
  ): Promise<this> {
    if (this.isInRequest) {
      await this.abortCurrentRequests()
    }
    // const [updatedRegionEndQuarters, displayRegionEndQuarter] =
    //   this.resizeSelectedRegionEnd(regionEndQuarters)
    // regionEndQuarters = updatedRegionEndQuarters
    // regionStartQuarters = Math.floor(regionStartQuarters)
    // regionEndQuarters = Math.ceil(regionEndQuarters)
    const regionTicks = [regionStartQuarters, regionEndQuarters].map((time) =>
      Math.round((time / 60) * this.noteSequence.ticksPerQuarter * this.tempo)
    )
    this.emit(
      'busy',
      regionStartQuarters,
      regionEndQuarters
      // displayRegionEndQuarter
    )
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

    if (initialNotesAfterRegion.length > 0) {
      regionEndQuarters = Math.min(
        regionEndQuarters,
        regionStartQuarters + (0.2 * this.noteSequence.ticksPerQuarter) / 192
      )
    }
    const piaInputData_json = this.apiManager.noteSequenceToPiaJSON(
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
    let inpaintedNoteSequence: INoteSequence | null = null

    const triggerNewRequest: (
      requestOptions: RequestInit
    ) => Promise<Response | undefined> = async (
      requestOptions: RequestInit
    ) => {
      this.emit('busy')
      try {
        const response = this.fetch(
          this.defaultApiAddress.href,
          requestOptions,
          [this.abortController.signal]
        )
        return response
      } catch (e) {
        console.error(e)
        throw e
      }
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
    ): NoteSequence.Note[] {
      if (initialNotesBeforeRegion.length > 0 && incomingNotes.length > 0) {
        const lastNotePrevious =
          initialNotesBeforeRegion[initialNotesBeforeRegion.length - 1]
        const firstNoteIncoming = incomingNotes[0]
        if (
          lastNotePrevious.pitch == firstNoteIncoming.pitch &&
          lastNotePrevious.startTime != null &&
          lastNotePrevious.endTime != null &&
          Math.abs(lastNotePrevious.startTime - firstNoteIncoming.startTime) <
            0.1
        ) {
          return incomingNotes.slice(1)
        }
      }
      return incomingNotes
    }

    const handleNewNotes: (
      response: Response | undefined
    ) => Promise<this | undefined> = async (response: Response | undefined) => {
      if (response == undefined) {
        throw new Error('Response is undefined')
      }
      if (!response.ok) {
        throw new Error('API Request failed with error: ', response.statusText)
      }
      const responseJSON = await response.json()
      const newNotesPia: PiaNoteData[] | undefined = responseJSON.notes_region
      if (newNotesPia == undefined) {
        throw Error('API Error')
      }
      let incomingNotes = newNotesPia
        .map((note) => this.apiManager.convertPiaNoteToNoteSequenceNote(note))
        .map((note) => ({
          ...note,
          instrument: 0,
          // HACK(@tbazin, 2022/09/13): distinguish generated notes from loaded ones by setting program to 1
          program: 1,
        }))
      if (isFirstRequest) {
        // HACK(@tbazin, 2022/09/02): patches a weird behaviour in the PIA API
        isFirstRequest = false
        incomingNotes = removePotentialDuplicateFirstNote(incomingNotes)
      }
      this.addNewNotesStepByStep(incomingNotes)
      notesResult.push(...incomingNotes)

      const currentNoteSequence = makeCurrentInpaintedNoteSequence(responseJSON)
      const isDone =
        responseJSON.done ||
        // TODO(@tbazin, 2022/09/09): move this request validity check higher in the callchain
        Math.abs(
          responseJSON.selected_region.start - responseJSON.selected_region.end
        ) < 0.2
      if (!isDone) {
        // we are not done yet, schedule next request
        // update the request for the next chunk
        responseJSON.case = 'continue'
        requestOptions.body = JSON.stringify(responseJSON)
        return triggerNewRequest(requestOptions).then(async (response) => {
          if (response == undefined) {
            return undefined
          }
          handleNewNotes(response)
        })
      } else {
        Promise.all(this.noteByNoteUpdatesPromises).then(() => {
          this.isInRequest = false
          this.emit('ready')
          this.updateNoteSequence(
            this.noteSequence,
            undefined,
            false,
            false,
            undefined,
            'validate'
          )
        })
        return this
      }
    }

    // launch the initial request
    return triggerNewRequest(requestOptions)
      .then(handleNewNotes)
      .catch((reason) => {
        log.error(reason)
        this.abortCurrentRequests(true)
        if (this.undoManager.canUndo()) {
          this.undoManager.undo()
          this.undoManager.pop()
        }
        this.emit('ready')
        return this
      })
  }

  protected addNote(
    note: NoteSequence.Note,
    scrollIntoView: boolean | 'forward' = false,
    reveal = true
  ): void {
    const currentNoteSequence = this.noteSequence
    const isDuplicate =
      currentNoteSequence.notes.find((value) => value == note) != null
    currentNoteSequence.notes.push(note)
    // TODO(@tbazin, 2022/09/02): not very efficient, should simply insert at proper index
    currentNoteSequence.notes.sort(
      (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
    )
    const newNoteSequence = new NoteSequence({
      ...currentNoteSequence.toJSON(),
    })
    this.updateNoteSequence(newNoteSequence, undefined, true, true)
    const piaNoteData =
      this.apiManager.convertNoteSequenceNoteToPiaNoteObject(note)
    const ticks = Math.round(
      (piaNoteData.time / 60) * this.noteSequence.ticksPerQuarter * this.tempo
    )
    const durationTicks = Math.round(
      (piaNoteData.duration / 60) *
        this.noteSequence.ticksPerQuarter *
        this.tempo
    )
    const midiNote = {
      name: TonalMidi.midiToNoteName(note.pitch),
      ticks: ticks,
      duration: piaNoteData?.duration,
      durationTicks: durationTicks,
      velocity: note.velocity / 127,
    }
    if (scrollIntoView == 'forward') {
      scrollIntoView =
        newNoteSequence.notes[newNoteSequence.notes.length - 1].startTime ==
        note.startTime
    }
    this.emit(
      'atomicAdd',
      note,
      midiNote,
      1,
      currentNoteSequence.ticksPerQuarter,
      scrollIntoView,
      reveal
    )
  }

  async addNewNotesStepByStep(
    newNotes: NoteSequence.Note[],
    delay: number = 100,
    scrollIntoView: boolean | 'forward' = false,
    reveal = true
  ): Promise<void> {
    const numPromises = this.noteByNoteUpdatesPromises.length
    const addNotes = new Promise<void>(async (resolve, reject) => {
      let rejected = false
      this.noteByNoteUpdateAbortController.signal.addEventListener(
        'abort',
        () => {
          rejected = true
          reject()
        }
      )
      try {
        await Promise.all(this.noteByNoteUpdatesPromises.slice(0, numPromises))
        for (let index = 0; index < newNotes.length; index++) {
          if (rejected) {
            reject()
            return
          }
          this.addNote(newNotes[index], scrollIntoView, reveal)
          await PiaInpainter.delay(delay)
        }
        resolve()
      } catch {
        console.log('Rejected')
        reject()
      }
    })
    this.noteByNoteUpdatesPromises.push(addNotes)
  }

  protected abortNoteByNoteUpdate() {
    this.noteByNoteUpdateAbortController.abort()
    this.noteByNoteUpdateAbortController = new AbortController()
    this.noteByNoteUpdatesPromises = []
    this.emit('ready')
  }
  protected noteByNoteUpdateAbortController = new AbortController()
  protected noteByNoteUpdatesPromises: Promise<void>[] = []

  protected defaultTimeout: number = 10000
  protected defaultExponentialBackoffDelay: number = 256

  async generate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout: number = 25000,
    apiAddress?: URL
  ): Promise<this> {
    this.abortCurrentRequests()
    this.clear()
    const generationDuration = 15
    return this.inpaintRegion(0, generationDuration, [
      0,
      generationDuration * 2 * this.PPQ,
    ])
  }

  readonly tempo: number = 120

  protected get valueAsJSONData(): Record<string, any> {
    return this.apiManager.noteSequenceToPiaJSON(
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
            note.startTime > regionTimestampsNotesequence[1])
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
      false,
      'clear-region'
    )
  }

  async updateNoteSequence(
    noteSequence: INoteSequence,
    newNotes?: NoteSequence,
    silent: boolean = false,
    canBeMerged: boolean = false,
    regionTimestampsTicks?: [number, number],
    editType?: 'validate' | 'clear-region' | null
  ): Promise<PianoRollData> {
    const midi = new Midi(sequenceProtoToMidi(noteSequence))
    const newData: PianoRollData = {
      noteSequence: noteSequence,
      midi: midi,
      newNotes: newNotes,
      partialUpdate: canBeMerged,
      inpaintingRegionTicks: regionTimestampsTicks,
    }
    this.setValueInteractive(newData, silent, canBeMerged, editType)
    return newData
  }

  protected async updateMidi(
    midi: Midi,
    silent: boolean = false,
    canBeMerged: boolean = false,
    editType?: 'validate' | 'clear-region'
  ): Promise<PianoRollData> {
    const noteSequence = midiToSequenceProto(midi.toArray())
    const newData = { noteSequence: noteSequence, midi: midi }
    this.setValueInteractive(newData, silent, canBeMerged, editType)
    return newData
  }

  protected flattenTempoChanges(midi: Midi): Midi {
    const newMidi = midi.clone()

    const tracks = newMidi.tracks
    const newHeaderJSON = {
      ...newMidi.header.toJSON(),
      ppq: this.PPQ,
    }
    newMidi.header.fromJSON(newHeaderJSON)
    newMidi.header.update()

    newMidi.tracks = tracks
      .filter((track) => track.notes.length > 0)
      .map((track) => {
        track.notes = track.notes.map((note) => {
          const bpm = 120
          const beatsPerSecond = bpm / 60
          const ticksPerSeconds = beatsPerSecond * this.PPQ
          const startTicksAtConstant120BPM = Math.round(
            midi.header.ticksToSeconds(note.ticks) * ticksPerSeconds
          )
          const endTicksAtConstant120BPM = Math.round(
            midi.header.ticksToSeconds(note.ticks + note.durationTicks) *
              ticksPerSeconds
          )
          const noteRetempo = new Note(
            {
              midi: note.midi,
              ticks: startTicksAtConstant120BPM,
              velocity: note.velocity,
            },
            { ticks: endTicksAtConstant120BPM, velocity: note.noteOffVelocity },
            newMidi.header
          )
          return noteRetempo
        })
        return track
      })
    newMidi.header.tempos = [{ bpm: this.tempo, ticks: 0 }]
    newMidi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }]
    newMidi.header.update()
    return newMidi
  }

  protected static normalizeVelocity(
    notes: Note[],
    targetMeanVelocity: number
  ): Note[] {
    const sumVelocities = notes.reduce((acc, note) => acc + note.velocity, 0)
    const meanVelocity = sumVelocities / notes.length
    const normalizedVelocity = notes.map((note) => {
      note.velocity = Math.max(
        0,
        Math.min(1, (note.velocity * targetMeanVelocity) / meanVelocity)
      )
      return note
    })
    return normalizedVelocity
  }

  protected static normalizeVelocityPerTrack(
    midi: Midi,
    targetMeanVelocity: number
  ): Midi {
    midi.tracks.forEach((track, index) => {
      const normalized = PiaInpainter.normalizeVelocity(
        track.notes,
        targetMeanVelocity
      )
      midi.tracks[index].notes = normalized
    })
    return midi
  }

  // protected eraseMidiTimeSignaturesAndTempo(midi: Midi): Midi {
  //   const newMidi = midi.clone()
  //   newMidi.header.tempos = [{ bpm: 120, time: 0, ticks: 0 }]
  //   newMidi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }]
  //   return newMidi
  // }

  // protected eraseMidiTimeSignaturesAndTempoNoteSequence(
  //   noteSequence: NoteSequence
  // ): NoteSequence {
  //   return new NoteSequence({
  //     ...noteSequence.toJSON(),
  //     tempos: [noteSequence.tempos[0]],
  //     timeSignatures: [noteSequence.timeSignatures[0]],
  //   })
  // }

  protected loadMidi(midiInit: Midi, silent: boolean = false) {
    midiInit = this.flattenTempoChanges(midiInit)

    const forceDuration_secondsNoteSequence = this.forceDuration_ticks
      ? midiInit.header.ticksToSeconds(
          (this.forceDuration_ticks / this.PPQ) * midiInit.header.ppq
        )
      : undefined
    console.log(
      'forceDuration_secondsNoteSequence: ',
      forceDuration_secondsNoteSequence
    )
    const noteSequence = pianorollify(
      midiToSequenceProto(midiInit.toArray()),
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
    return this
  }

  protected async loadMidiFile(
    midiFile: File,
    silent: boolean = false
  ): Promise<this> {
    let midiInit = new Midi(await midiFile.arrayBuffer())
    return this.loadMidi(midiInit)
  }

  async loadFile(
    file: File,
    queryParameters: string[],
    silent: boolean = false
  ): Promise<this> {
    super.loadFile(file, queryParameters, silent)
    this.abortCurrentRequests()
    this.emit('busy')
    const midiExtensions = ['mid', 'midi']
    const ext = file.name.split('.').at(-1)
    if (ext == undefined) {
      this.emit('ready')
      return this
    }

    if (midiExtensions.includes(ext)) {
      this.loadMidiFile(file, silent)
      this.emit('ready')
    } else {
      // try to load as an audio file
      this.loadAudioFile(file)
    }

    return this
  }

  async loadFromUrl(
    url: string,
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    const midiFile = new File(
      [(await Midi.fromUrl(url)).toArray()],
      url.split('/').at(-1) ?? 'midi.mid'
    )
    return this.loadFile(midiFile, queryParameters, silent)
  }

  protected audioToMidiTranscriptionModel?: OnsetsAndFrames | null = null

  protected async getAudioToMidiTranscriptionModel(): Promise<OnsetsAndFrames> {
    if (this.audioToMidiTranscriptionModel != null) {
      return this.audioToMidiTranscriptionModel
    }
    const onsetsAndFrames = new OnsetsAndFrames(
      'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni'
    )
    await onsetsAndFrames.initialize()
    this.audioToMidiTranscriptionModel = onsetsAndFrames
    return this.audioToMidiTranscriptionModel
  }

  async loadAudioFile(blob: Blob | File): Promise<this> {
    this.emit('busy')
    const audioContext = new AudioContext()
    const audioBuffer = await audioContext.decodeAudioData(
      await blob.arrayBuffer()
    )
    const onsetsAndFrames = await this.getAudioToMidiTranscriptionModel()
    const noteSequence = await onsetsAndFrames.transcribeFromAudioBuffer(
      audioBuffer,
      12
    )
    const midi = new Midi(sequenceProtoToMidi(noteSequence))
    this.loadMidi(midi, false)
    this.emit('ready')
    return this
  }

  protected makeEmptyNoteSequence(): NoteSequence {
    return new NoteSequence({
      ticksPerQuarter: this.PPQ,
      notes: [],
      totalTime: this.forceDuration_seconds,
      tempos: [{ time: 0, qpm: this.tempo }],
    })
  }

  clear(noEdit = false) {
    this.emit('busy')
    this.emit('clear')
    this.abortCurrentRequests()
    this.updateNoteSequence(
      this.makeEmptyNoteSequence(),
      undefined,
      false,
      false,
      undefined,
      noEdit ? null : 'clear'
    )
    this.emit('ready')
  }

  async dummyGenerate(
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    this.clear()
    return this
  }

  // TODO(@tbazin, 2022/09/29): create a proper status checking method on the API
  // rather than using this approach, since it creates some load on the backend
  static async testAPI(apiAdress: URL): Promise<boolean> {
    const apiManager = new PiaAPIManager()
    const undoManager = new UndoManager()
    const testInpainter = new PiaInpainter(apiManager, apiAdress, undoManager)
    const dummyNoteSequence = new NoteSequence()
    const dummyPiaJSON = apiManager.noteSequenceToPiaJSON(
      dummyNoteSequence,
      0,
      1
    )
    const requestOptions = {
      crossDomain: true,
      method: 'POST',
      body: JSON.stringify(dummyPiaJSON),
    }
    const response = await testInpainter.fetch(
      apiAdress.href,
      requestOptions,
      [],
      undefined,
      undefined,
      null
    )
    return response != undefined && response.ok
  }
}
