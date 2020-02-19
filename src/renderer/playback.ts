// <reference path='./jquery-exists.d.ts'/>

// NOTE: This relies on the SonyCSL simplebar fork!

import * as Tone from 'tone';
import * as log from 'loglevel';

import LinkClient from './linkClient';

log.setLevel(log.levels.INFO);

export interface MinimalPlaybackManager {
    play(): Promise<unknown>;
    stop(): Promise<void>;
};

abstract class TonePlaybackManager implements MinimalPlaybackManager {
    // adds a small delay to ensure playback as recommended in the Tone.js docs
    protected safeStartPlayback(): void {
        Tone.Transport.start("+0.02");
    };

    async play() {
        await Tone.context.resume();
        // start the normal way
        this.safeStartPlayback();
    };

    protected stopSound(): void {
        Tone.Transport.stop();
    };

    async stop()  {
        await Tone.context.resume();
        this.stopSound();
    };
}

abstract class VisualPlaybackManager extends TonePlaybackManager {
    protected abstract setPlaybackPositionDisplay(timePosition: number): void;

    protected nowPlayingCallback(_: any, step: number): void {
        // scroll display to current step if necessary
        // this.scrollToStep(step);
        this.setPlaybackPositionDisplay(step);
    };

    // retrieve index of the current display-step
    protected abstract getCurrentDisplayTimestep(): number;

    protected updateCursorPosition(): void {
        const currentDisplayTimestep: number = this.getCurrentDisplayTimestep()
        this.nowPlayingCallback(null, currentDisplayTimestep);
    };

    protected scheduleDisplayLoop(toneDisplayUpdateInterval: string): void {
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
        new Tone.Loop(drawCallback, toneDisplayUpdateInterval).start(0);
    };

    protected resetPlaybackPositionDisplay(): void {
        this.setPlaybackPositionDisplay(0);
    };

    // Stop playback immediately and reset position display
    async stop() {
        await super.stop();
        this.resetPlaybackPositionDisplay();
    };
}

abstract class SynchronizedPlaybackManager extends TonePlaybackManager {
    // Start playback immediately at the beginning of the song
    protected startPlaybackNowFromBeginning(): Promise<unknown> {
        return Tone.Transport.start("+0.03", "0:0:0");
    }

    // Start playback either immediately or in sync with Link if Link is enabled
    async play(){
        await Tone.context.resume();
        if (!(LinkClient.isEnabled())) {
            // start the normal way
            this.safeStartPlayback();
        }
        else {
            log.info('LINK: Waiting for `downbeat` message...');
            // wait for Link-socket to give downbeat signal
            await LinkClient.once('downbeat', async () => {
                this.startPlaybackNowFromBeginning();
            });
            log.info('LINK: Received `downbeat` message, starting playback');
        };
    };

    // Set the position in the current measure to the provided phase
    // TODO(theis): should we use the `link.quantum` value?
    synchronizeToLink(): void {
        if (Tone.Transport.state == 'started' && LinkClient.isEnabled()) {
            const currentMeasure = this.getCurrentMeasure().toString();
            Tone.Transport.position = currentMeasure + ':' + LinkClient.getPhaseSynchronous().toString();
        };
    };

    // Helper function to access the current measure in the Transport
    protected getCurrentMeasure(): number {
        const currentMeasure = Tone.Transport.position.split('')[0];
        return currentMeasure
    };

    // Quick-and-dirty automatic phase-locking to Ableton Link
    protected scheduleAutomaticResync() {
        new Tone.Loop(() => {this.synchronizeToLink()}, '3m').start('16n');
    };
};

export interface PlaybackManager extends TonePlaybackManager, VisualPlaybackManager, SynchronizedPlaybackManager {}

export abstract class PlaybackManager {
    constructor(toneDisplayUpdateInterval: string='4n') {
        this.scheduleAutomaticResync();
        this.scheduleDisplayLoop(toneDisplayUpdateInterval);
    };
};
applyMixins(PlaybackManager, [TonePlaybackManager, VisualPlaybackManager, SynchronizedPlaybackManager]);

// as found in the TypeScript documentation
// https://www.typescriptlang.org/docs/handbook/mixins.html
function applyMixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
        });
    });

    return derivedCtor
};
