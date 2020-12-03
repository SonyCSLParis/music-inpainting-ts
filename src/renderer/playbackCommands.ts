import * as log from 'loglevel'
// import { library, icon } from '@fortawesome/fontawesome-free'

import '@fortawesome/fontawesome-free/css/all.css';
// library.add(icon({ prefix: 'fas', iconName: 'stop-circle' }));
// library.add(icon({ prefix: 'fas', iconName: 'play-circle' }));

import Nexus from './nexusColored';

import { PlaybackManager } from './playback';
import { Locator } from './locator';

let playbackManager: PlaybackManager<Locator>;

export function setPlaybackManager(newPlaybackManager: PlaybackManager<Locator>): void {
    playbackManager = newPlaybackManager
}

export function render(containerElement: HTMLElement): void{
    async function playbackCallback(play: boolean) {
        if (play) {
            await playbackManager.play();
        }
        else {
            await playbackManager.stop();
        }
    }

    let stoppedClasses: string[] = ['stopped', 'fa-play-circle'];
    let playingClasses: string[] = ['playing', 'fa-stop-circle'];
    let waitingClass: string = 'fa-circle-notch';

    let mainIconSize: string = 'fa-4x';

    let playButton = document.createElement('i');
    playButton.id = 'play-button';
    containerElement.appendChild(playButton)
    playButton.classList.add('fas');
    playButton.classList.add(mainIconSize);
    playButton.style.alignSelf = 'inherit';
    playButton.style.cursor = 'pointer';

    function setPlayingClass(isPlaying: boolean) {
        // Update Play/Stop CSS classes
        unsetWaitingClass();
        if (isPlaying) {
            playButton.classList.add(...playingClasses);
            playButton.classList.remove(...stoppedClasses);
        }
        else {
            playButton.classList.add(...stoppedClasses);
            playButton.classList.remove(...playingClasses);
        }
    }
    function setWaitingClass() {
        // Replace the playback icon with a rotating 'wait' icon until
        // playback state correctly updated
        playButton.classList.remove(...playingClasses);
        playButton.classList.remove(...stoppedClasses);

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

    async function playCallback(play: boolean) {
        setWaitingClass();
        await playbackCallback(play);
        unsetWaitingClass();
        setPlayingClass(play);
    };

    function pressPlay() {
        playCallback(true);
    };

    function pressStop() {
        playCallback(false);
    };

    function togglePlayback() {
        playCallback(playButton.classList.contains(stoppedClasses[0]));
    };

    playButton.addEventListener('click', togglePlayback);

    document.addEventListener("keydown", (event) => {
        const keyName = event.key
        switch (keyName) {
            case 'Spacebar':
                // disable scrolling on Spacebar press
                log.debug('SPACEBAR target: ' + event.target);

                if (event.target == document.body) { log.debug('HEY SPACEBAR!'); event.preventDefault(); };
            case ' ':
                event.preventDefault();
                togglePlayback();
                break;
            case 'p':
                event.preventDefault();
                pressPlay();
                break;
            case 's':
                event.preventDefault();
                pressStop();
                break
    }}, );
};

export function renderSyncButton(container: HTMLElement) {
    let linkbuttonElem: HTMLElement = document.createElement('control-item');
    linkbuttonElem.id = 'sync-button'
    container.appendChild(linkbuttonElem);

    let syncbutton = new Nexus.TextButton('#sync-button',{
        'size': [150,50],
        'state': false,
        'text': 'Sync'
    });

    syncbutton.on('change', (enable: Boolean) => {
        if (enable) {
            // Playback.getPlayNoteByMidiChannel(1, false)('', {duration: '4n', 'name': 'C5', 'midi': 60, velocity: 0.8})
            playbackManager.synchronizeToLink();
        }
    });
}
