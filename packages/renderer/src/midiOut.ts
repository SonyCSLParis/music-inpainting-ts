import { MidiOutput } from './midi_io/midiOutput'
import { WebMidi, Output } from 'webmidi'

import log from 'loglevel'
import * as Instruments from '../instruments/instruments'
import * as ControlLabels from './controlLabels'

import Nexus from './nexusColored'
import MidiSheetPlaybackManager from './sheetPlayback'
import { NexusSelect } from 'nexusui'
import Select from 'nexusui/dist/types/interfaces/select'
import { ToneMidiInput } from './midi_io/midiInput'
import { NoteOffEvent } from '@tonejs/midi/dist/Note'
import { channel } from 'diagnostics_channel'

let globalMidiOutputListener: MidiOutput | null = null
let midiOutSelect: NexusSelect | null = null

export function getMidiOutSelect(): NexusSelect | null {
  return midiOutSelect
}

export async function getMidiOutputListener(): Promise<MidiOutput> {
  if (globalMidiOutputListener == null) {
    await MidiOutput.enabled()
    globalMidiOutputListener = new MidiOutput('all')
  }
  return globalMidiOutputListener
}

export async function render(
  playbackManager: MidiSheetPlaybackManager,
  insertActivityDisplay = false,
  isAdvancedControl = true
): Promise<void> {
  if (midiOutSelect != null) {
    // TODO(@tbazin, 2022/02/25): could break, should use a semaphore-like setup here, but
    // overall, this should not be needed...
    // already rendered
    return
  }
  const bottomControlsGridElement = document.getElementById('bottom-controls')

  const midiOutputSetupGridspanElement: HTMLElement =
    document.createElement('div')
  midiOutputSetupGridspanElement.id = 'midi-output-setup-gridspan'
  midiOutputSetupGridspanElement.classList.add('gridspan')
  if (isAdvancedControl) {
    midiOutputSetupGridspanElement.classList.add('advanced')
  }
  bottomControlsGridElement.appendChild(midiOutputSetupGridspanElement)

  try {
    await getMidiOutputListener()
  } catch (error) {
    // no Web MIDI API support in the browser
    log.info('Failed in rendering Midi-Out controls with message: ', error)
    midiOutputSetupGridspanElement.classList.add('disabled-gridspan')
    midiOutputSetupGridspanElement.innerHTML =
      'No Web MIDI API support<br>Try using Google Chrome'
    return
  }

  const midiOutputSetupContainerElement: HTMLElement =
    document.createElement('div')
  midiOutputSetupContainerElement.id = 'midi-output-setup-container'
  midiOutputSetupContainerElement.classList.add('gridspan')
  midiOutputSetupContainerElement.classList.add('advanced')
  midiOutputSetupGridspanElement.appendChild(midiOutputSetupContainerElement)

  ControlLabels.createLabel(
    midiOutputSetupContainerElement,
    'midi-output-setup-container-label',
    true,
    undefined,
    midiOutputSetupGridspanElement
  )

  const midiOutputDeviceSelectElement = document.createElement('div')
  midiOutputDeviceSelectElement.classList.add('control-item', 'advanced')
  midiOutputSetupContainerElement.appendChild(midiOutputDeviceSelectElement)

  // ControlLabels.createLabel(
  //   midiOutputDeviceSelectElement,
  //   'midi-output-device-select-label',
  //   true,
  //   undefined,
  //   midiOutputSetupContainerElement
  // )

  const disabledOutputId = 'Disabled'

  async function makeOptions(): Promise<string[]> {
    const devices = await MidiOutput.getDevices()
    const devicesNames = devices.map((data) => data.name)
    return [disabledOutputId].concat(devicesNames)
  }

  midiOutSelect = new Nexus.Select(midiOutputDeviceSelectElement, {
    size: [150, 50],
    options: await makeOptions(),
  })
  if (midiOutSelect == null) {
    throw new Error()
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

  midiOutputListener.on('connect', () => void updateOptions())
  midiOutputListener.on('disconnect', () => void updateOptions())

  async function midiOutOnChange(this: Select): Promise<void> {
    const previousOutput = midiOutputListener.deviceId

    await midiOutputListener.setDevice(this.value.toLowerCase())
    if (midiOutputListener.deviceId != previousOutput) {
      log.info('Selected MIDI Out: ' + this.value)
    }
    playbackManager.toggleLowLatency(midiOutputListener.isActive)
    Instruments.mute(midiOutputListener.isActive)

    await playbackManager.refreshPlayNoteCallback()
    if (midiOutputListener.isActive) {
      const output = await getOutput()
      const loopbackInput = midiOutputListener.midiInputListener
      const midiLatency = await measureMidiLatency(output, loopbackInput)
      if (midiLatency != null) {
        playbackManager.midiLatencyCompensation = midiLatency
      }
      console.log('midiLatency: ', midiLatency)
    }
    midiOutputSetupGridspanElement.classList.toggle(
      'midi-enabled',
      midiOutputListener.isActive
    )
  }

  midiOutSelect.on('change', () => void midiOutOnChange.bind(midiOutSelect)())
  midiOutSelect.value = (await makeOptions())[0]

  if (insertActivityDisplay) {
    const midiOutDisplayButtonContainer = document.createElement('div')
    midiOutDisplayButtonContainer.classList.add('control-item', 'disable-mouse')
    midiOutputSetupContainerElement.appendChild(midiOutDisplayButtonContainer)
    const midiOutDisplayButton = new Nexus.Button(
      midiOutDisplayButtonContainer,
      {
        size: [15, 15],
        state: false,
        mode: 'impulse',
      }
    )

    type midiKeyAndPedalEvents = 'keyDown' | 'keyUp' | 'pedalDown' | 'pedalUp'
    Array<midiKeyAndPedalEvents>('keyDown').forEach((event) => {
      midiOutputListener.midiInputListener.on(event, () => {
        midiOutDisplayButton.click()
      })
    })
  }

  async function measureMidiLatency(
    midiOutput: Output,
    midiInputLoopback: ToneMidiInput,
    repetitions: number = 1000
  ): Promise<number | null> {
    const emitted: number[] = []
    const received: number[] = []

    const repetitionsArray = Array.from(Array(repetitions)).fill(0)
    for (const repetitionIndex of repetitionsArray) {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const listener = (e) => {
            if (e.note == 'E3') {
              received.push(Date.now())
              resolve()
            }
          }
          midiInputLoopback.once('keyUp', listener)
          emitted.push(Date.now())
          midiOutput.sendNoteOff('E3', { channels: 16 })
        }, 3)
      })
    }

    if (emitted.length != received.length) {
      console.log('missing events!')
      return null
    }
    const latencies = received.map(
      (receivedTime, index) => receivedTime - emitted[index]
    )
    const averageLatency =
      latencies.reduce((acc, latency) => acc + latency, 0) / latencies.length
    const averageLatency_seconds = averageLatency / 1000
    return averageLatency_seconds
  }

  return
}

export async function getOutput(): Promise<false | Output> {
  const midiOutputListener = await getMidiOutputListener()
  if (midiOutputListener === null || midiOutputListener.deviceId === null) {
    return false
  } else {
    return WebMidi.getOutputById(midiOutputListener.deviceId)
  }
}
