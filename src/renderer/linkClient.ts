import { ipcRenderer } from 'electron'
import * as log from 'loglevel'
import * as $ from 'jquery'

let Nexus = require('./nexusColored')

import * as BPM from './bpm'

let link_channel_prefix: string = require('../common/config.json')['link_channel_prefix'];

let link_initialized: boolean = false;
let link_enabled: boolean = false;

function getState(): void {
    // get current state of the LINK-server on loading the client
    ipcRenderer.send(link_channel_prefix + 'ping');
}
getState();

// the `quantum` defines the desired number of quarter-notes between each
// 'downbeat', which are used to synchronize Play events.
// with a `quantum` of 4, DeepBach will wait and start playback on the
// beginning of a new measure (in a 4/4 time-signature setting)
let linkQuantum: number = 4;


export function render() {
    let topControlsGridElem = document.getElementById('top-controls')
    let linkbuttonElem: HTMLElement = document.createElement('top-control-item');
    linkbuttonElem.id = 'link-button'
    topControlsGridElem.appendChild(linkbuttonElem);

    let linkbutton = new Nexus.TextButton('#link-button',{
        'size': [150,50],
        'state': false,
        'text': 'Enable LINK',
        'alternateText': 'Disable LINK'
    });

    linkbutton.on('change', link_enable_callback);
}

let linkDisplayTimeout;
export function renderDownbeatDisplay(): void{
    let topControlsGridElem = document.getElementById('top-controls')
    let linkdisplayElem: HTMLElement = document.createElement('top-control-item');
    linkdisplayElem.id = 'link-display';
    linkdisplayElem.style.pointerEvents = 'none';
    topControlsGridElem.appendChild(linkdisplayElem);

    let linkdisplayButton = new Nexus.Button('#link-display',{
        'size': [40, 40],
        'state': false,
        'mode': 'button'
    });

    ipcRenderer.on(link_channel_prefix + 'downbeat', () => {
        linkdisplayButton.down();
        if (linkDisplayTimeout) clearTimeout(linkDisplayTimeout);
        linkDisplayTimeout = setTimeout(() => linkdisplayButton.up(), 100)}
    )
}


// Enable / Disable

export function isEnabled(): boolean {
    return link_enabled
}

export function isInitialized(): boolean {
    return link_initialized
}

export function enable(): void {
    link_enable_callback(true);
}

export function disable(): void {
    link_enable_callback(false);
}

export function kill(): void {
    ipcRenderer.send(link_channel_prefix + 'kill');
}

async function link_enable_callback(enable_value) {
    if (enable_value) {
        if (!isInitialized()) {
            let bpm: number = BPM.getBPM();
            let quantum: number = linkQuantum;
            // hang asynchronously on this call
            await ipcRenderer.send(link_channel_prefix + 'init', bpm, quantum)
            link_initialized = true
        }
        ipcRenderer.send(link_channel_prefix + 'enable')
    }
    else {
        if (isInitialized()) {
            ipcRenderer.send(link_channel_prefix + 'disable');
        }
    }
}

ipcRenderer.on(link_channel_prefix + 'initialized-status', (event, initializedStatus) => {
    link_initialized = initializedStatus;
});


ipcRenderer.on(link_channel_prefix + 'enabled-status', (event, enabledStatus) => {
    link_enabled = enabledStatus;
});


ipcRenderer.on(link_channel_prefix + 'enable-success', (event, enable_succeeded) => {
        if (enable_succeeded) {
            link_enabled = true;
            setBPMtoLinkBPM_async();
            log.info('Succesfully enabled Link');
        }
        else {log.error('Failed to enable Link')}
    }
)

ipcRenderer.on(link_channel_prefix + 'disable-success', (event, disable_succeeded) => {
        if (disable_succeeded) {
            link_enabled = false;
            log.info('Succesfully disabled Link');
        }
        else {log.error('Failed to disable Link')}
    }
)


// Tempo
ipcRenderer.on(link_channel_prefix + 'tempo', (event, newBPM) => {
    BPM.setBPM(newBPM); }
);

export function setBPMtoLinkBPM_async(): void {
    if (isEnabled()) {
        ipcRenderer.emit(link_channel_prefix + 'get_bpm');
    }
}

export function updateLinkBPM(newBPM) {
    ipcRenderer.send(link_channel_prefix + 'tempo', newBPM);
}

// numpPeers
ipcRenderer.on('numPeers', (numPeers) => {
    // this display is required as per the Ableton-link test-plan
    // (https://github.com/Ableton/link/blob/master/TEST-PLAN.md)
    new Notification('DeepBach/Ableton LINK interface', {
        body: 'Number of peers changed, now ' + numPeers + ' peers'
  })
})


// Schedule a LINK dependent callback
export function once(message, callback) {
    ipcRenderer.once(link_channel_prefix + message, () => {
        callback();;
    })
}
