import { PlaybackManager } from './playback';

import * as Tone from 'tone';
import * as log from 'loglevel';
import * as MidiConvert from 'midiconvert';
import * as $ from 'jquery';

let Nexus = require('./nexusColored');

import * as Instruments from './instruments';
import * as MidiOut from './midiOut';
import LinkClient from './linkClient';
import * as Chord from './chord';
import { BPMControl } from './numberControl';

import { eOSMD } from './locator';

let scrollElementSelector: string = '.simplebar-content';

function getTimingOffset(){
    return performance.now() - Tone.now() * 1000;
};

export class SheetPlaybackManager extends PlaybackManager {
    private getPlayNoteByMidiChannel(midiChannel: number,
        useChordsInstruments: boolean = false){
        let getCurrentInstrument = Instruments.getCurrentInstrument;
        if (useChordsInstruments) {
            getCurrentInstrument = Instruments.getCurrentChordsInstrument;
        };

        function playNote(time, event){
            MidiOut.getOutput().playNote(event.name, midiChannel,
                {time: time * 1000 + getTimingOffset(),
                    duration: Tone.Time(event.duration).toSeconds() * 1000 - 50 });
            getCurrentInstrument().triggerRelease(time-0.02);
            getCurrentInstrument().keyUp(event.name, time-0.02);
            getCurrentInstrument().triggerAttackRelease(event.name,
                Tone.Time(event.duration).toSeconds() - 0.05, time, event.velocity);

            log.trace(`Play note event @ time ${time}: ` + JSON.stringify(event));
        };
        return playNote
    };

    protected nowPlayingCallback(_: any, step: number): void {
        super.nowPlayingCallback(null, step);
        // scroll display to current step if necessary
        this.scrollToStep(step);
    };

    protected setPlaybackPositionDisplay(step: number): void{
        $('.notebox').removeClass('playing');
        $(`.timecontainer[containedQuarterNotes~='${step}'] .notebox`).addClass('playing');
    }

    protected resetPlaybackPositionDisplay(): void {
        super.resetPlaybackPositionDisplay();
        this.resetScrollPosition();
    }

    private getTimecontainerPosition(step: number): {left: number, right: number} {
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

    private shortScroll: JQuery.Duration = 50;

    private getDisplayCenterPosition_px(): number {
        // return the current position within the sheet display
        const scrollContentElement: HTMLElement = $(scrollElementSelector)[0]
        const currentSheetDisplayWidth: number = scrollContentElement.clientWidth;
        const centerPosition: number = (scrollContentElement.scrollLeft +
            currentSheetDisplayWidth/2);

        return centerPosition
    }

    private scrollToStep(step: number) {
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
        const currentCenterPosition_px: number = this.getDisplayCenterPosition_px();

        let positionTarget_px: number;
        let newScrollLeft_px: number;
        try {
            // try to retrieve the position of the (potentially non-existing) next
            // quarter-note
            const nextStepBoxDelimiters = this.getTimecontainerPosition(step);
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
            let lastStepPosition = this.getTimecontainerPosition(step);
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
            // synchronize scrolling with the tempo for smooth scrolling
            const scrollDuration_ms = this.getInterbeatTime_s() * 1000;
            $(scrollElementSelector).stop(true, false).animate( {
                scrollLeft: newScrollLeft_px
            }, scrollDuration_ms, 'linear');
        }
    }

    private resetScrollPosition(duration: JQuery.Duration=this.shortScroll) {
        this.scrollToStep(0);
    }

    // Return the time in seconds between beats
    private getInterbeatTime_s() {
        const currentBPM: number = Tone.Transport.bpm.value
        const interbeatTime_s = 60 / currentBPM
        return interbeatTime_s
    }

    private midiParts: Tone.Part[] = [];

    public scheduleTrackToInstrument(sequenceDuration_toneTime: Tone.Time,
        midiTrack, midiChannel=1) {
        const notes = midiTrack.notes;

        let playNote_callback;
        playNote_callback = this.getPlayNoteByMidiChannel(midiChannel);

        let part = new Tone.Part(playNote_callback, notes);
        part.start(0)  // schedule events on the Tone timeline
        part.loop = true;
        part.loopEnd = sequenceDuration_toneTime;
        this.midiParts.push(part)

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
            this.midiParts.push(part);
        }
    }

    private getSheetDuration_quarters(): number {
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

    protected getCurrentDisplayTimestep(): number {
        // HACK should use proper typings for Tone
        const [currentBar, currentQuarter, currentSixteenth] = (
            <string>Tone.Transport.position
            ).split(":");

        const sheetDuration_quarters = this.getSheetDuration_quarters();

        // FIXME assumes a Time Signature of 4/4
        const currentStep: number = (4*parseInt(currentBar) +
            parseInt(currentQuarter)) % sheetDuration_quarters;
        return currentStep;
    }

    scheduleDisplayLoop(): void {
            // initialize playback display scheduler
            const drawCallback = (time) => {
                // DOM modifying callback should be put in Tone.Draw scheduler!
                // see: https://github.com/Tonejs/Tone.js/wiki/Performance#syncing-visuals
                Tone.Draw.schedule((time) => {
                    this.updateCursorPosition();
                })
            };

            // schedule quarter-notes clock
            log.debug("Scheduling draw callback sequence");
            // FIXME assumes a TimeSignature of 4/4
            new Tone.Loop(drawCallback, '4n').start(0);
    }

    private midiRequestWithData(url: string, data=null,
        method:string = 'GET'): Promise<MidiConvert.MIDI>{
            return new Promise<MidiConvert.MIDI>((success, fail) => {
                let request = new XMLHttpRequest()
                request.open(method, url)
                request.responseType = 'arraybuffer'
                // decode asynchronously
                request.addEventListener('load', () => {
                    if (request.readyState === 4 && request.status === 200){
                        success(MidiConvert.parse(request.response))
                    } else {
                        fail(request.status)
                    }},
                    {once: true}
                );
                request.addEventListener('error', fail, {once: true})
                request.send(data)
            });
        }

    loadMidi(serverURL: string, musicXML: XMLDocument,
        sequenceDuration_toneTime: Tone.Time,
        bpmControl: BPMControl) {
        const serializer = new XMLSerializer();
        const payload = serializer.serializeToString(musicXML);

        $(document).ajaxError((error) => console.log(error));

        this.midiRequestWithData(serverURL, payload, 'POST').then(function (midi) {
                for (let midiPartIndex=0, numMidiParts=this.midiParts.length;
                    midiPartIndex < numMidiParts; midiPartIndex++) {
                        let midiPart = this.midiParts.pop();
                        midiPart.dispose();
                }

                Tone.Transport.loop = true;
                Tone.Transport.loopStart = 0;
                Tone.Transport.loopEnd = sequenceDuration_toneTime;

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
                    this.scheduleTrackToInstrument(sequenceDuration_toneTime, track,
                        midiChannel);
                }

                // change Transport BPM back to the displayed value
                Tone.Transport.bpm.value = bpmControl.value;  // WARNING if bpmCounter is a floor'ed value, this is wrong
            }
        ).catch((error) => {console.log(error)})
    };

    scheduleChordsPlayer(osmd: eOSMD, midiChannel: number) {
        // schedule callback to play the chords contained in the OSMD
        const useChordsInstruments = true;

        const playChord = (time) => {
            let currentStep = this.getCurrentDisplayTimestep();
            if (currentStep % 2 == 0) {
                let chord = osmd.chordSelectors[Math.floor(currentStep / 2)].currentChord;
                const events = Chord.getNoteEvents(chord.note + chord.accidental,
                    chord.chordType, time, '2n', 0.5);
                const playNote = this.getPlayNoteByMidiChannel(midiChannel,
                    useChordsInstruments);
                for (let eventIndex = 0, numEvents = events.length;
                    eventIndex < numEvents; eventIndex++) {
                        playNote(time, events[eventIndex])
                }
            }
        };

        // FIXME assumes a TimeSignature of 4/4
        new Tone.Loop(playChord, '4n').start(0);
    };
};