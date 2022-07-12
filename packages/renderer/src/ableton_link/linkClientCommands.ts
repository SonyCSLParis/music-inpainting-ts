import { AbletonLinkClient } from './linkClient.abstract'
import * as ControlLabels from '../controlLabels'

import Nexus from '../nexusColored'
import MidiSheetPlaybackManager from '../sheetPlayback'
import {
  BooleanValue,
  CycleSelectEnableDisableFontAwesomeView,
} from '../cycleSelect'

export function render(
  container: HTMLElement,
  linkClient: AbletonLinkClient,
  playbackManager: MidiSheetPlaybackManager
): void {
  const linkClientSetupContainerElement: HTMLElement =
    document.createElement('div')
  linkClientSetupContainerElement.id = 'ableton-link-client-setup-container'
  linkClientSetupContainerElement.classList.add('gridspan')
  linkClientSetupContainerElement.classList.add('advanced')
  container.appendChild(linkClientSetupContainerElement)

  ControlLabels.createLabel(
    linkClientSetupContainerElement,
    'ableton-link-client-setup-container-label',
    true,
    undefined,
    container
  )

  const linkEnableButtonElement = document.createElement('div')
  linkEnableButtonElement.id = 'link-enable-button'
  linkEnableButtonElement.classList.add('control-item')
  linkClientSetupContainerElement.appendChild(linkEnableButtonElement)

  const linkEnableToggle = new BooleanValue(false)
  const linkEnableButton = new CycleSelectEnableDisableFontAwesomeView(
    linkEnableToggle
  )
  linkEnableButtonElement.appendChild(linkEnableButton)

  linkEnableToggle.on('change', (enable: boolean | null) => {
    void linkClient.pingServer().then(() => {
      if (enable) {
        void linkClient.enable() //.then(() => linkEnableButton.turnOn(false))
      } else {
        linkClient.disable()
        // linkEnableButton.turnOff(false)
      }
    })
  })
  ControlLabels.createLabel(
    linkEnableButtonElement,
    'ableton-link-client-enable-button-label',
    false,
    undefined,
    linkClientSetupContainerElement
  )

  renderDownbeatDisplay(linkClientSetupContainerElement, linkClient)
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
    'ableton-link-client-downbeat-display-label',
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
