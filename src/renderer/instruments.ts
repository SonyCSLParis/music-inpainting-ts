import log from 'loglevel'
import * as Tone from 'tone'
import {
  Instrument,
  InstrumentOptions,
} from 'tone/build/esm/instrument/Instrument'
import { Piano } from '@tonejs/piano/'
import { SampleLibrary } from './dependencies/Tonejs-Instruments'

import {
  CycleSelectView,
  CycleSelectViewWithDisable,
  NullableVariableValue,
  VariableValue,
  createIconElements,
} from './cycleSelect'
import { getPathToStaticFile } from './staticPath'
import * as ControlLabels from './controlLabels'

type ToneInstrument = Instrument<InstrumentOptions>
type InstrumentOrPiano = ToneInstrument | Piano

let piano: Piano
let sampledInstruments: Record<string, Tone.Sampler> // declare variable but do not load samples yet
let currentInstrument: InstrumentOrPiano

let instrumentFactories: Record<string, () => InstrumentOrPiano>
let silentInstrument: ToneInstrument
export function getCurrentInstrument(midiChannel = 0): InstrumentOrPiano {
  return currentInstrument
}

let chordsInstrumentFactories: Record<string, () => InstrumentOrPiano>
let currentChordsInstrument: InstrumentOrPiano | null = null
export function getCurrentChordsInstrument(): InstrumentOrPiano | null {
  return currentChordsInstrument
}

export function initializeInstruments(): void {
  const pianoVelocities = 1
  log.info(
    `Loading Tone Piano with ${pianoVelocities} velocit${
      pianoVelocities > 1 ? 'ies' : 'y'
    }`
  )
  piano = new Piano({
    release: true,
    pedal: true,
    velocities: 1,

    volume: {
      pedal: -20,
      strings: -10,
      keybed: -20,
      harmonics: -10,
    },
  })

  const useEffects = true
  const limiter = new Tone.Limiter().toDestination()
  const chorus = new Tone.Chorus(5, 2, 0.5).connect(limiter)
  const reverb = new Tone.Reverb().connect(chorus)

  silentInstrument = new Tone.Synth().set({
    oscillator: {
      mute: true,
    },
  })

  const polySynth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 64 })
  const polySynth_chords = new Tone.PolySynth({
    voice: Tone.Synth,
    maxPolyphony: 64,
  })

  ;[polySynth, polySynth_chords].forEach((polySynth) => {
    polySynth.set({
      oscillator: {
        type: 'triangle1',
      },
      envelope: {
        attack: 0.05, // default: 0.005
        decay: 0.1, // default: 0.1
        sustain: 0.3, //default: 0.3
        release: 0.2, // default: 1},
      },
      portamento: 0.05,
    })
  })
  polySynth_chords.set({
    oscillator: {
      volume: -20,
    },
  })

  const steelPan = new Tone.PolySynth(Tone.Synth).set({
    oscillator: {
      type: 'fatsawtooth17',
      // partials: [0.2, 1, 0, 0.5, 0.1],
      spread: 40,
      count: 3,
    },
    envelope: {
      attack: 0.001,
      decay: 1,
      sustain: 0,
      release: 0.5,
    },
    portamento: 0.05,
  })

  const softSynths: ToneInstrument[] = [polySynth, polySynth_chords, steelPan]
  if (useEffects) {
    reverb
      .generate()
      .then(() => {
        softSynths.forEach((instrument) => {
          instrument.connect(reverb)
        })
      })
      .catch((reason) => {
        throw new EvalError(reason)
      })
  } else {
    softSynths.forEach((instrument) => {
      instrument.toDestination()
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
    Piano: () => {
      piano.disconnect()
      piano.toDestination()
      return piano
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
}

// syntax inspired by https://dev.to/angular/managing-key-value-constants-in-typescript-221g
// TOTO(theis, 2021/06/21): should we change this to an Enum type as advocated in that
// post's comments (https://dev.to/michaeljota/comment/ebeo)
const leadInstrumentNames = ['Piano', 'PolySynth', 'SteelPan'] as const
export type leadInstrument = typeof leadInstrumentNames[number]
const instrumentsIcons = new Map<leadInstrument | null, string>([
  ['Piano', '049-piano.svg'],
  ['PolySynth', '019-synthesizer.svg'],
  ['SteelPan', '007-timpani.svg'],
])

const chordsInstrumentNames = ['PolySynth', 'Piano'] as const
export type chordsInstrument = typeof chordsInstrumentNames[number]
const chordsInstrumentsIcons = new Map<chordsInstrument | null, string>([
  ['PolySynth', '019-synthesizer.svg'],
  ['Piano', '049-piano.svg'],
])

let instrumentSelectView: CycleSelectView<leadInstrument>
// const chordsInstrumentSelect: CycleSelectIconsView<chordsInstrument> | null = null
declare let COMPILE_ELECTRON: boolean
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
    if (sampledInstrumentsNames.length > 0) {
      const sampleLibraryLoadPromise = new Promise((resolve) => {
        sampledInstruments = SampleLibrary.load({
          instruments: sampledInstrumentsNames,
          baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/',
        })

        sampledInstrumentsNames.forEach(function (instrumentName) {
          sampledInstruments[instrumentName].release = 0.5
          sampledInstruments[instrumentName].toDestination()
        })

        resolve(sampledInstruments)
      })
      void sampleLibraryLoadPromise.then(() => {
        sampledInstrumentsNames.forEach((instrumentName) => {
          instrumentSelect.addOption(instrumentName)
        })
      })
      loadPromises.push(sampleLibraryLoadPromise)
    }

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

const instrumentIconsBasePath: string = getPathToStaticFile('icons')

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
    const imageElements = createIconElements(
      instrumentIconsBasePath,
      instrumentsIcons
    )
    super(valueModel, imageElements)
    this.classList.add('playbackInstrumentSelect')
  }
}
customElements.define('instrument-select', InstrumentSelectView, {
  extends: 'div',
})

export function mute(mute: boolean, useChordsInstrument = false) {
  if (mute) {
    currentInstrument = silentInstrument
    currentChordsInstrument = silentInstrument
  }
}
