import * as Tone from 'tone';

import { PlaybackManager } from "./playback";
import { Spectrogram } from "./locator";

let Nexus = require('./nexusColored');

export class SpectrogramPlaybackManager extends PlaybackManager {
    readonly spectrogramLocator: Spectrogram;
    private player: Tone.Player = new Tone.Player().toDestination();

    protected setPlaybackPositionDisplay(timePosition: number): void {
        this.spectrogramLocator.setPosition(timePosition);
    }

    protected getCurrentDisplayTimestep(): number {
        return 0;
    }

    private schedulePlaybackLoop() {
        this.player.sync();
        Tone.Transport.setLoopPoints(0, 4);
        Tone.Transport.loop = true;
        // stoping playback at every loop ensures that potential new audio
        // gets reloaded as it comes
        this.player.start(0).stop(3.99);
    };

    async loadAudio(audioURL: string): Promise<void> {
        await this.player.load(audioURL);
    };

    loadSpectrogram(serverURL: string, command: string, codes: number[][]): void {

    }

    constructor(duration_s: number, spectrogramLocator: Spectrogram) {
        super();
        this.schedulePlaybackLoop();
        this.spectrogramLocator = spectrogramLocator;
    }

    setFadeIn(duration_s: number) {
        this.player.fadeIn = duration_s
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