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

    protected crossFadeDuration: Tone.Unit.Time = "0.5";
    protected crossFadeOffset: Tone.Unit.Time = "+1";

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

    protected currentPlayer(): Tone.Player {
        return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) > 0.5 ? this.player_B : this.player_A
    }

    protected nextPlayer(): Tone.Player {
        return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) > 0.5 ? this.player_A : this.player_B
    }

    protected switchPlayers() {
        const currentScheduledValue: number = this.crossFade.fade.getValueAtTime(this.crossFadeOffset);
        console.log(currentScheduledValue);
        const newValue: number = Math.round(1 - currentScheduledValue);  // round ensures binary values
        this.crossFade.fade.exponentialRampTo(newValue, this.crossFadeDuration);
    }

    private scheduleInitialPlaybackLoop() {
        this.player_A.sync();
        this.player_B.sync();
        Tone.Transport.loop = true;
    };

    private reschedulePlaybackLoop() {
        this.nextPlayer().unsync();
        this.nextPlayer().stop();
        this.nextPlayer().sync();
        Tone.Transport.setLoopPoints(0, this.nextPlayer().buffer.duration);
        this.nextPlayer().start(0);
    };

    async loadAudio(audioURL: string): Promise<void> {
        await this.nextPlayer().load(audioURL);
        this.reschedulePlaybackLoop();
        this.switchPlayers();
    };

    loadSpectrogram(serverURL: string, command: string, codes: number[][]): void {
        // TODO(theis)
        throw new Error("Not implemented");
    }

    constructor(spectrogramLocator: Spectrogram) {
        super();
        this.spectrogramLocator = spectrogramLocator;

        this.scheduleInitialPlaybackLoop();
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
        'interaction': 'vertical', // "radial", "vertical", or "horizontal"
        'mode': 'relative', // "absolute" or "relative"
        'min': 0,
        'max': 0.2,
        'step': 0.001,
        'value': 0
    });

    fadeInControl.on('change', function(fadeIn_duration_s: number) {
        spectrogramPlaybackManager.setFadeIn(fadeIn_duration_s)
    });
}