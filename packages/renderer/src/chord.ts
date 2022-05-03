import * as Tonal from '@tonaljs/tonal'
import * as Tone from 'tone'

export const enum Note {
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
  A = 'A',
  B = 'B',
}

export const enum SlurSymbol {
  slur = '-',
}

export type NoteOrSlur = Note | SlurSymbol

export const enum Accidental {
  flat = 'b',
  sharp = '#',
}

export const enum ChordType {
  major = 'M',
  minor = 'm',
  minorSeventh = 'm7',
  majorSeventh = 'M7',
  seventh = '7',
}

export type Chord = {
  root: NoteOrSlur
  accidental: null | Accidental
  type: ChordType
}

function getMidiPitches(chord: Chord): number[] {
  const chordRoot =
    chord.accidental != null ? chord.root + chord.accidental : chord.root
  const tonalChord = Tonal.Chord.getChord(chordRoot + chord.type)
  const midiPitches = tonalChord.notes.map((note) => Tonal.Note.midi(note))
  return midiPitches
}

type NoteEvent = {
  midi: number
  name: string
  time: number
  duration: Tone.Unit.Time
  velocity: number
}

function makeNoteEvent(
  midi: number,
  time_ms: number,
  duration: Tone.TimeClass,
  velocity: number
): NoteEvent {
  return {
    midi: midi,
    name: Tonal.Midi.midiToNoteName(midi),
    time: time_ms,
    duration: duration.toSeconds(),
    velocity: velocity,
  }
}

export function makeNoteEvents(
  chord: Chord,
  time_ms: number,
  duration: Tone.TimeClass,
  velocity: number
): NoteEvent[] {
  const midiPitches = getMidiPitches(chord)
  return midiPitches.map((midiPitch) => {
    return makeNoteEvent(midiPitch, time_ms, duration, velocity)
  })
}
