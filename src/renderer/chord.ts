import * as teoria from 'teoria';
import * as Tone from 'tone';

function getMidiPitches(chord_root: string, chord_type: string): number[] {
    const chord = teoria.chord(chord_root.concat(chord_type));
    let midiPitches = chord.notes().map((note) => note.midi());
    return midiPitches;
}

function makeNoteEvent(midi: number, time_ms: number, duration_ms: number,
    velocity: number) {
    return {
        midi: midi,
        name: teoria.note.fromMIDI(midi).scientific(),
        time: time_ms,
        duration: duration_ms,
        velocity: velocity,
    }
}

export function getNoteEvents(chord_root: string, chord_type: string,
    time_ms: number, duration: Tone.TimeClass, velocity: number) {
    const midiPitches = getMidiPitches(chord_root, chord_type);
    return midiPitches.map((midiPitch) => {
        return makeNoteEvent(midiPitch, time_ms, duration.toMilliseconds(), velocity)});
}
