import * as Tone from 'tone';

import { PlaybackManager } from "./playback";
import { Spectrogram } from "./locator";

let Nexus = require('./nexusColored');

export class SpectrogramPlaybackManager extends PlaybackManager {
    readonly spectrogramLocator: Spectrogram;
    // initialize crossfade to play player A
    private crossFade: Tone.CrossFade = new Tone.CrossFade(0).toDestination();
    private player_A: Tone.Player = new Tone.Player().connect(this.crossFade.a);
    private player_B: Tone.Player = new Tone.Player().connect(this.crossFade.b);

    protected crossFadeDuration: Tone.Unit.Time = "1";
    // look-ahead duration to retrieve the state of the crossfade after potential fading operations
    protected crossFadeOffset: Tone.Unit.Time = "+1.5";

    constructor(spectrogramLocator: Spectrogram) {
        super();
        this.spectrogramLocator = spectrogramLocator;

        this.scheduleInitialPlaybackLoop();
    }

    // duration of the currently playing player in seconds
    public get duration_s(): number {
        return this.currentPlayer().buffer.duration;
    };

    protected setPlaybackPositionDisplay(timePosition: number): void {
        this.spectrogramLocator.setPosition(timePosition);
    }

    protected getCurrentDisplayTimestep(): number {
        // TODO(theis): fix method name, this returns the ratio of progress in the playback
        return Tone.Transport.progress;
    }

    // return the player scheduled to play after any eventual crossfade operation has been completed
    protected currentPlayer(): Tone.Player {
        return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) > 0.5 ? this.player_B : this.player_A
    }

    // return the player scheduled to be idle after any eventual crossfade operation has been completed
    protected nextPlayer(): Tone.Player {
        return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) > 0.5 ? this.player_A : this.player_B
    }

    // crossfade between the two players
    protected switchPlayers() {
        const currentScheduledValue: number = this.crossFade.fade.getValueAtTime(this.crossFadeOffset);
        const newValue: number = Math.round(1 - currentScheduledValue);  // round ensures binary values
        this.crossFade.fade.exponentialRampTo(newValue, this.crossFadeDuration);
    }

    // initialize the Transport loop and synchronize the two players
    private scheduleInitialPlaybackLoop() {
        this.player_A.sync();
        this.player_B.sync();
        Tone.Transport.loop = true;
    };

    // load a remote audio file into the next player and switch playback to it
    async loadAudio(audioURL: string): Promise<void> {
        await this.nextPlayer().load(audioURL);

        // must unsync/resync to remove scheduled play/stop commands,
        // otherwise the following stop() command is rejected
        this.nextPlayer().unsync();
        // required playback stop to allow playing the newly loaded buffer
        this.nextPlayer().stop();
        this.nextPlayer().sync();

        // reschedule the Transport loop
        Tone.Transport.setLoopPoints(0, this.nextPlayer().buffer.duration);
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
    }
};

export function renderFadeInControl(element: HTMLElement, spectrogramPlaybackManager:
        SpectrogramPlaybackManager) {
    var fadeInControl = new Nexus.Dial(element.id,{
        'size': [64, 64],
        'interaction': 'vertical',
        'mode': 'relative',
        'min': 0,
        'max': 0.2,
        'step': 0.001,
        'value': 0
    });

    fadeInControl.on('change', function(fadeIn_duration_s: number) {
        spectrogramPlaybackManager.setFadeIn(fadeIn_duration_s)
    });
}