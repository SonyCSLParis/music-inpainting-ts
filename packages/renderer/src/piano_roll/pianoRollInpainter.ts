import { Midi } from '@tonejs/midi'
import { UndoableInpainter } from '../inpainter/inpainter'

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

import './MusicApi.scss'
import {
  convertPiaNoteToNoteSequenceNote,
  noteSequenceToPiaJSON,
  PiaData,
} from './piaAPI'

export interface PianoRollData {
  noteSequence: NoteSequence
  midi: Midi
  newNotes?: NoteSequence.Note[]
}

export class PiaInpainter extends UndoableInpainter<PianoRollData> {
  get noteSequence(): NoteSequence {
    return this.value.noteSequence
  }

  protected async apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<PianoRollData> {
    return this.loadMusicXMLandMidi(httpMethod, href, timeout, requestBody)
  }

  protected abortController = new AbortController()

  protected async _apiRequest(
    regionStart: number,
    regionEnd: number
  ): Promise<NoteSequence> {
    this.abortController.abort()
    this.abortController = new AbortController()

    const [initialNotesBeforeRegion, , initialNotesAfterRegion] =
      extractSelectedRegion(this.noteSequence, regionStart, regionEnd)
    let noteSequence_contextOnly = new NoteSequence({
      notes: [...initialNotesBeforeRegion, ...initialNotesAfterRegion],
      totalTime: this.noteSequence.totalTime,
    })
    this.updateNoteSequence(noteSequence_contextOnly)

    const piaInputData_json = noteSequenceToPiaJSON(
      this.noteSequence,
      regionStart,
      regionEnd
    )
    // setting the infos we gonna send to the API
    let requestOptions = {
      crossDomain: true,
      method: 'POST',
      body: JSON.stringify(piaInputData_json),
    }

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
    const notesResult: any[] = []
    let noteSequence_notes: NoteSequence.INote[] = []
    let inpaintedNoteSequence: NoteSequence | null = null

    const triggerNewRequest = async (requestOptions: RequestInit) => {
      requestOptions.signal = this.abortController.signal
      const response = fetch('https://pia.api.cslmusic.team/', requestOptions)
      return response
    }

    function makeCurrentInpaintedNoteSequence(
      responseJSON: PiaData
    ): NoteSequence {
      noteSequence_notes = [
        ...initialNotesBeforeRegion,
        ...notesResult,
        ...initialNotesAfterRegion,
      ]
      inpaintedNoteSequence = new NoteSequence({
        notes: noteSequence_notes,
        totalTime: responseJSON.clip_end,
      })
      return inpaintedNoteSequence
    }

    const handleNewNotes: (
      response: Response
    ) => Promise<NoteSequence> = async (response: Response) => {
      const responseJSON = await response.json()
      // let promiseResult = new Promise<void>(() => {});
      const newNotesPia = responseJSON.notes_region
      if (newNotesPia == undefined) {
        throw Error('API Error')
      }
      const newNotesNoteSequence = newNotesPia.map(
        convertPiaNoteToNoteSequenceNote
      )
      notesResult.push(...newNotesNoteSequence)

      const currentNoteSequence = makeCurrentInpaintedNoteSequence(responseJSON)
      // trigger intermediate value update
      this.updateNoteSequence(currentNoteSequence, newNotesNoteSequence, false)

      if (!responseJSON.done) {
        // we are not done yet, schedule next request
        // update the request for the next chunk
        responseJSON.case = 'continue'
        requestOptions.body = JSON.stringify(responseJSON)
        return triggerNewRequest(requestOptions).then(async (response) =>
          handleNewNotes(response)
        )
      } else {
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

  protected async updateNoteSequence(
    noteSequence: NoteSequence,
    newNotes?: NoteSequence.Note[],
    silent: boolean = true
  ): Promise<PianoRollData> {
    const midi = new Midi(sequenceProtoToMidi(noteSequence))
    const newData = {
      noteSequence: noteSequence,
      midi: midi,
      newNotes: newNotes,
    }
    this.setValueInteractive(newData, silent)
    return newData
  }
  protected async updateMidi(
    midi: Midi,
    silent: boolean = true
  ): Promise<PianoRollData> {
    const noteSequence = midiToSequenceProto(midi.toArray())
    const newData = { noteSequence: noteSequence, midi: midi }
    this.setValueInteractive(newData, silent)
    return newData
  }

  async loadFile(
    midiFile: File,
    queryParameters: string[],
    silent: boolean = true
  ): Promise<this> {
    this.emit('busy')

    const midiArray = await midiFile.arrayBuffer()
    const noteSequence = pianorollify(midiToSequenceProto(midiArray))
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
    this.emit('busy')
    const dummyMidi = await Midi.fromUrl(
      './assets/mozart-symphony41-3-piano.mid'
    )
    await this.updateMidi(dummyMidi, silent)
    this.emit('ready')
    return this
  }
}
