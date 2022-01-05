import log from 'loglevel'
import { IMidiChannel, Input } from 'webmidi'
import WebMidi from 'webmidi'

import * as ControlLabels from './controlLabels'
import { NumberControl } from './numberControl'

import Nexus from './nexusColored'
import type { NexusNumber, NexusSelect } from 'nexusui'

// @tonejs/piano@0.2.1 is built as an es6 module, so we use the trick from
// https://www.typescriptlang.org/docs/handbook/modules.html#optional-module-loading-and-other-advanced-loading-scenarios
// to load the types and the implementation separately
// this ensures that babel is correctly applied on the imported javascript
import { MidiInput as MidiInputInterface } from '@tonejs/piano'
const MidiInput: typeof MidiInputInterface = <typeof MidiInputInterface>(
  require('babel-loader!@tonejs/piano').MidiInput
)

// @ts-expect-error: exports private _inputToDevice method
// adds channel-based event filtering in the _addListeners
export class ChannelBasedMidiInput extends MidiInput {
  get isActive(): boolean {
    return this.deviceId != null
  }

  protected static get connectedDevices(): Map<string, Input> {
    // @ts-expect-error: accessing private member
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return MidiInput.connectedDevices
  }

  protected _inputToDevice(input: Input): DeviceData {
    // @ts-expect-error: accessing private method
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return super._inputToDevice(input)
  }

  static async getDeviceId(name: string): Promise<string | null> {
    const devices = await MidiInput.getDevices()
    const maybeDevice = devices.find((data) => data.name.toLowerCase() == name)
    if (maybeDevice == null) {
      return null
    } else {
      return maybeDevice.id
    }
  }

  async setDevice(name: string | 'all' | 'disabled' | null): Promise<void> {
    if (name == null) {
      this.deviceId = null
    } else {
      name = name.toLowerCase()
      if (name == 'disabled') {
        this.deviceId = null
      } else {
        if (name == 'all') {
          this.deviceId = 'all'
        } else {
          this.deviceId = await ChannelBasedMidiInput.getDeviceId(name)
        }
      }
    }
  }

  channel: IMidiChannel = 'all'

  /**
   * Attach listeners to the device when it's connected
   */
  protected _addListeners(device: Input): void {
    if (!ChannelBasedMidiInput.connectedDevices.has(device.id)) {
      ChannelBasedMidiInput.connectedDevices.set(device.id, device)
      this.emit('connect', this._inputToDevice(device))

      device.addListener('noteon', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId == 'all' || this.deviceId == device.id) {
            this.emit('keyDown', {
              note: `${event.note.name}${event.note.octave}`,
              midi: event.note.number,
              velocity: event.velocity,
              device: this._inputToDevice(device),
              // @ts-expect-error: adds channel to event
              channel: event.channel,
            })
          }
        }
      })

      device.addListener('noteoff', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId == 'all' || this.deviceId == device.id) {
            this.emit('keyUp', {
              note: `${event.note.name}${event.note.octave}`,
              midi: event.note.number,
              velocity: event.velocity,
              device: this._inputToDevice(device),
              // @ts-expect-error: adds channel to event
              channel: event.channel,
            })
          }
        }
      })

      device.addListener('controlchange', 'all', (event) => {
        if (this.channel == 'all' || event.channel == this.channel) {
          if (this.deviceId == 'all' || this.deviceId == device.id) {
            if (event.controller.name == 'holdpedal') {
              this.emit(event.value ? 'pedalDown' : 'pedalUp', {
                device: this._inputToDevice(device),
                // @ts-expect-error: adds channel to event
                channel: event.channel,
              })
            }
          }
        }
      })
    }
  }

  protected static _isEnabled = WebMidi.enabled

  static async enabled(): Promise<void> {
    if (!MidiInput['_isEnabled']) {
      if (WebMidi.enabled) {
        MidiInput['_isEnabled'] = true
        return
      }
      return new Promise<void>((done, error) => {
        WebMidi.enable((e) => {
          if (e) {
            log.info(e)
            error(e)
          } else {
            MidiInput['_isEnabled'] = true
            done()
          }
        })
      })
    }
  }
}

let globalMidiInputListener: ChannelBasedMidiInput | null = null

export async function getMidiInputListener(): Promise<ChannelBasedMidiInput | null> {
  await ChannelBasedMidiInput.enabled()
  if (globalMidiInputListener == null) {
    globalMidiInputListener = new ChannelBasedMidiInput(null)
  }
  return globalMidiInputListener
}

export async function render(useChordsInstrument = false): Promise<void> {
  const bottomControlsGridElement = document.getElementById('bottom-controls')

  const midiInputSetupGridspanElement: HTMLElement = document.createElement(
    'div'
  )
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

  const midiInputSetupContainerElement: HTMLElement = document.createElement(
    'div'
  )
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
    const devices = await MidiInput.getDevices()
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
  midiInputListener.on('connect', () => void updateOptions())
  midiInputListener.on('disconnect', () => void updateOptions())

  async function midiInOnChange(this: NexusSelect): Promise<void> {
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

  function midiInChannelOnchange(this: NexusNumber): void {
    const previousChannel = midiInputListener.channel
    midiInputListener.channel = this.value != 0 ? this.value : 'all'
    if (midiInputListener.channel != previousChannel) {
      log.info(
        'Selected MIDI In Channel: ' + midiInputListener.channel.toString()
      )
    }
  }

  const midiInChannelSelect = new NumberControl(
    midiInputSetupContainerElement,
    'midi-input-channel-input-container',
    [0, 16],
    0,
    midiInChannelOnchange
  )
  midiInChannelSelect.render(false, 60)
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
