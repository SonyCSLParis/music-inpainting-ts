import * as teoria from 'teoria'
import * as Tone from 'tone'

function getMidiPitches(chord_root: string, chord_type: string): number[] {
  const chord = teoria.chord(chord_root.concat(chord_type))
  const midiPitches = chord.notes().map((note) => note.midi())
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
    name: teoria.note.fromMIDI(midi).scientific(),
    time: time_ms,
    duration: duration.toSeconds(),
    velocity: velocity,
  }
}

export function getNoteEvents(
  chord_root: string,
  chord_type: string,
  time_ms: number,
  duration: Tone.TimeClass,
  velocity: number
): NoteEvent[] {
  const midiPitches = getMidiPitches(chord_root, chord_type)
  return midiPitches.map((midiPitch) => {
    return makeNoteEvent(midiPitch, time_ms, duration, velocity)
  })
}
