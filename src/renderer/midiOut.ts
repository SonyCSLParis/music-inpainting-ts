import { MidiOutput } from './midi_io/midiOutput'
import WebMidi, { Output } from 'webmidi'

import log from 'loglevel'
import * as Instruments from './instruments'
import * as ControlLabels from './controlLabels'

import Nexus from './nexusColored'

let globalMidiOutputListener: MidiOutput = null

export async function getMidiOutputListener(): Promise<MidiOutput> {
  await MidiOutput.enabled()
  return globalMidiOutputListener
}

export async function render(useChordsInstrument = false): Promise<void> {
  if (globalMidiOutputListener === null) {
    try {
      globalMidiOutputListener = new MidiOutput(null)
      await MidiOutput.enabled()
    } catch (error) {
      // fail silently if no Web MIDI API support in the browser
      log.error('Failed in rendering Midi-Out controls with error: ', error)
      return
    }
  }

  const bottomControlsGridElement = document.getElementById('bottom-controls')

  const midiOutSelectElement: HTMLElement = document.createElement(
    'control-item'
  )
  midiOutSelectElement.id = 'select-midi-out'
  midiOutSelectElement.classList.add('advanced')
  bottomControlsGridElement.appendChild(midiOutSelectElement)

  ControlLabels.createLabel(midiOutSelectElement, 'select-midi-out-label', true)

  const disabledOutputId = 'Disabled'

  async function makeOptions(): Promise<string[]> {
    const devices = await MidiOutput.getDevices()
    const devicesNames = devices.map((data) => data.name)
    return [disabledOutputId, 'All'].concat(devicesNames)
  }

  const midiOutSelect = new Nexus.Select('#select-midi-out', {
    size: [150, 50],
    options: await makeOptions(),
  })

  async function getDeviceId(name: string): Promise<string> {
    const devices = await MidiOutput.getDevices()
    return devices.find((data) => data.name == name).id
  }

  async function updateOptions(): Promise<void> {
    const currentOutput = midiOutSelect.value
    const newOptions = await makeOptions()
    midiOutSelect.defineOptions(newOptions)
    if (newOptions.includes(currentOutput)) {
      // restore previously selected output
      midiOutSelect.value = currentOutput
    } else {
      // previously selected output is not available anymore,
      // disable output for safety
      midiOutSelect.value = disabledOutputId
    }
    log.info(
      '[MIDI OUT]: Updated list of outputs, now',
      JSON.stringify(newOptions)
    )
  }

  const midiOutputListener = await getMidiOutputListener()
  midiOutputListener.on('connect', updateOptions)
  midiOutputListener.on('disconnect', updateOptions)

  async function midiOutOnChange(_: any): Promise<void> {
    const previousOutput = midiOutputListener.deviceId
    if (this.value == disabledOutputId) {
      midiOutputListener.deviceId = null
      Instruments.mute(false)
    } else {
      if (this.value == 'All') {
        midiOutputListener.deviceId = 'all'
      } else {
        midiOutputListener.deviceId = await getDeviceId(this.value)
      }
      Instruments.mute(true)
    }
    if (midiOutputListener.deviceId != previousOutput) {
      log.info('Selected MIDI Out: ' + this.value)
    }
  }

  midiOutSelect.on('change', midiOutOnChange.bind(midiOutSelect))
  midiOutSelect.value = await makeOptions()[0]
}

export async function getOutput(): Promise<false | Output> {
  const midiOutputListener = await getMidiOutputListener()
  if (midiOutputListener === null || midiOutputListener.deviceId === null) {
    return false
  } else {
    return WebMidi.getOutputById(midiOutputListener.deviceId)
  }
}
