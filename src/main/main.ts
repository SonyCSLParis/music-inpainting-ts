// Modules to control application life
import {app, ipcMain} from 'electron'
import * as log from 'loglevel'

import * as WindowManager from './windowManager'
import * as LinkServer from './linkServer'

const isDevelopment = process.env.NODE_ENV !== 'production'

if (isDevelopment) { log.setLevel('debug'); }
else { log.setLevel('info'); }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', WindowManager.createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!WindowManager.existsWindow()) {
    WindowManager.createWindow()
  }
})

// Code for Ableton-LINK server

let pattern_synchronization_duration_quarters = 4.
let link_channel_prefix: string = require('../common/config.json')['link_channel_prefix'];
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
    mainWindow.webContents.send(link_channel_prefix + 'enabled-status',
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
            mainWindow.webContents.send(link_channel_prefix + 'tempo', bpm);
        }
    );

    link.on('numPeers', (numPeers) => {
            log.info('LINK: numPeers changed, now ' + numPeers);
            mainWindow.webContents.send(link_channel_prefix + 'numPeers', numPeers);
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
            mainWindow.webContents.send('beat', { beat });
            lastBeat = beat;
        }
        if(0 > phase - lastPhase) {
            mainWindow.webContents.send(link_channel_prefix + 'downbeat');
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
ipcMain.on(link_channel_prefix + 'get_bpm', (event) => {
        if (link.isEnabled()) { event.sender.send(
                link_channel_prefix + 'bpm', link.bpm);
            }
        else { }
    }
);

function disableLink() {
    if (isLinkInitialized()) {
        stopLinkDownbeatClock();
        link.disable();  // disable the backend LINK-server
    }
    setLinkEnabled(false);
}

function killLink() {
    // kill the LINK server
    log.info('Killing the LINK server');
    disableLink();
    link = undefined;
    mainWindow.webContents.send(link_channel_prefix + 'initialized-status',
        false);
}

ipcMain.on(link_channel_prefix + 'kill', () => killLink());

ipcMain.on('disconnect', () => killLink());

//
// (() => {
//     let lastBeat = 0.0;
//     let lastPhase = 0.0;
//     link.startUpdate(16, (beat, phase, bpm) => {
//         beat = 0 ^ beat;
//         if(0 < beat - lastBeat) {
//             io.emit('beat', { beat });
//             lastBeat = beat;
//         }
//         if(0 > phase - lastPhase) {
//             io.emit('downbeat');
//             console.log('downbeat')
//         }
//         lastPhase = phase;
//     });
// })();

if (module.hot) {
    module.hot.accept();
}
