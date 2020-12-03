import { ipcMain } from 'electron'
import * as log from 'loglevel'
const abletonlink = require('abletonlink');

import * as WindowManager from '../windowManager'

// Code for Ableton-LINK server

let pattern_synchronization_duration_quarters = 4.
let link_channel_prefix: string = require('../../common/default_config.json')['link_channel_prefix'];
let link = undefined;
let link_enabled: boolean = false;

function isLinkInitialized(): boolean {
    return link != undefined
}

function isLinkEnabled(): boolean {
    return link_enabled
}

function setLinkEnabled(enable): void {
    link_enabled = enable;
    WindowManager.send(link_channel_prefix + 'enabled-status',
        isLinkEnabled());
}

function initAbletonLinkServer(bpm: number=120, quantum: number=4,
    enable: boolean=false): boolean {
    link = new abletonlink(bpm, quantum, enable);
    setLinkEnabled(enable)
    // TODO(theis): how to detect errors in initialization?
    log.info(link)
    let success = true

    link.on('tempo', (bpm) => {
            log.info('LINK: BPM changed, now ' + bpm)
            WindowManager.send(link_channel_prefix + 'tempo', bpm);
        }
    );

    link.on('numPeers', (numPeers) => {
            log.info('LINK: numPeers changed, now ' + numPeers);
            WindowManager.send(link_channel_prefix + 'numPeers', numPeers);
        }
    );

    return success
};

function startLinkDownbeatClock(updateRate_ms: number=16) {
    // Start a LINK-based downbeat clock using IPC messages
    // updateRate_ms, number: interval (in ms) between updates in the clock
    let lastBeat = 0.0;
    let lastPhase = 0.0;
    link.startUpdate(updateRate_ms, (beat, phase, bpm) => {
        beat = 0 ^ beat;
        if(0 < beat - lastBeat) {
            WindowManager.send('beat', { beat });
            lastBeat = beat;
        }
        if(0 > phase - lastPhase) {
            WindowManager.send(link_channel_prefix + 'downbeat');
            log.debug('LINK: downbeat');
        }
        lastPhase = phase;
    });
}

function stopLinkDownbeatClock() {
    // Stop the LINK-based downbeat clock
    link.stopUpdate();
}

// IPC API for the link server

// Initialize LINK server
export function attachListeners() {
    ipcMain.on(link_channel_prefix + 'init', (event, bpm, quantum) => {
        let return_promise = new Promise((resolve) => {
            // TODO(theis): could just throw error in main process
            // maybe not necessary to send error message to renderer
            let success = initAbletonLinkServer(bpm, quantum);
            resolve(success);
        });
        event.sender.send(link_channel_prefix + 'init-success', return_promise)
    }
    );


    ipcMain.on(link_channel_prefix + 'ping', (event) => {
        if (isLinkInitialized()) {
            event.sender.send(link_channel_prefix + 'initialized-status',
                true);
            event.sender.send(link_channel_prefix + 'enabled-status',
                isLinkEnabled());
        }
        else {
            event.sender.send(link_channel_prefix + 'initialized-status',
                false);
            event.sender.send(link_channel_prefix + 'enabled-status', false);
        }
    })

    // Update LINK on tempo changes coming from the client
    ipcMain.on(link_channel_prefix + 'tempo', (event, newBPM) => {
            // HACK perform a comparison to avoid messaging loops, since
            // the link update triggers a BPM modification message
            // from main to renderer
            if (isLinkInitialized() && link.bpm !== newBPM) {
                let link_bpm_before = link.bpm
                link.bpm = newBPM
                log.debug("LINK: Triggered LINK tempo update:")
                log.debug(`\tBefore: ${link_bpm_before}, now: ${newBPM}`)
            }
        }
    );


    // Enable LINK and start a downbeat clock to synchronize Transport
    ipcMain.on(link_channel_prefix + 'enable', (event) => {
            link.enable();  // enable backend LINK-server
            startLinkDownbeatClock();
            setLinkEnabled(true);
            event.sender.send(link_channel_prefix + 'enable-success', true)
        }
    );


    // Disable LINK
    ipcMain.on(link_channel_prefix + 'disable', (event) => {
            stopLinkDownbeatClock();
            link.disable();  // disable the backend LINK-server
            setLinkEnabled(false);
            event.sender.send(link_channel_prefix + 'disable-success', true)
        }
    );


    // Accessor for retrieving the current LINK tempo
    ipcMain.on(link_channel_prefix + 'get-bpm', (event) => {
            if (link.isEnabled()) { event.sender.send(
                    link_channel_prefix + 'bpm', link.bpm);
                }
            else { }
        }
    );

    ipcMain.on(link_channel_prefix + 'kill', () => killLink());
}

function disableLink() {
    if (isLinkInitialized()) {
        stopLinkDownbeatClock();
        link.disable();  // disable the backend LINK-server
    }
    setLinkEnabled(false);
}

export function killLink() {
    // kill the LINK server
    log.info('Killing the LINK server');
    disableLink();
    link = undefined;
    WindowManager.send(link_channel_prefix + 'initialized-status',
        false);
}
