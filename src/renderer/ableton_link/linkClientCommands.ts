import { AbletonLinkClient } from './linkClient.abstract'
import * as ControlLabels from '../controlLabels'

import Nexus from '../nexusColored'
import { PlaybackManager } from '../playback'
import MidiSheetPlaybackManager from '../sheetPlayback'
import { NumberControl } from '../numberControl'

export function render(
  container: HTMLElement,
  linkClient: AbletonLinkClient,
  playbackManager: MidiSheetPlaybackManager
): void {
  const linkEnableButtonElement = document.createElement('div')
  linkEnableButtonElement.id = 'link-enable-button'
  linkEnableButtonElement.classList.add('control-item')
  container.appendChild(linkEnableButtonElement)

  const linkEnableButton = new Nexus.Button('#link-enable-button', {
    size: [30, 30],
    state: false,
    mode: 'toggle',
  })
  linkEnableButton.on('change', (enable: boolean) => {
    if (enable) {
      linkEnableButton.turnOff(false)
    } else {
      linkEnableButton.turnOn(false)
    }
    void linkClient.pingServer().then(() => {
      if (enable) {
        void linkClient.enable().then(() => linkEnableButton.turnOn(false))
      } else {
        linkClient.disable()
        linkEnableButton.turnOff(false)
      }
    })
  })
  ControlLabels.createLabel(
    linkEnableButton.element,
    'link-enable-button-label',
    false,
    undefined,
    container
  )

  // Add manual Link-Sync button
  renderSyncButton(container, playbackManager)
  renderDownbeatDisplay(container, linkClient)
}

function renderSyncButton(
  container: HTMLElement,
  playbackManager: PlaybackManager
): void {
  const linkButtonElement = document.createElement('div')
  linkButtonElement.id = 'sync-button'
  linkButtonElement.classList.add('control-item', 'advanced')
  container.appendChild(linkButtonElement)

  const syncButton = new Nexus.Button('#sync-button', {
    size: [30, 30],
    state: false,
    mode: 'impulse',
  })
  syncButton.on('change', (enable: boolean) => {
    if (enable) {
      playbackManager.synchronizeToLink()
    }
  })

  ControlLabels.createLabel(
    syncButton.element,
    'link-force-resync-button-label',
    false,
    undefined,
    container
  )
}

export function renderDownbeatDisplay(
  container: HTMLElement,
  linkClient: AbletonLinkClient
): void {
  const linkDownbeatDisplayElement = document.createElement('div')
  linkDownbeatDisplayElement.id = 'link-downbeat-display'
  linkDownbeatDisplayElement.classList.add('control-item', 'disable-mouse')
  linkDownbeatDisplayElement.style.pointerEvents = 'none'
  container.appendChild(linkDownbeatDisplayElement)

  const linkDownbeatDisplayButton = new Nexus.Button('#link-downbeat-display', {
    size: [20, 20],
    state: false,
    mode: 'button',
  })
  ControlLabels.createLabel(
    linkDownbeatDisplayButton.element,
    'link-downbeat-display-label',
    true,
    undefined,
    container
  )

  let linkDisplayTimeout: NodeJS.Timeout
  linkClient.on('downbeat', () => {
    linkDownbeatDisplayButton.down()
    if (linkDisplayTimeout) clearTimeout(linkDisplayTimeout)
    linkDisplayTimeout = setTimeout(() => linkDownbeatDisplayButton.up(), 50)
  })
}

export function renderLatencyControl(
  container: HTMLElement,
  playbackManager: MidiSheetPlaybackManager
): void {
  const latencyControl = new NumberControl(
    container,
    'latency-control',
    [0, 1500],
    0,
    (value) => {
      playbackManager.transport.context.lookAhead = value / 1000
      playbackManager.transport.context.emit('statechange')
    },
    0.5
  )
  latencyControl.render(false, 200)
}
