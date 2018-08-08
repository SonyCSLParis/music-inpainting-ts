import * as Tone from 'tone'
import * as log from 'loglevel'

let Nexus = require('./nexusColored');

import * as LinkClient from './linkClient';
import * as Playback from './playback'

let playButton;
let stopButton;


export function render(): void{
    let topControlsGridElem = document.getElementById('top-controls')
    let playbuttonElem: HTMLElement = document.createElement('top-control-item');
    playbuttonElem.id = 'play-button'
    topControlsGridElem.appendChild(playbuttonElem);

    playButton = new Nexus.TextButton('#play-button',{
        'size': [150,50],
        'state': false,
        'text': 'Play',
        'alternateText': 'Stop'
    })
    playButton.on('change', (state) => {
        if (state) {
            Playback.play()
        }
        else {Playback.stop(); Playback.resetPlaybackPositionDisplay();}
    })

    // let stopbuttonElem: HTMLElement = document.createElement('top-control-item');
    // stopbuttonElem.id = 'stop-button';
    // topControlsGridElem.appendChild(stopbuttonElem);
    //
    // stopButton = new Nexus.TextButton('#stop-button',{
    //     'size': [150,50],
    //     'state': false,
    //     'text': 'Stop'
    // })
    // stopButton.on('change', (event) => {
    //     playButton.flip(false);
    //     Tone.Transport.stop();
    //     Playback.resetPlaybackPositionDisplay();  // update the graphics
    // });

    document.addEventListener("keydown", (event) => {
        const keyName = event.key
        switch (keyName) {
            case 'Spacebar':
                // disable scrolling on press Spacebar
                log.debug('SPACEBAR target: ' + event.target);

                if (event.target == document.body) { log.debug('HEY SPACEBAR!'); event.preventDefault(); };
            case ' ':
            case 'p':
                playButton.down();
                break;
            case 's':
                playButton.up();
                break
    }}, );
}
