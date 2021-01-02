import * as Tone from 'tone';

import { PlaybackManager } from "./playback";
import { SpectrogramLocator } from "./locator";

import Nexus from './nexusColored';

import { getMidiInputListener } from './midiIn';

interface NoteEvent {
	note: string;
	midi: number;
	velocity: number;
}

export class SpectrogramPlaybackManager extends PlaybackManager<SpectrogramLocator> {
    // initialize crossfade to play player A
    protected masterLimiter: Tone.Limiter = new Tone.Limiter(-10).toDestination();
    protected masterGain: Tone.Gain = new Tone.Gain(1).connect(this.masterLimiter);
    protected crossFade: Tone.CrossFade = new Tone.CrossFade(0).connect(this.masterGain);
    protected player_A: Tone.Player = new Tone.Player().connect(this.crossFade.a);
    protected player_B: Tone.Player = new Tone.Player().connect(this.crossFade.b);

    protected buffer_A: Tone.ToneAudioBuffer = new Tone.ToneAudioBuffer();
    protected buffer_B: Tone.ToneAudioBuffer = new Tone.ToneAudioBuffer();
    protected sampler_A: Tone.Sampler = new Tone.Sampler({'C4': this.buffer_A}).connect(this.crossFade.a);
    protected sampler_B: Tone.Sampler = new Tone.Sampler({'C4': this.buffer_B}).connect(this.crossFade.b);

    protected crossFadeDuration: Tone.Unit.Time = "1";
    // look-ahead duration to retrieve the state of the crossfade after potential fading operations
    protected crossFadeOffset: Tone.Unit.Time = "+1.5";

    constructor(locator: SpectrogramLocator) {
        super(locator);

        this.scheduleInitialPlaybackLoop();

        getMidiInputListener().then((midiListener) => {
            midiListener.on('keyDown', (data: NoteEvent) => {
                this.currentSampler().triggerAttack(
                    data.note, undefined, data.velocity);
                return this
            });
            midiListener.on('keyUp', (data: NoteEvent) => {
                this.currentSampler().triggerRelease(data.note);
            });
        });
    }

    // duration of the currently playing player in seconds
    public get duration_s(): number {
        return this.currentPlayer().buffer.duration;
    };

    protected setPlaybackPositionDisplay(timePosition: number): void {
        this.locator.setPosition(timePosition);
    }

    protected getCurrentDisplayTimestep(): number {
        // TODO(theis): fix method name, this returns the ratio of progress in the playback
        return Tone.getTransport().progress;
    }

    protected currentPlayerIsA(): boolean {
        return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) <= 0.5;
    }

    // return the player scheduled to play after any eventual crossfade operation has been completed
    protected currentSampler(): Tone.Sampler {
        return this.currentPlayerIsA() ? this.sampler_A : this.sampler_B
    }

    // return the player scheduled to play after any eventual crossfade operation has been completed
    protected currentPlayer(): Tone.Player {
        return this.currentPlayerIsA() ? this.player_A : this.player_B
    }

    // return the player scheduled to be idle after any eventual crossfade operation has been completed
    protected nextPlayer(): Tone.Player {
        return this.currentPlayerIsA() ? this.player_B : this.player_A
    }

    // return the player scheduled to be idle after any eventual crossfade operation has been completed
    protected nextBuffer(): Tone.ToneAudioBuffer {
        return this.currentPlayerIsA() ? this.buffer_B : this.buffer_A;
    }

    // crossfade between the two players
    protected switchPlayers() {
        const currentScheduledValue: number = this.crossFade.fade.getValueAtTime(this.crossFadeOffset);
        const newValue: number = Math.round(1 - currentScheduledValue);  // round ensures binary values
        this.crossFade.fade.linearRampTo(newValue, this.crossFadeDuration);
    }

    // initialize the Transport loop and synchronize the two players
    private scheduleInitialPlaybackLoop() {
        this.player_A.sync();
        this.player_B.sync();
        Tone.getTransport().loop = true;
    };

    // load a remote audio file into the next player and switch playback to it
    async loadAudio(audioURL: string): Promise<void> {
        await Promise.all([
            this.nextPlayer().load(audioURL),
            this.nextBuffer().load(audioURL)
        ]);

        // must unsync/resync to remove scheduled play/stop commands,
        // otherwise the following stop() command is rejected
        this.nextPlayer().unsync();
        // required playback stop to allow playing the newly loaded buffer
        this.nextPlayer().stop();
        this.nextPlayer().sync();

        // reschedule the Transport loop
        Tone.getTransport().setLoopPoints(0, this.nextPlayer().buffer.duration);
        this.nextPlayer().start(0);

        this.switchPlayers();
    };

    // TODO(theis): move methods from index.ts to this class
    loadSpectrogram(serverURL: string, command: string, codes: number[][]): void {
        throw new Error("Not implemented");
    }

    setFadeIn(duration_s: number) {
        this.player_A.fadeIn = duration_s
        this.player_B.fadeIn = duration_s

        this.sampler_A.attack = Math.min(duration_s, 1);
        this.sampler_B.attack = Math.min(duration_s, 1);
    }

    get Gain(): number {
        return this.masterGain.gain.value;
    }
    set Gain(newGain: number) {
        this.masterGain.gain.value = newGain;
    }
};

export function renderFadeInControl(
        element: HTMLElement,
        spectrogramPlaybackManager: SpectrogramPlaybackManager): void {
    const fadeInControl = new Nexus.Toggle(element.id,{
        'size': [40, 20],
        'state': false
    });
    let fadeIn_duration_s: number = 0.010;
    fadeInControl.on('change', function(useFadeIn: boolean) {
        spectrogramPlaybackManager.setFadeIn(useFadeIn ? fadeIn_duration_s : 0);
    });
}


export function renderGainControl(
        element: HTMLElement,
        spectrogramPlaybackManager: SpectrogramPlaybackManager): void {
    const gainControl = new Nexus.Slider(element.id,{
        'size': [60, 20],
        'mode': 'relative',
        'min': 0,
        'max': 1.2,
        'step': 0,
        'value': 1
    });

    gainControl.on('change', function(newGain: number) {
        spectrogramPlaybackManager.Gain = newGain;
    });
    gainControl.value = 1;
}
