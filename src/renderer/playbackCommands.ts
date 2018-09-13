import * as log from 'loglevel'
// import { library, icon } from '@fortawesome/fontawesome-free'

import '@fortawesome/fontawesome-free/css/all.css'
// library.add(icon({ prefix: 'fas', iconName: 'stop-circle' }));
// library.add(icon({ prefix: 'fas', iconName: 'play-circle' }));

import * as Playback from './playback'

let pressPlay;
let pressStop;
export function render(): void{
    let topControlsGridElem = document.getElementById('bottom-controls')
    let playbuttonElem: HTMLElement = document.createElement('control-item');
    playbuttonElem.id = 'play-button'
    topControlsGridElem.appendChild(playbuttonElem);

    function playbackCallback(play: boolean) {
        return new Promise((resolve, _) => {
            if (play) {
                Playback.play().then(resolve);
            }
            else {
                Playback.stop();
                Playback.resetPlaybackPositionDisplay();
                resolve();
            }
        })
    }

    let stoppedClass: string = 'fa-play-circle';
    let playingClass: string = 'fa-stop-circle';
    let waitingClass: string = 'fa-circle-notch';

    let mainIconSize: string = 'fa-4x';

    let playButton = document.createElement('i');
    playbuttonElem.appendChild(playButton)
    playButton.classList.add('fas');
    playButton.classList.add(mainIconSize);
    playButton.style.alignSelf = 'inherit';
    playButton.style.cursor = 'pointer';
    // FIXME not super visible
    playButton.style.color = 'lightpink';

    function setPlayingClass(isPlaying: boolean) {
        // Update Play/Stop CSS classes
        unsetWaitingClass();
        if (isPlaying) {
            playButton.classList.add(playingClass);
            playButton.classList.remove(stoppedClass);
        }
        else {
            playButton.classList.add(stoppedClass);
            playButton.classList.remove(playingClass);
        }
    }
    function setWaitingClass() {
        // Replace the playback icon with a rotating 'wait' icon until
        // playback state correctly updated
        playButton.classList.remove(playingClass);
        playButton.classList.remove(stoppedClass);

        playButton.classList.add('fa-spin');  // spinning icon
        playButton.classList.add(waitingClass);
    }
    function unsetWaitingClass() {
        // Remove rotating 'wait' icon
        playButton.classList.remove('fa-spin');  // spinning icon
        playButton.classList.remove(waitingClass);
    }
    // Initialize playback to stopped
    setPlayingClass(false);

        pressPlay = () => {playCallback(true);}

        pressStop = () => {playCallback(false);}

        playButton.addEventListener('click', () => {
            playCallback(playButton.classList.contains(stoppedClass));
        });
    }

        playButton.on('change', (state) => playbackCallback(state))

        pressPlay = () => playButton.up();
        pressStop = () => playButton.down();
    }

    document.addEventListener("keydown", (event) => {
        const keyName = event.key
        switch (keyName) {
            case 'Spacebar':
                // disable scrolling on press Spacebar
                log.debug('SPACEBAR target: ' + event.target);

                if (event.target == document.body) { log.debug('HEY SPACEBAR!'); event.preventDefault(); };
            case ' ':
            case 'p':
                pressPlay();
                break;
            case 's':
                pressStop();
                break
    }}, );
}
