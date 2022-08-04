import { NoteSequence, INoteSequence } from '@magenta/music/es6/protobuf'
import { Note } from '@tonaljs/tonal'

export interface PiaNoteData {
  type: 'note' // must always add this field
  pitch: number
  time: number
  duration: number
  velocity: number
  muted: number
}

// parse notes as returned by the PIA API to NoteSequence format
export function convertPiaNoteToNoteSequenceNote(
  noteObject: PiaNoteData
): NoteSequence.Note {
  return new NoteSequence.Note({
    pitch: noteObject.pitch,
    velocity: noteObject.velocity,
    startTime: noteObject.time,
    endTime: noteObject.time + noteObject.duration,
  })
}

// parse note in NoteSequence format to the format returned by the PIA API
function convertNoteSequenceNoteToPiaNoteObject(
  note: NoteSequence.INote,
  defaultVelocity: number = 70
): PiaNoteData | null {
  if (
    note.startTime == null ||
    note.endTime == null ||
    note.velocity == null ||
    note.pitch == null
  ) {
    return null
  }
  return {
    type: 'note',
    pitch: note.pitch,
    velocity: note.velocity ?? defaultVelocity,
    time: note.startTime,
    duration: note.endTime - note.startTime,
    muted: 0,
  }
}

// flatten a single PIA note for the PIA input note format
function piaNoteObjectToFlattenedPiaNote(
  piaNoteObject: PiaNoteData
): (number | 'note')[] {
  return [
    'note',
    piaNoteObject.pitch,
    piaNoteObject.time,
    piaNoteObject.duration,
    piaNoteObject.velocity,
    piaNoteObject.muted,
  ]
}

// flatten a sequence of PIA notes to the PIA input format
function convertPiaNoteObjectsToPiaInput(
  piaNoteObjects: PiaNoteData[]
): (number | 'note' | 'notes')[] {
  const piaNotes = piaNoteObjects.map(piaNoteObjectToFlattenedPiaNote)
  return ['notes', piaNotes.length, ...piaNotes.flat()]
}

// convert notes in NoteSequence format to the PIA input format
export function convertNoteSequenceNotesToPiaInputNotes(noteSequence_notes) {
  const piaNoteObjects = noteSequence_notes.map((noteSequence_note) =>
    convertNoteSequenceNoteToPiaNoteObject(noteSequence_note)
  )
  return convertPiaNoteObjectsToPiaInput(piaNoteObjects)
}

interface CuePoints {
  start: number
  end: number
}

interface PiaHyperParameters {
  // these values are not relevant outside of Ableton Live,
  // you can safely keep these defaults
  id: number
  clip_id: number
  detail_clip_id: number

  note_density: number // usually keep this at 1
  top_p: number
  superconditioning: number // usually keep this at 1
  tempo: number // usually 120
}

type Case = 'start' | 'continue'

export interface PiaData extends PiaHyperParameters {
  case: Case

  clip_start: number // start time of the whole input sequence, usually 0
  clip_end: number // end/duration of the whole input sequence
  // cue-points for the specific zone to transform
  selected_region: CuePoints

  notes: ('notes' | 'note' | number)[] // all flattened!
}

const piaDefaultSettings: PiaHyperParameters = {
  id: 0,
  clip_id: 0,
  detail_clip_id: 0,
  note_density: 0.1,
  tempo: 120,
  top_p: 0.949999988079071,
  superconditioning: 1,
}

export function noteSequenceToPiaJSON(
  noteSequence: INoteSequence,
  clipStart: number,
  clipEnd: number
): PiaData {
  const DEFAULT_DURATION = 60
  const regionStart = clipStart
  const regionEnd = clipEnd

  // format loaded noteSequence to PIA input format
  const notes_piaInput = convertNoteSequenceNotesToPiaInputNotes(
    noteSequence.notes
  )

  // setup PIA API request data
  const piaInputData: PiaData = {
    ...piaDefaultSettings,
    case: 'start',
    clip_start: 0,
    clip_end: noteSequence.totalTime ?? DEFAULT_DURATION,
    selected_region: {
      start: regionStart,
      end: regionEnd,
    },
    notes: notes_piaInput,
  }
  return piaInputData
}
