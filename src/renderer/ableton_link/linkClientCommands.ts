import LinkClient from './linkClient';
import * as ControlLabels from '../controlLabels';

import Nexus from '../nexusColored';
import { PlaybackManager } from '../playback';
import { Locator } from '../locator';

export function render(playbackManager: PlaybackManager<Locator>) {
    let bottomControlsGridElem = document.getElementById('bottom-controls')
    const abletonLinkSettingsGridspan = document.createElement('div');
    abletonLinkSettingsGridspan.id = 'ableton-link-settings-gridspan';
    abletonLinkSettingsGridspan.classList.add('gridspan');
    abletonLinkSettingsGridspan.classList.add('advanced');
    bottomControlsGridElem.appendChild(abletonLinkSettingsGridspan);

    let linkEnableButtonElem: HTMLElement = document.createElement('control-item');
    linkEnableButtonElem.id = 'link-enable-button'
    abletonLinkSettingsGridspan.appendChild(linkEnableButtonElem);

    let linkEnableButton = new Nexus.Button('#link-enable-button',{
        'size': [30,30],
        'state': false,
        'mode': 'toggle',
    });
    linkEnableButton.on('change', (enable: Boolean) => {
        if (enable) {
            LinkClient.enable(playbackManager);
        }
        else {
            LinkClient.disable()
        }
    });
    ControlLabels.createLabel(linkEnableButton, 'link-enable-button-label',
        false, null, abletonLinkSettingsGridspan);

    // Add manual Link-Sync button
    renderSyncButton(abletonLinkSettingsGridspan, playbackManager);

    renderDownbeatDisplay();
};

function renderSyncButton(container: HTMLElement, playbackManager: PlaybackManager<Locator>) {
    const linkbuttonElem: HTMLElement = document.createElement('control-item');
    linkbuttonElem.id = 'sync-button'
    linkbuttonElem.classList.add('advanced');
    container.appendChild(linkbuttonElem);

    const syncButton = new Nexus.Button('#sync-button',{
        'size': [30, 30],
        'state': false,
        'mode': 'impulse'
    });
    syncButton.on('change', (enable: Boolean) => {
        if (enable) {
            playbackManager.synchronizeToLink();
        }
    });

    ControlLabels.createLabel(syncButton, 'link-force-resync-button-label',
        false, null, container);
};


export function renderDownbeatDisplay(): void{
    let abletonLinkSettingsGridspan = document.getElementById('ableton-link-settings-gridspan');
    let linkDownbeatDisplayElem: HTMLElement = document.createElement('control-item');
    linkDownbeatDisplayElem.id = 'link-downbeat-display';
    linkDownbeatDisplayElem.classList.add('disable-mouse');
    linkDownbeatDisplayElem.style.pointerEvents = 'none';
    abletonLinkSettingsGridspan.appendChild(linkDownbeatDisplayElem);

    let linkDownbeatDisplayButton = new Nexus.Button('#link-downbeat-display',{
        'size': [20, 20],
        'state': false,
        'mode': 'button'
    });
    ControlLabels.createLabel(linkDownbeatDisplayButton, 'link-downbeat-display-label', true, null,
        abletonLinkSettingsGridspan);

    let linkDisplayTimeout: NodeJS.Timeout
    LinkClient.on('downbeat', () => {
        linkDownbeatDisplayButton.down();
        if (linkDisplayTimeout) clearTimeout(linkDisplayTimeout);
        linkDisplayTimeout = setTimeout(() => linkDownbeatDisplayButton.up(), 100)}
    )
}
