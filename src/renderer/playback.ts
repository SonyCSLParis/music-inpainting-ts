import * as Tone from 'tone'
import * as log from 'loglevel'
import * as MidiConvert from 'midiconvert'
import * as $ from 'jquery'

let Nexus = require('./nexusColored');

import * as BPM from './bpm'
import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import LinkClient from './linkClient'


function getTimingOffset(){
    return performance.now() - Tone.now() * 1000
}

function getPlayNoteByMidiChannel(midiChannel: number){
    function playNote(time, event){
        MidiOut.getOutput().playNote(event.name, midiChannel,
            {time: time * 1000 + getTimingOffset(),
                duration: event.duration * 1000})
        Instruments.getCurrentInstrument().triggerAttackRelease(event.name, event.duration, time,
            event.velocity);

        log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event));
    }
    return playNote
}

function makeSteps(sequenceDuration_toneTime: Tone.Time) {
    // create an array of quarter-note aligned steps
    let [seq_dur_measures, seq_dur_quarters, seq_dur_sixteenths] =
        sequenceDuration_toneTime.toBarsBeatsSixteenths().split(':').map(parseFloat)
    let sequence_duration_quarters = Math.floor((4*seq_dur_measures +
        seq_dur_quarters + Math.floor(seq_dur_sixteenths / 4)))
    let steps = [];
    for (let i = 0; i < sequence_duration_quarters; i++) {
        steps.push(i);
    }
    return steps
}


function setPlaybackPositionDisplay(step: number): void{
    $('.notebox').removeClass('playing');
    $(`.timecontainer[containedQuarterNotes~='${step}'] .notebox`).addClass('playing');
}

export function resetPlaybackPositionDisplay(): void {
    setPlaybackPositionDisplay(0);
}


function nowPlayingCallback(_: any, step: number): void{
    setPlaybackPositionDisplay(step);
}


function downbeatStartCallback() {
    Tone.Transport.start("+0", "0:0:0")
}


export function play(){
    Tone.context.resume().then(() => {
        if (!(LinkClient.isEnabled())) {
            // start the normal way
            Tone.Transport.start("+0.2");
        }
        else {
            log.info('LINK: Waiting for `downbeat` message...');
            // wait for Link-socket to give downbeat signal
            LinkClient.once('downbeat', () => {
                downbeatStartCallback();
                log.info('LINK: Received `downbeat` message, starting playback');
            });
        }
    })
};

export function stop(){
    Tone.context.resume().then(() => {
        Tone.Transport.stop();
    })
};



function scheduleTrackToInstrument(sequenceDuration_toneTime: Tone.Time,
    midiTrack, midiChannel=1) {
    let notes = midiTrack.notes;

    let playNote_callback;
    playNote_callback = getPlayNoteByMidiChannel(midiChannel);

    let part = new Tone.Part(playNote_callback, notes);
    part.start(0)  // schedule events on the Tone timeline
    part.loop = true;
    part.loopEnd = sequenceDuration_toneTime;

    //schedule the pedal
    let sustain = new Tone.Part((time, event) => {
        if (event.value){
            Instruments.getCurrentInstrument().pedalDown(time);
        } else {
            Instruments.getCurrentInstrument().pedalUp(time);
        }
    }, midiTrack.controlChanges[64]).start(0);

    let noteOffEvents = new Tone.Part((time, event) => {
        Instruments.getCurrentInstrument().keyUp(
            event.midi, time, event.velocity);
    }, midiTrack.noteOffs).start(0);

    let noteOnEvents = new Tone.Part((time, event) => {
        Instruments.getCurrentInstrument().keyDown(
            event.midi, time, event.velocity);
    }, midiTrack.notes).start(0);

    log.trace('Midi track content');
    log.trace(midiTrack.noteOffs);
    log.trace(midiTrack.notes);

    // set correct loop points for all tracks and activate infinite looping
    for (let part of [sustain, noteOffEvents, noteOnEvents]) {
        part.loop = true;
        part.loopEnd = sequenceDuration_toneTime;
    }
}

export function loadMidi(url: string, sequenceDuration_toneTime: Tone.Time) {
    MidiConvert.load(url, function(midi) {
        let steps = makeSteps(sequenceDuration_toneTime)
        Tone.Transport.cancel();  // remove all scheduled events

        // must set the Transport BPM to that of the midi for proper scheduling
        // TODO(theis): this will probably lead to phase-drift if repeated
        // updates are performed successively, should catch up somehow on
        // the desynchronisation introduced by this temporary tempo change
        Tone.Transport.bpm.value = midi.header.bpm;
        Tone.Transport.timeSignature = midi.header.timeSignature;

        let drawCallback = (time, step) => {
                // DOM modifying callback should be put in Tone.Draw scheduler!
                // see: https://github.com/Tonejs/Tone.js/wiki/Performance#syncing-visuals
                Tone.Draw.schedule((time) => {nowPlayingCallback(time, step)}, time);
            }

        // schedule quarter-notes clock
        new Tone.Sequence(drawCallback, steps, '4n').start(0);

        for (let trackIndex_str in midi.tracks){
            let trackIndex = parseInt(trackIndex_str);
            let track = midi.tracks[trackIndex];
            // midiChannels start at 1
            let midiChannel = trackIndex + 1;
            scheduleTrackToInstrument(sequenceDuration_toneTime, track,
                midiChannel);
        }

        // change Transport BPM back to the displayed value
        Tone.Transport.bpm.value = BPM.getBPM();  // WARNING if bpmCounter is a floor'ed value, this is wrong
    })
}
