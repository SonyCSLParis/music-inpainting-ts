// <reference path='./jquery-exists.d.ts'/>

// NOTE: This relies on the SonyCSL simplebar fork!

import * as Tone from 'tone'
import * as log from 'loglevel'
import * as MidiConvert from 'midiconvert'
import * as $ from 'jquery'

let Nexus = require('./nexusColored');

import * as BPM from './bpm'
import * as Instruments from './instruments'
import * as MidiOut from './midiOut'
import LinkClient from './linkClient'

$.fn.exists = function() {
    return this.length !== 0;
}

let scrollElementSelector: string = '.simplebar-content'

function getTimingOffset(){
    return performance.now() - Tone.now() * 1000
}

function getPlayNoteByMidiChannel(midiChannel: number){
    function playNote(time, event){
        MidiOut.getOutput().playNote(event.name, midiChannel,
            {time: time * 1000 + getTimingOffset(),
                duration: event.duration * 1000});
        Instruments.getCurrentInstrument().triggerAttackRelease(event.name, event.duration, time,
            event.velocity);

        log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event));
    }
    return playNote
}

function makeSteps(sequenceDuration_toneTime: Tone.Time) {
    // create an array of quarter-note aligned steps
    const [seq_dur_measures, seq_dur_quarters, seq_dur_sixteenths] =
        sequenceDuration_toneTime.toBarsBeatsSixteenths().split(':').map(parseFloat)
    const sequence_duration_quarters = Math.floor((4*seq_dur_measures +
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
    resetScrollPosition();
}

function nowPlayingCallback(_: any, step: number): void {
    // scroll display to current step if necessary
    scrollToStep(step);
    setPlaybackPositionDisplay(step);
};

function getTimecontainerPosition(step: number): {left: number, right: number} {
    const containerElemSelector = $(`.timecontainer[containedQuarterNotes~='${step}']`)

    if (!containerElemSelector.exists()) {
        throw new Error("Inaccessible step")
    }

    const containerElemStyle = containerElemSelector[0].style;

    return {
        left: parseFloat(containerElemStyle.left),
        // FIXME implement and use timecontainer method
        right: parseFloat(containerElemStyle.left + containerElemStyle.width)
    }
}

// TODO disabe scrooling behaviour when user touches scrollbar and re-enable it
// on pressing stop (or add a 'track playback' button)

const shortScroll: JQuery.Duration = 50;

function getDisplayCenterPosition_px(): number {
    // return the current position within the sheet display
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
    const currentSheetDisplayWidth: number = scrollContentElement.clientWidth;
    const centerPosition: number = (scrollContentElement.scrollLeft +
        currentSheetDisplayWidth/2)

    return centerPosition
}

function scrollToStep(step: number) {
    // scroll display to keep the center of the currently playing
    // quarter note container in the center of the sheet window
    //
    // We do this by scheduling a scroll to the next step with duration
    // equal to one quarter-note time (dependent on the current BPM)
    // Scrolls to position back in time are super-fast

    const sheetDisplayElem: HTMLElement = $('#osmd-container-container')[0]
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
    const currentSheetDisplayWidth: number = scrollContentElement.clientWidth;
    const currentCenterPosition: number = getDisplayCenterPosition_px();

    let positionTarget: number;
    let scrollOffsetTarget: number;
    try {
        // try to retrieve the position of the (potentially non-existing) next
        // quarter-note
        let nextStepPosition = getTimecontainerPosition(step+1);
        const containerCenter = nextStepPosition.left + (nextStepPosition.right - nextStepPosition.left)/2;
        positionTarget = containerCenter;
        scrollOffsetTarget = containerCenter - currentSheetDisplayWidth/2 - currentSheetDisplayWidth/8;
    }
    catch (e) {
        // FIXME make and catch specific error
        let lastStepPosition = getTimecontainerPosition(step);
        const containerRight = lastStepPosition.right;
        positionTarget = containerRight;
        scrollOffsetTarget = containerRight - currentSheetDisplayWidth/2;

        return;
    }

    if (currentCenterPosition > positionTarget) {
        // scrolling to a previous position: super-fast scroll
        $(scrollElementSelector).stop(true, false).animate( {
            scrollLeft: scrollOffsetTarget
        }, 10, 'linear');
    }
    else {
        $(scrollElementSelector).stop(true, false).animate( {
            scrollLeft: scrollOffsetTarget
        }, computeScrollSpeed() * 1000, 'linear');
    }
}

function resetScrollPosition(duration: JQuery.Duration= shortScroll) {
    scrollToStep(-1);
}

function computeScrollSpeed() {
    const currentBPM: number = Tone.Transport.bpm.value
    const interbeatTime_s = 60 / currentBPM
    return interbeatTime_s
}

function downbeatStartCallback() {
    Tone.Transport.start("+0", "0:0:0")
}


export function play(){
    return new Promise((resolve, reject) => {
        Tone.context.resume().then(() => {
            if (!(LinkClient.isEnabled())) {
                // start the normal way
                Tone.Transport.start("+0.2");
                resolve();
            }
            else {
                log.info('LINK: Waiting for `downbeat` message...');
                // wait for Link-socket to give downbeat signal
                LinkClient.once('downbeat', () => {
                    downbeatStartCallback();
                    log.info('LINK: Received `downbeat` message, starting playback');
                    resolve();
                });
            }
        })
    })
};

export function stop(){
    Tone.context.resume().then(() => {
        Tone.Transport.stop();
    })
};



function scheduleTrackToInstrument(sequenceDuration_toneTime: Tone.Time,
    midiTrack, midiChannel=1) {
    const notes = midiTrack.notes;

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
        const steps = makeSteps(sequenceDuration_toneTime)
        Tone.Transport.cancel();  // remove all scheduled events

        // must set the Transport BPM to that of the midi for proper scheduling
        // TODO(theis): this will probably lead to phase-drift if repeated
        // updates are performed successively, should catch up somehow on
        // the desynchronisation introduced by this temporary tempo change
        Tone.Transport.bpm.value = midi.header.bpm;
        Tone.Transport.timeSignature = midi.header.timeSignature;

        const drawCallback = (time, step) => {
                // DOM modifying callback should be put in Tone.Draw scheduler!
                // see: https://github.com/Tonejs/Tone.js/wiki/Performance#syncing-visuals
                Tone.Draw.schedule((time) => {nowPlayingCallback(time, step)}, time);
            }

        // schedule quarter-notes clock
        new Tone.Sequence(drawCallback, steps, '4n').start(0);

        for (let trackIndex_str in midi.tracks){
            const trackIndex = parseInt(trackIndex_str);
            const track = midi.tracks[trackIndex];
            // midiChannels start at 1
            const midiChannel = trackIndex + 1;
            scheduleTrackToInstrument(sequenceDuration_toneTime, track,
                midiChannel);
        }

        // change Transport BPM back to the displayed value
        Tone.Transport.bpm.value = BPM.getBPM();  // WARNING if bpmCounter is a floor'ed value, this is wrong
    })
}
