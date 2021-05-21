import log from 'loglevel'
import { ipcRenderer } from 'electron'

import { BPMControl } from '../numberControl'
import { PlaybackManager } from '../playback'
import { Locator } from '../locator'

import default_config from '../../common/default_config.json'
const link_channel_prefix: string = default_config['link_channel_prefix']

let link_initialized = false
let link_enabled = false

function getState(): void {
  // get current state of the LINK-server on loading the client
  ipcRenderer.send(link_channel_prefix + 'ping')
}
getState() // necessary to now on start-up if the LINK server is already
// initialized/enabled

// the `quantum` defines the desired number of quarter-notes between each
// 'downbeat', which are used to synchronize Play events.
// with a `quantum` of 4, DeepBach will wait and start playback on the
// beginning of a new measure (in a 4/4 time-signature setting)
const linkQuantum = 4

// TODO(theis): remove module-level globals like this
let bpmControl: BPMControl = null

export function setBPMControl(newBpmControl: BPMControl) {
  bpmControl = newBpmControl
}

// Enable / Disable
export function isEnabled(): boolean {
  return link_enabled
}

export function isInitialized(): boolean {
  return link_initialized
}

export async function enable(playbackManager: PlaybackManager<Locator>) {
  if (!isInitialized()) {
    log.debug('Must initialize LINK')
    const bpm: number = bpmControl.value
    const quantum: number = linkQuantum

    ipcRenderer.send(link_channel_prefix + 'init', bpm, quantum)
    link_initialized = true
  }
  ipcRenderer.send(link_channel_prefix + 'enable')
  ipcRenderer.once(
    link_channel_prefix + 'enabled-status',
    (_, enabledStatus: boolean) => {
      if (enabledStatus) {
        playbackManager.synchronizeToLink()
      }
    }
  )
}

export function disable(): void {
  if (isInitialized()) {
    ipcRenderer.send(link_channel_prefix + 'disable')
  }
}

export function kill(): void {
  ipcRenderer.send(link_channel_prefix + 'kill')
}

ipcRenderer.on(
  link_channel_prefix + 'initialized-status',
  (_, initializedStatus: boolean) => {
    link_initialized = initializedStatus
    log.debug('initializedStatus:')
    log.debug(initializedStatus)
  }
)

ipcRenderer.on(
  link_channel_prefix + 'enabled-status',
  (_, enabledStatus: boolean) => {
    link_enabled = enabledStatus
    log.debug(enabledStatus)
    log.debug('enabledStatus:')
  }
)

// ipcRenderer.on(link_channel_prefix + 'enable-success', (_, enable_succeeded: boolean) => {
//         if (enable_succeeded) {
//             link_enabled = true;
//             setBPMtoLinkBPM_async();
//             log.info('Succesfully enabled Link');
//         }
//         else {log.error('Failed to enable Link')}
//     }
// )
//
// ipcRenderer.on(link_channel_prefix + 'disable-success', (_, disable_succeeded) => {
//         if (disable_succeeded) {
//             link_enabled = false;
//             log.info('Succesfully disabled Link');
//         }
//         else {log.error('Failed to disable Link')}
//     }
// )

// Tempo
ipcRenderer.on(link_channel_prefix + 'bpm', (_, newBPM) => {
  bpmControl.value = newBPM
})

export function getPhaseSynchronous(): number {
  return ipcRenderer.sendSync(link_channel_prefix + 'get-phase-sync')
}

// retrieve current BPM from Link
export function setBPMtoLinkBPM_async(): void {
  if (isEnabled()) {
    ipcRenderer.send(link_channel_prefix + 'get-bpm')
  }
}

export function updateLinkBPM(newBPM) {
  ipcRenderer.send(link_channel_prefix + 'bpm', newBPM)
}

// numPeers
ipcRenderer.on('numPeers', (_, numPeers) => {
  // this display is required as per the Ableton-link test-plan
  // (https://github.com/Ableton/link/blob/master/TEST-PLAN.md)
  new Notification('DeepBach/Ableton LINK interface', {
    body: 'Number of peers changed, now ' + numPeers + ' peers',
  })
})

// Schedule a LINK dependent callback
export function on(message, callback) {
  ipcRenderer.on(link_channel_prefix + message, () => {
    callback()
  })
}

// Schedule a LINK dependent callback once
export function once(message, callback) {
  ipcRenderer.once(link_channel_prefix + message, () => {
    callback()
  })
}

export function init() {}
