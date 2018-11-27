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

log.setLevel(log.levels.INFO);

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
    const containerElemSelector = $(`.timecontainer[containedQuarterNotes='${step}']`);

    if (!containerElemSelector.exists()) {
        throw new Error("Inaccessible step");
    }

    const containerElemStyle = containerElemSelector[0].style;

    return {
        left: parseFloat(containerElemStyle.left),
        // FIXME implement and use timecontainer method
        right: parseFloat(containerElemStyle.left) + parseFloat(containerElemStyle.width)
    };
}

// TODO disabe scrooling behaviour when user touches scrollbar and re-enable it
// on pressing stop (or add a 'track playback' button)

const shortScroll: JQuery.Duration = 50;

function getDisplayCenterPosition_px(): number {
    // return the current position within the sheet display
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
    const currentSheetDisplayWidth: number = scrollContentElement.clientWidth;
    const centerPosition: number = (scrollContentElement.scrollLeft +
        currentSheetDisplayWidth/2);

    return centerPosition
}

function scrollToStep(step: number) {
    // scroll display to keep the center of the currently playing
    // quarter note container in the center of the sheet window
    //
    // We do this by scheduling a scroll to the next step with duration
    // equal to one quarter-note time (dependent on the current BPM)
    // Inversely, scrolling to a position earlier in time (e.g. when pressing
    // stop or reaching the end of the loop) is super-fast
    log.debug(`Scrolling to step: ${step}`);
    const sheetDisplayElem: HTMLElement = $('#osmd-container-container')[0];
    const scrollContentElement: HTMLElement = $(scrollElementSelector)[0];
    const currentSheetDisplayWidth_px: number = scrollContentElement.clientWidth;
    const currentCenterPosition_px: number = getDisplayCenterPosition_px();

    let positionTarget_px: number;
    let newScrollLeft_px: number;
    try {
        // try to retrieve the position of the (potentially non-existing) next
        // quarter-note
        const nextStepBoxDelimiters = getTimecontainerPosition(step);
        const nextStepBoxWidth_px: number = (
            nextStepBoxDelimiters.right - nextStepBoxDelimiters.left)
        log.debug(`nextStepPosition: [${nextStepBoxDelimiters.left}, ${nextStepBoxDelimiters.right}]`);

        // Center of the box containing the next quarter note
        const containerCenter = nextStepBoxDelimiters.left + (
            nextStepBoxWidth_px)/2;
        positionTarget_px = nextStepBoxDelimiters.right;
    }
    catch (e) {
        // reached last container box
        // FIXME make and catch specific error
        let lastStepPosition = getTimecontainerPosition(step);
        log.debug(`Moving to end, lastStepPosition: [${lastStepPosition.left}, ${lastStepPosition.right}]`);

        // right-side delimiter of the last quarter note box
        const containerRight = lastStepPosition.right;
        positionTarget_px = containerRight;
    }
    newScrollLeft_px = positionTarget_px - currentSheetDisplayWidth_px/2;

    log.debug(`currentSheetDisplayWidth: ${currentSheetDisplayWidth_px}`)
    log.debug(`currentCenterPosition: ${currentCenterPosition_px}`);
    log.debug(`positionTarget: ${positionTarget_px}`);
    log.debug(`scrollOffsetTarget: ${newScrollLeft_px }`);
    if (currentCenterPosition_px > positionTarget_px) {
        // scrolling to a previous position: super-fast scroll
        $(scrollElementSelector).stop(true, false).animate( {
            scrollLeft: newScrollLeft_px
        }, 10, 'linear');
    }
    else {
        $(scrollElementSelector).stop(true, false).animate( {
            scrollLeft: newScrollLeft_px
        }, computeScrollSpeed() * 1000, 'linear');
    }
}

function resetScrollPosition(duration: JQuery.Duration= shortScroll) {
    scrollToStep(0);
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

let midiParts: Tone.Part[] = [];


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

        // add the part to the array of currently scheduled parts
        midiParts.push(part);
    }
}

function getSheetDuration_quarters(): number {
    const osmdContainer: HTMLElement = document.getElementById("osmd-container");
    if (osmdContainer === null) {
        throw new Error("Cannot access OSMD container");
    }
    const maxStep: number = parseInt(
        osmdContainer.getAttribute("sequenceDuration_quarters"));
    if (maxStep === null) {
        throw new Error("Property sequenceDuration_quarters not found on OSMD container");
    }
    return maxStep;
}

function movePlaybackCursorToCurrentlyPlayingQuarter(): void {
    // HACK should use proper typings for Tone
    const [currentBar, currentQuarter, currentSixteenth] = (
        <string>Tone.Transport.position
        ).split(":");
    log.debug(`Jumping to position ${[currentBar, currentQuarter, currentSixteenth]}`);
    const sheetDuration_quarters = getSheetDuration_quarters();
    // FIXME assumes a Time Signature of 4/4
    nowPlayingCallback(null,
        (4 * parseInt(currentBar) + parseInt(currentQuarter)) % sheetDuration_quarters
    );
}

export function initialize(): void {
        // initialize playback display scheduler
        const drawCallback = (time, step) => {
            // DOM modifying callback should be put in Tone.Draw scheduler!
            // see: https://github.com/Tonejs/Tone.js/wiki/Performance#syncing-visuals
            Tone.Draw.schedule((time) => {
                movePlaybackCursorToCurrentlyPlayingQuarter();
            })
        };

        // schedule quarter-notes clock
        log.debug("Scheduling draw callback sequence");
        // FIXME assumes a TimeSignature of 4/4
        new Tone.Loop(drawCallback, '4n').start(0);
}

function midiRequestWithData(url: string, data=null, method:string = 'GET'): Promise<MidiConvert.MIDI>{
		return new Promise<MidiConvert.MIDI>((success, fail) => {
			var request = new XMLHttpRequest()
			request.open(method, url)
			request.responseType = 'arraybuffer'
			// decode asynchronously
			request.addEventListener('load', () => {
				if (request.readyState === 4 && request.status === 200){
					success(MidiConvert.parse(request.response))
				} else {
					fail(request.status)
				}
			})
			request.addEventListener('error', fail)
			request.send(data)
		});
	}


export function loadMidi(serverURL: string, musicXML: XMLDocument, sequenceDuration_toneTime: Tone.Time) {
    const serializer = new XMLSerializer();
    const payload = serializer.serializeToString(musicXML);

    $(document).ajaxError((error) => console.log(error));

    midiRequestWithData(serverURL, payload, 'POST').then(function (midi) {
            for (let midiPartIndex=0, numMidiParts=midiParts.length;
                midiPartIndex < numMidiParts; midiPartIndex++) {
                    let midiPart = midiParts.pop();
                    midiPart.dispose();
            }

            if (!midi.header.bpm) {
                // TODO insert warning wrong Flask server
            }
            if (!midi.header.timeSignature) {
                // TODO insert warning wrong Flask server
                // TODO create a test for the flask server
            }
            // must set the Transport BPM to that of the midi for proper scheduling
            // TODO(theis): this will probably lead to phase-drift if repeated
            // updates are performed successively, should catch up somehow on
            // the desynchronisation introduced by this temporary tempo change
            Tone.Transport.bpm.value = midi.header.bpm;

            // Required for Tone.Time conversions to properly work
            Tone.Transport.timeSignature = midi.header.timeSignature;

            const numTracks = midi.tracks.length;
            for (let trackIndex=0; trackIndex < numTracks; trackIndex++){
                const track = midi.tracks[trackIndex];
                // midiChannels start at 1
                const midiChannel = trackIndex + 1;
                scheduleTrackToInstrument(sequenceDuration_toneTime, track,
                    midiChannel);
            }

            // change Transport BPM back to the displayed value
            Tone.Transport.bpm.value = BPM.getBPM();  // WARNING if bpmCounter is a floor'ed value, this is wrong
        }
    ).catch((error) => {console.log(error)})
}
