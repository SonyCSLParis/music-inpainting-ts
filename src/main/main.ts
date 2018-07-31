// Modules to control application life and create native browser window
import {app, BrowserWindow, ipcMain} from 'electron'
import * as log from 'loglevel'
log.enableAll()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadFile(__dirname + '/index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

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
  if (mainWindow === null) {
    createWindow()
  }
})

// code for ableton-link server
const abletonlink = require('abletonlink');

let pattern_synchronization_duration_quarters = 4.
let link_channel_prefix: string = 'link/'
let link;

function initAbletonLinkServer(bpm: number=120, quantum: number=4,
    enable: boolean=false): boolean {
    link = new abletonlink(bpm=120., quantum, enable);
    // TODO(theis): how to detect errors in initialization?
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

function startDownbeatClock(updateRate: number=16) {
    // Start a downbeat clock
    (() => {
        let lastBeat = 0.0;
        let lastPhase = 0.0;
        link.startUpdate(updateRate, (beat, phase, bpm) => {
            beat = 0 ^ beat;
            if(0 < beat - lastBeat) {
                mainWindow.webContents.send('beat', { beat });
                lastBeat = beat;
            }
            if(0 > phase - lastPhase) {
                mainWindow.webContents.send('downbeat');
                log.debug('LINK: downbeat');
            }
            lastPhase = phase;
        });
    })();
}

ipcMain.on(link_channel_prefix + 'init', (event, _) => {
        let return_promise = new Promise((resolve) => {
            // TODO(theis): could just throw error in main process
            // maybe not necessary to send error message to renderer
            let success = initAbletonLinkServer();
            resolve(success);
        });
        event.sender.send(link_channel_prefix + 'init-success', return_promise)
    }
);

// IPC API for the link server
ipcMain.on(link_channel_prefix + 'event', function(data){});

// bind to Link specific events
ipcMain.on(link_channel_prefix + 'tempo', (event, newBPM) => {
        // HACK perform a comparison to avoid messaging loops, since
        // the link update triggers a BPM modification message
        // from main to renderer
        if (link.bpm !== newBPM) link.bpm = newBPM
    }
);
ipcMain.on(link_channel_prefix + 'enable', (event, _) => {
        link.enable();
        startDownbeatClock();
        event.sender.send(link_channel_prefix + 'enable-success', true)
    }
);
ipcMain.on(link_channel_prefix + 'disable', (event, _) => {
        // TODO is this actually desirable???
        link.stopUpdate();
        link.disable();
        event.sender.send(link_channel_prefix + 'disable-success', true)
    }
);

ipcMain.on(link_channel_prefix + 'get_bpm', (event, _) => {
    event.sender.send(link_channel_prefix + 'bpm', link.bpm);
    }
);

ipcMain.on('disconnect', function(){});

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
