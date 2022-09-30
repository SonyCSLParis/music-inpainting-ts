import log from 'loglevel'
import * as Tone from 'tone'
import { Piano } from '@tonejs/piano'
import * as presets from './presets'
import { limiter, effects } from './effects'

import type {
  Instrument,
  InstrumentOptions,
} from 'tone/build/esm/instrument/Instrument'

import {
  CycleSelectView,
  CycleSelectViewWithDisable,
  NullableVariableValue,
  VariableValue,
  createIconElements,
} from '../src/cycleSelect'
import * as ControlLabels from '../src/controlLabels'

type ToneInstrument = Instrument<InstrumentOptions>
type InstrumentOrPiano = ToneInstrument | Piano

const VITE_NO_AUTOLOAD_SAMPLES =
  import.meta.env.VITE_NO_AUTOLOAD_SAMPLES != undefined

let piano: Piano
let sampledInstruments: Record<string, Tone.Sampler> // declare variable but do not load samples yet
let currentInstrument: InstrumentOrPiano

let instrumentFactories: Record<string, () => InstrumentOrPiano>
let silentInstrument: ToneInstrument
export function getCurrentInstrument(midiChannel = 0): InstrumentOrPiano {
  return piano
}

export function keyDown(note: string, velocity: NormalRange) {
  const instrument = getCurrentInstrument()
  if ('keyDown' in instrument) {
    instrument.keyDown({
      note: note,
      velocity: velocity,
    })
  } else {
    instrument.triggerAttack(note, undefined, velocity)
  }
}

export function keyUp(note: string, velocity: number) {
  const instrument = getCurrentInstrument()
  if ('keyUp' in instrument) {
    instrument.keyUp({
      note: note,
      velocity: velocity,
    })
  } else {
    instrument.triggerRelease(note, undefined, velocity)
  }
}

let chordsInstrumentFactories: Record<string, () => InstrumentOrPiano>
let currentChordsInstrument: InstrumentOrPiano | null = null
export function getCurrentChordsInstrument(): InstrumentOrPiano | null {
  return currentChordsInstrument
}

let polySynth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 64 })
const useEffects = true
export async function initializeInstruments(): Promise<void> {
  silentInstrument = new Tone.Synth().set({
    oscillator: {
      mute: true,
    },
  })
  const pianoVelocities = 4
  log.info(
    `Loading Tone Piano with ${pianoVelocities} velocit${
      pianoVelocities > 1 ? 'ies' : 'y'
    }`
  )
  piano = new Piano({
    velocities: pianoVelocities,

    // volume: {
    //   // pedal: -20,
    //   // strings: -10,
    //   // keybed: -20,
    //   // harmonics: -10,
    // },
  })
  if (!VITE_NO_AUTOLOAD_SAMPLES) {
    await piano.load()
    if (useEffects) {
      const reverb = await effects
      currentInstrument = piano.connect(
        reverb //.connect(
        // new Tone.Gain(-15, 'decibels').toDestination() //.connect(limiter)
        // )
      )
    } else {
      const gainReduction = new Tone.Gain(-15, 'decibels').toDestination()
      piano.connect(gainReduction)
    }

    return
  } else {
    currentInstrument = polySynth.connect(limiter)
  }

  const polySynth_chords = new Tone.PolySynth({
    voice: Tone.Synth,
    maxPolyphony: 64,
  })
  const polySynths = [polySynth, polySynth_chords]
  polySynths.forEach((polySynth) => {
    polySynth.set({
      //   oscillator: {
      //     type: 'triangle1',
      //   },
      //   envelope: {
      //     attack: 0.05, // default: 0.005
      //     decay: 0.1, // default: 0.1
      //     sustain: 0.3, //default: 0.3
      //     release: 0.2, // default: 1},
      //   },
      //   portamento: 0.05,
      // })
      portamento: 0.2,
      oscillator: {
        type: 'sawtooth',
      },
      envelope: {
        attack: 0.03,
        decay: 0.1,
        sustain: 0.2,
        release: 0.02,
      },
    })
  })

  const polySynth_alien = new Tone.PolySynth(presets.alienChorus)
  const polySynth_dropPulse = new Tone.PolySynth(presets.dropPulse)
  const polySynth_delicateWindPart = new Tone.PolySynth(
    presets.delicateWindPart
  )
  const polySynth_kalimba = new Tone.PolySynth(presets.kalimba)
  const polySynth_electricCello = new Tone.PolySynth(presets.electricCello)
  polySynth = polySynth_electricCello

  polySynth_chords.set({
    oscillator: {
      volume: -20,
    },
  })

  const steelPan = new Tone.PolySynth(presets.steelPan)

  const softSynths: ToneInstrument[] = [polySynth, polySynth_chords, steelPan]
  if (useEffects) {
    softSynths.forEach((instrument) => {
      instrument.connect(effects)
    })
  } else {
    softSynths.forEach((instrument) => {
      instrument.connect(limiter)
    })
  }

  instrumentFactories = {
    PolySynth: () => {
      return polySynth
    },
    Piano: () => {
      piano.disconnect()
      piano.toDestination()
      return piano
    },
    'Piano (w/ reverb)': () => {
      piano.disconnect()
      piano.connect(reverb)
      return piano
    },
    Xylophone: () => {
      return sampledInstruments['xylophone']
    },
    Organ: () => {
      return sampledInstruments['organ']
    },
    SteelPan: () => {
      return steelPan
    },
    null: () => {
      return silentInstrument
    },
  }

  chordsInstrumentFactories = {
    PolySynth: () => {
      return polySynth_chords
    },
    Organ: () => {
      return sampledInstruments['organ']
    },
    Harmonium: () => {
      return sampledInstruments['harmonium']
    },
    null: () => {
      return silentInstrument
    },
  }

  Array.from([instrumentFactories, chordsInstrumentFactories]).forEach(
    (factories) => {
      factories['Piano'] = () => {
        piano.disconnect()
        piano.toDestination()
        return piano
      }
    }
  )
}

// syntax inspired by https://dev.to/angular/managing-key-value-constants-in-typescript-221g
// TOTO(theis, 2021/06/21): should we change this to an Enum type as advocated in that
// post's comments (https://dev.to/michaeljota/comment/ebeo)
const leadInstrumentNames = ['Piano', 'PolySynth', 'SteelPan'] as const
export type leadInstrument = typeof leadInstrumentNames[number]
import PianoIconURL from '../static/icons/049-piano.svg'
import SynthIconURL from '../static/icons/019-synthesizer.svg'
import TimpaniIconURL from '../static/icons/007-timpani.svg'
import { Limiter, PolySynth } from 'tone'
import { NormalRange } from 'tone/build/esm/core/type/Units'
const instrumentsIcons = new Map<leadInstrument | null, string>([
  ['Piano', PianoIconURL],
  ['PolySynth', SynthIconURL],
  ['SteelPan', TimpaniIconURL],
])

const chordsInstrumentNames = ['PolySynth', 'Piano'] as const
export type chordsInstrument = typeof chordsInstrumentNames[number]
const chordsInstrumentsIcons = new Map<chordsInstrument | null, string>([
  ['PolySynth', SynthIconURL],
  ['Piano', PianoIconURL],
])

let instrumentSelectView: CycleSelectView<leadInstrument>
// const chordsInstrumentSelect: CycleSelectIconsView<chordsInstrument> | null = null
const COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined
export function renderDownloadButton(
  containerElement: HTMLElement,
  instrumentSelect: VariableValue<leadInstrument>,
  chordsInstrumentSelect?: VariableValue<chordsInstrument>
): void {
  // Manual samples loading button, to reduce network usage by only loading them
  // when requested
  const loadSamplesButtonContainer = document.createElement('div')
  loadSamplesButtonContainer.id = 'load-samples-button'
  loadSamplesButtonContainer.classList.add(
    'control-item',
    'instrument-samples-download'
  )
  containerElement.appendChild(loadSamplesButtonContainer)

  const loadSamplesButtonInterface = document.createElement('i')
  loadSamplesButtonInterface.id = 'load-samples-button-interface'
  loadSamplesButtonContainer.appendChild(loadSamplesButtonInterface)

  const labelElement = ControlLabels.createLabel(
    containerElement,
    'sample-instruments-download-button-label',
    false,
    undefined,
    containerElement
  )

  const sampledInstrumentsNames: (leadInstrument | chordsInstrument)[] = []

  function loadSampledInstruments(this: Element): void {
    log.info('Start downloading audio samples')
    this.parentElement.classList.add('loading-control')
    this.classList.add('fa-spin')

    const loadPromises: Promise<any>[] = []
    const pianoLoadPromise: Promise<void> = piano.load()
    void pianoLoadPromise.then(() => {
      instrumentSelect.addOption('Piano')
      if (chordsInstrumentSelect != null) {
        chordsInstrumentSelect.addOption('Piano')
      }
    })
    loadPromises.push(pianoLoadPromise)

    Promise.all(loadPromises)
      .then(() => {
        log.info('Finished loading the samples')
        loadSamplesButtonContainer.remove()
        labelElement.remove()
      })
      .catch(() => {
        this.classList.remove('loading-control', 'fa-spin', 'fa-spinner')
        this.classList.add('fa-arrow-alt-circle-down')
      })
  }

  loadSamplesButtonInterface.addEventListener('click', loadSampledInstruments, {
    once: true,
  })

  if (COMPILE_ELECTRON) {
    // auto-download samples
    // TODO: Restore this
    // loadSamplesButton.flip();
  }
}

export class InstrumentSelect<
  T extends leadInstrument
> extends NullableVariableValue<T> {
  constructor(
    options: T[] = [],
    initialValue?: T,
    onchange: (instrument: T) => void = (instrument: T) => {
      currentInstrument = instrumentFactories[instrument]()
    }
  ) {
    super(options, initialValue, onchange)
  }
}

export class ChordsInstrumentSelect<
  T extends chordsInstrument
> extends InstrumentSelect<T> {
  constructor(
    options: T[] = [],
    initialValue?: T,
    onchange: (chordsInstrument: T) => void = (chordsInstrument: T) => {
      currentChordsInstrument = instrumentFactories[chordsInstrument]()
    }
  ) {
    super(options, initialValue, onchange)
  }
}

export class InstrumentSelectView extends CycleSelectViewWithDisable<leadInstrument> {
  constructor(valueModel: NullableVariableValue<leadInstrument>) {
    const imageElements = createIconElements(undefined, instrumentsIcons)
    super(valueModel, imageElements)
    this.classList.add('playbackInstrumentSelect')
  }
}
if (customElements.get('instrument-select') == undefined) {
  customElements.define('instrument-select', InstrumentSelectView)
}

export function mute(mute: boolean, useChordsInstrument = false) {
  if (mute) {
    currentInstrument = silentInstrument
    currentChordsInstrument = silentInstrument
  }
}

console.log(import.meta.hot)
// let newPolySynth: Tone.PolySynth | undefined = undefined
if (import.meta.hot) {
  import.meta.hot.accept(
    ['./presets.ts', './effects.ts'],
    async ([newPresets, newEffects]) => {
      // if (newPolySynth != undefined && !newPolySynth.disposed) {
      //   newPolySynth.dispose()
      // }
      const localEffects = (await newEffects?.effects) ?? effects

      if (newPresets) {
        const newPolySynth = new Tone.PolySynth(newPresets.steelPan)
        polySynth = newPolySynth
        currentInstrument = newPolySynth
        if (Tone.Transport.state == 'started') {
          const position = Tone.Transport.position
          Tone.Transport.pause()
          Tone.Transport.start('+0.2', position)
        }
      }
      if (useEffects) {
        currentInstrument.disconnect()
        currentInstrument.connect(localEffects)
      } else {
        currentInstrument.connect(newEffects?.limiter ?? limiter)
      }
    }
  )
}
