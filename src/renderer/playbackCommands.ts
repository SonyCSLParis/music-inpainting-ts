import * as log from 'loglevel'
// import { library, icon } from '@fortawesome/fontawesome-free'

import '@fortawesome/fontawesome-free/css/all.css';
// library.add(icon({ prefix: 'fas', iconName: 'stop-circle' }));
// library.add(icon({ prefix: 'fas', iconName: 'play-circle' }));

import Nexus from './nexusColored';

import { PlaybackManager } from './playback';
import { Locator } from './locator';
import * as ControlLabels from './controlLabels';

let playbackManager: PlaybackManager<Locator>;

export function setPlaybackManager(newPlaybackManager: PlaybackManager<Locator>): void {
    playbackManager = newPlaybackManager
}

export function render(container: HTMLElement): void{
    async function playbackCallback(play: boolean) {
        if (play) {
            await playbackManager.play();
        }
        else {
            await playbackManager.stop();
        }
    }

    const stoppedClasses: string[] = ['stopped', 'fa-play-circle'];
    const playingClasses: string[] = ['playing', 'fa-stop-circle'];
    const waitingClass: string = 'fa-circle-notch';

    const mainIconSize: string = 'fa-4x';

    const playbuttonContainer: HTMLElement = document.createElement('control-item');
    playbuttonContainer.id = 'play-button-container';
    container.appendChild(playbuttonContainer);

    ControlLabels.createLabel(playbuttonContainer, 'play-button-label', false, null, container);

    const playButtonInterface = document.createElement('i');
    playButtonInterface.id = 'play-button-interface';
    playbuttonContainer.appendChild(playButtonInterface)
    playButtonInterface.classList.add('fas');
    playButtonInterface.classList.add(mainIconSize);
    playButtonInterface.style.alignSelf = 'inherit';
    playButtonInterface.style.cursor = 'pointer';

    function setPlayingClass(isPlaying: boolean) {
        // Update Play/Stop CSS classes
        unsetWaitingClass();
        if (isPlaying) {
            playButtonInterface.classList.add(...playingClasses);
            playButtonInterface.classList.remove(...stoppedClasses);
        }
        else {
            playButtonInterface.classList.add(...stoppedClasses);
            playButtonInterface.classList.remove(...playingClasses);
        }
    }
    function setWaitingClass() {
        // Replace the playback icon with a rotating 'wait' icon until
        // playback state correctly updated
        playButtonInterface.classList.remove(...playingClasses);
        playButtonInterface.classList.remove(...stoppedClasses);

        playButtonInterface.classList.add('fa-spin');  // spinning icon
        playButtonInterface.classList.add(waitingClass);
    }
    function unsetWaitingClass() {
        // Remove rotating 'wait' icon
        playButtonInterface.classList.remove('fa-spin');  // spinning icon
        playButtonInterface.classList.remove(waitingClass);
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
        playCallback(playButtonInterface.classList.contains(stoppedClasses[0]));
    };

    playButtonInterface.addEventListener('click', togglePlayback);

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
    const linkbuttonElem: HTMLElement = document.createElement('control-item');
    linkbuttonElem.id = 'sync-button'
    linkbuttonElem.classList.add('advanced');
    container.appendChild(linkbuttonElem);

    const syncbutton = new Nexus.TextButton('#sync-button',{
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
