import * as log from 'loglevel'

let Nexus = require('./nexusColored');

import * as Playback from './playback'

let playButton;

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
