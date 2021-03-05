import log from 'loglevel'
import { IMidiChannel, Input } from 'webmidi'

import * as ControlLabels from './controlLabels'
import { NumberControl } from './numberControl'

import Nexus from './nexusColored'

// @tonejs/piano@0.2.1 is built as an es6 module, so we use the trick from
// https://www.typescriptlang.org/docs/handbook/modules.html#optional-module-loading-and-other-advanced-loading-scenarios
// to load the types and the implementation separately
// this ensures that babel is correctly applied on the imported javascript
import { MidiInput as MidiInputInterface } from '@tonejs/piano'
const MidiInput: typeof MidiInputInterface = require('babel-loader!@tonejs/piano')
  .MidiInput

// @ts-expect-error
class ChannelBasedMidiInput extends MidiInput {
  channel: IMidiChannel = 'all'

  /**
   * Attach listeners to the device when it's connected
   */
  _addListeners(device: Input): void {
    // @ts-expect-error
    if (!MidiInput.connectedDevices.has(device.id)) {
      // @ts-expect-error
      MidiInput.connectedDevices.set(device.id, device)
      // @ts-expect-error
      this.emit('connect', this._inputToDevice(device))

      device.addListener('noteon', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId === 'all' || this.deviceId === device.id) {
            this.emit('keyDown', {
              note: `${event.note.name}${event.note.octave}`,
              midi: event.note.number,
              velocity: event.velocity,
              // @ts-expect-error
              device: this._inputToDevice(device),
              // @ts-expect-error
              channel: event.channel,
            })
          }
        }
      })

      device.addListener('noteoff', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId === 'all' || this.deviceId === device.id) {
            this.emit('keyUp', {
              note: `${event.note.name}${event.note.octave}`,
              midi: event.note.number,
              velocity: event.velocity,
              // @ts-expect-error
              device: this._inputToDevice(device),
              // @ts-expect-error
              channel: event.channel,
            })
          }
        }
      })

      device.addListener('controlchange', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId === 'all' || this.deviceId === device.id) {
            if (event.controller.name === 'holdpedal') {
              this.emit(event.value ? 'pedalDown' : 'pedalUp', {
                // @ts-expect-error
                device: this._inputToDevice(device),
                // @ts-expect-error
                channel: event.channel,
              })
            }
          }
        }
      })
    }
  }
}

let globalMidiInputListener: ChannelBasedMidiInput = null

export async function getMidiInputListener(): Promise<ChannelBasedMidiInput | null> {
  try {
    await MidiInput.enabled()
    return globalMidiInputListener
  } catch (error) {
    return null
  }
}

export async function render(useChordsInstrument = false): Promise<void> {
  if (globalMidiInputListener === null) {
    try {
      globalMidiInputListener = new ChannelBasedMidiInput('all')
      await MidiInput.enabled()
    } catch (error) {
      // fail silently if no Web MIDI API support in the browser
      log.error('Failed in rendering Midi-In controls with error: ', error)
      return
    }
  }

  const bottomControlsGridElement = document.getElementById('bottom-controls')

  const midiInContainerElement: HTMLElement = document.createElement('div')
  midiInContainerElement.id = 'midi-input-setup-gridspan'
  midiInContainerElement.classList.add('gridspan')
  midiInContainerElement.classList.add('advanced')
  bottomControlsGridElement.appendChild(midiInContainerElement)

  const midiInDeviceSelectElement: HTMLElement = document.createElement(
    'control-item'
  )
  midiInDeviceSelectElement.id = 'select-midi-input-device'
  midiInDeviceSelectElement.classList.add('advanced')
  midiInContainerElement.appendChild(midiInDeviceSelectElement)
  ControlLabels.createLabel(
    midiInDeviceSelectElement,
    'select-midi-input-device-label',
    true,
    undefined,
    midiInContainerElement
  )

  const disabledInputId = 'Disabled'

  async function makeOptions(): Promise<string[]> {
    const devices = await MidiInput.getDevices()
    const devicesNames = devices.map((data) => data.name)
    return [disabledInputId, 'All'].concat(devicesNames)
  }

  const midiInSelect = new Nexus.Select('#select-midi-input-device', {
    size: [150, 50],
    options: await makeOptions(),
  })

  async function getDeviceId(name: string): Promise<string | null> {
    const devices = await MidiInput.getDevices()
    const maybeDevice = devices.find((data) => data.name == name)
    if (maybeDevice == null) {
      return null
    } else {
      return maybeDevice.id
    }
  }

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
  midiInputListener.on('connect', updateOptions)
  midiInputListener.on('disconnect', updateOptions)

  async function midiInOnChange(_: any): Promise<void> {
    if (this.value == 'Disabled') {
      midiInputListener.deviceId = null
    } else if (this.value == 'All') {
      midiInputListener.deviceId = 'all'
    } else {
      midiInputListener.deviceId = await getDeviceId(this.value)
    }
    log.info('Selected MIDI In: ' + this.value)
  }

  midiInSelect.on('change', midiInOnChange.bind(midiInSelect))
  midiInSelect.value = 'Disabled'

  async function midiInChannelOnchange(_: any): Promise<void> {
    const previousChannel = midiInputListener.channel
    midiInputListener.channel = this.value != 0 ? this.value : 'all'
    if (midiInputListener.channel != previousChannel) {
      log.info('Selected MIDI In Channel: ' + midiInputListener.channel)
    }
  }

  const midiInChannelSelect = new NumberControl(
    midiInContainerElement,
    'select-midi-input-channel',
    [0, 16],
    0,
    midiInChannelOnchange
  )
  midiInChannelSelect.render(false, 60)
  midiInChannelSelect.container.classList.add('advanced')

  const midiInDisplayButtonContainer = document.createElement('control-item')
  midiInDisplayButtonContainer.id = 'midi-in-display-container'
  midiInDisplayButtonContainer.classList.add('disable-mouse')
  midiInContainerElement.appendChild(midiInDisplayButtonContainer)
  const midiInDisplayButton = new Nexus.Button('#midi-in-display-container', {
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
