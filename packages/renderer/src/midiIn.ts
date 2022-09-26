import log from 'loglevel'

import * as ControlLabels from './controlLabels'
import { NumberControl } from './numberControl'

import Nexus from './nexusColored'
import type { NexusNumber, NexusSelect } from 'nexusui'

import { ToneMidiInput } from './midi_io/midiInput'

let globalMidiInputListener: ToneMidiInput | null = null

export async function getMidiInputListener(): Promise<ToneMidiInput | null> {
  await ToneMidiInput.enabled()
  if (globalMidiInputListener == null) {
    globalMidiInputListener = new ToneMidiInput(null)
  }
  return globalMidiInputListener
}

export async function render(useChordsInstrument = false): Promise<void> {
  const bottomControlsGridElement = document.getElementById('bottom-controls')

  const midiInputSetupGridspanElement: HTMLElement =
    document.createElement('div')
  midiInputSetupGridspanElement.id = 'midi-input-setup-gridspan'
  midiInputSetupGridspanElement.classList.add('gridspan', 'advanced')
  bottomControlsGridElement.appendChild(midiInputSetupGridspanElement)

  try {
    await getMidiInputListener()
  } catch (error) {
    // no Web MIDI API support in the browser
    log.info('Failed in rendering Midi-Input controls with message: ', error)
    midiInputSetupGridspanElement.classList.add('disabled-gridspan')
    midiInputSetupGridspanElement.innerHTML =
      'No Web MIDI API support<br>Try using Google Chrome'
    return
  }

  const midiInputSetupContainerElement: HTMLElement =
    document.createElement('div')
  midiInputSetupContainerElement.id = 'midi-input-setup-container'
  midiInputSetupContainerElement.classList.add('gridspan', 'advanced')
  midiInputSetupGridspanElement.appendChild(midiInputSetupContainerElement)
  ControlLabels.createLabel(
    midiInputSetupContainerElement,
    'midi-input-setup-container-label',
    true,
    undefined,
    midiInputSetupGridspanElement
  )

  const midiInDeviceSelectElement: HTMLElement = document.createElement('div')
  midiInDeviceSelectElement.id = 'midi-input-device-select-container'
  midiInDeviceSelectElement.classList.add('advanced', 'control-item')
  midiInputSetupContainerElement.appendChild(midiInDeviceSelectElement)
  ControlLabels.createLabel(
    midiInDeviceSelectElement,
    'midi-input-device-select-container-label',
    true,
    undefined,
    midiInputSetupContainerElement
  )

  const disabledInputId = 'Disabled'

  async function makeOptions(): Promise<string[]> {
    const devices = await ToneMidiInput.getDevices()
    const devicesNames = devices.map((data) => data.name)
    return [disabledInputId, 'All'].concat(devicesNames)
  }

  const midiInSelect = new Nexus.Select(midiInDeviceSelectElement, {
    size: [150, 50],
    options: await makeOptions(),
  })

  async function updateOptions(): Promise<void> {
    const currentInput = midiInSelect.value
    const newOptions = await makeOptions()
    midiInSelect.defineOptions(newOptions)
    if (newOptions.includes(currentInput)) {
      // restore previously selected input
      midiInSelect.value = currentInput
    } else {
      // previously selected input is not available anymore,
      // disable input for safety
      midiInSelect.value = disabledInputId
    }
    log.info(
      '[MIDI IN]: Updated list of inputs, now',
      JSON.stringify(newOptions)
    )
  }

  const midiInputListener = await getMidiInputListener()
  if (midiInputListener == null) {
    return
  }
  midiInputListener.on('connect', () => void updateOptions())
  midiInputListener.on('disconnect', () => void updateOptions())

  async function midiInOnChange(this: NexusSelect): Promise<void> {
    const midiInputListener = await getMidiInputListener()
    if (midiInputListener == null) {
      return
    }
    await midiInputListener.setDevice(this.value.toLowerCase())
    midiInputSetupGridspanElement.classList.toggle(
      'midi-enabled',
      midiInputListener.isActive
    )
    log.info(
      'Selected MIDI In: ',
      this.value,
      ' with ID: ',
      midiInputListener.deviceId
    )
  }

  midiInSelect.on('change', () => void midiInOnChange.bind(midiInSelect)())
  midiInSelect.value = 'Disabled'

  const makeMidiInChannelOnchange = (nexusNumber: NexusNumber) => () => {
    const previousChannel = midiInputListener.channels
    midiInputListener.channels =
      nexusNumber.value != 0
        ? [nexusNumber.value]
        : ToneMidiInput.allMidiChannels
    if (
      !ToneMidiInput.checkMidiChannelsSetsEqual(
        midiInputListener.channels,
        previousChannel
      )
    ) {
      log.info(
        'Selected MIDI In Channel: ' + midiInputListener.channels.toString()
      )
    }
  }

  const midiInChannelSelect = new NumberControl(
    midiInputSetupContainerElement,
    'midi-input-channel-input-container',
    [0, 16],
    0
  )
  midiInChannelSelect.render(60)
  midiInChannelSelect.controller?.on(
    'change',
    makeMidiInChannelOnchange(midiInChannelSelect.controller)
  )
  midiInChannelSelect.container.classList.add('advanced')

  const midiInDisplayButtonContainer = document.createElement('div')
  midiInDisplayButtonContainer.classList.add('control-item', 'disable-mouse')
  midiInputSetupContainerElement.appendChild(midiInDisplayButtonContainer)
  const midiInDisplayButton = new Nexus.Button(midiInDisplayButtonContainer, {
    size: [15, 15],
    state: false,
    mode: 'impulse',
  })

  type midiKeyAndPedalEvents = 'keyDown' | 'keyUp' | 'pedalDown' | 'pedalUp'
  Array<midiKeyAndPedalEvents>(
    'keyDown',
    'keyUp',
    'pedalDown',
    'pedalUp'
  ).forEach((event) => {
    midiInputListener.on(event, () => {
      midiInDisplayButton.click()
    })
  })
}
