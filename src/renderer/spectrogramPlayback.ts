import * as Tone from 'tone';

import { PlaybackManager } from "./playback";
import { Spectrogram } from "./locator";

let Nexus = require('./nexusColored');

export class SpectrogramPlaybackManager extends PlaybackManager {
    readonly spectrogramLocator: Spectrogram;
    private player: Tone.Player = new Tone.Player().toMaster();

    protected setPlaybackPositionDisplay(timePosition: number): void {
        this.spectrogramLocator.setPosition(timePosition);
    }

    protected getCurrentDisplayTimestep(): number {
        return 0;
    }

    private schedulePlaybackLoop() {
        this.player.sync(Tone.Transport);
        Tone.Transport.setLoopPoints(0, 4);
        Tone.Transport.loop = true;
        this.player.start(0).stop(3.99);
    };

    async loadAudio(audioURL: string): Promise<void> {
        await this.player.load(audioURL);
        // await Tone.context.resume();
        // this.player.pause();
        // this.player.play();
    };

    loadSpectrogram(serverURL: string, command: string, codes: number[][]): void {

    }

    constructor(duration_s: number, spectrogramLocator: Spectrogram) {
        super();
        this.schedulePlaybackLoop();
        this.spectrogramLocator = spectrogramLocator;
    }
};