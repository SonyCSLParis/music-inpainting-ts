import * as Tone from 'tone';

import { PlaybackManager } from "./playback";
import { Spectrogram } from "./locator";

let Nexus = require('./nexusColored');

export class SpectrogramPlaybackManager extends PlaybackManager {
    private spectrogramLocator: Spectrogram;
    private player: Tone.Player = new Tone.Player().toMaster();

    protected setPlaybackPositionDisplay(timePosition: number): void {
        this.spectrogramLocator.matrix.stepper.value = timePosition;
    }

    protected getCurrentDisplayTimestep(): number {
        return 0;
    }

    // override safety delay
    protected async safeStartPlayback() {
        await this.startPlaybackNowFromBeginning();
        console.log("Playback started!");
    };

    private schedulePlaybackLoop() {
        console.log("Hellloooooooooo");
        this.player.sync(Tone.Transport);
        this.player.start(0.01);
        this.player.loop = true;
        this.player.setLoopPoints(0, this.player.buffer.duration);

    };

    // loadAudio(serverURL: string, command: string, codes: [[number]]): void {

    // };

    loadAudio(audioURL: string): Promise<unknown> {
        return this.player.load(audioURL);
    };

    loadSpectrogram(serverURL: string, command: string, codes: [[number]]): void {

    }

    constructor(duration_s: number, spectrogramLocator: Spectrogram) {
        super();
        this.schedulePlaybackLoop();
        this.spectrogramLocator = spectrogramLocator;
    }
};