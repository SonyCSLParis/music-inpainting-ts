// FIXME(theis, 2021/05/25): import Tone.Instrument type def and fix typings
import log from 'loglevel'
import * as Tone from 'tone'
// import { PolySynth, PolySynthOptions, SynthOptions } from 'tone'
import {
  Instrument,
  InstrumentOptions,
} from 'tone/build/esm/instrument/Instrument' //  instrument/Instrument'
import { Piano } from '@tonejs/piano/'
import { SampleLibrary } from './dependencies/Tonejs-Instruments'

import { CycleSelect } from './cycleSelect'
import { getPathToStaticFile } from './staticPath'

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

  const chorus = new Tone.Chorus(5, 2, 0.5).toDestination()
  const reverb = new Tone.Reverb().connect(chorus)

  silentInstrument = new Tone.Synth().set({
    oscillator: {
      mute: true,
    },
  })

  const polySynth = new Tone.PolySynth(Tone.Synth)
  const polySynth_chords = new Tone.PolySynth(Tone.Synth)

  ;[polySynth, polySynth_chords].forEach((polySynth) => {
    polySynth.set({
      oscillator: {
        type: 'triangle1',
      },
      envelope: {
        attack: 0.05, // default: 0.005
        decay: 0.1, // default: 0.1
        sustain: 0.3, //default: 0.3
        release: 1.7, // default: 1},
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
    None: () => {
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
    None: () => {
      return silentInstrument
    },
  }
}

// syntax inspired by https://dev.to/angular/managing-key-value-constants-in-typescript-221g
// TOTO(theis, 2021/06/21): should we change this to an Enum type as advocated in that
// post's comments (https://dev.to/michaeljota/comment/ebeo)
const leadInstrumentNames = ['Piano', 'PolySynth', 'SteelPan'] as const
type leadInstrument = typeof leadInstrumentNames[number]
const mainInstrumentsIcons = new Map<leadInstrument, string>([
  ['Piano', '049-piano.svg'],
  ['PolySynth', '019-synthesizer.svg'],
  ['SteelPan', '007-timpani.svg'],
])

const chordsInstrumentNames = ['PolySynth', 'Piano'] as const
type chordsInstrument = typeof chordsInstrumentNames[number]
const chordsInstrumentsIcons = new Map<chordsInstrument, string>([
  ['PolySynth', '019-synthesizer.svg'],
  ['Piano', '049-piano.svg'],
])

let instrumentSelect: CycleSelect<leadInstrument>
let chordsInstrumentSelect: CycleSelect<chordsInstrument> | null = null
declare let COMPILE_ELECTRON: boolean
export function renderDownloadButton(
  containerElement: HTMLElement,
  useChordsInstruments: boolean
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

  const mainIconSize = 'fa-4x'

  const loadSamplesButtonInterface = document.createElement('i')
  loadSamplesButtonInterface.id = 'load-samples-button-interface'
  loadSamplesButtonContainer.appendChild(loadSamplesButtonInterface)
  loadSamplesButtonInterface.classList.add(
    'fas',
    'fa-arrow-alt-circle-down',
    mainIconSize
  )

  const sampledInstrumentsNames: (leadInstrument | chordsInstrument)[] = []

  function loadSampledInstruments(this: Element): void {
    log.info('Start downloading audio samples')
    this.parentElement.classList.add('loading-control')
    this.classList.add('loading-control', 'fa-spin', 'fa-spinner')
    this.classList.remove('fa-arrow-alt-circle-down')

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
        instrumentSelect.activeOptions = [
          ...instrumentSelect.activeOptions,
          ...sampledInstrumentsNames,
        ]
      })
      loadPromises.push(sampleLibraryLoadPromise)
    }

    const pianoLoadPromise: Promise<void> = piano.load()
    void pianoLoadPromise.then(() => {
      const addOption = <T extends string, G extends T>(
        instrumentSelect: CycleSelect<T>,
        option: G
      ): void => {
        instrumentSelect.activeOptions = [
          ...instrumentSelect.activeOptions,
          option,
        ]
      }
      addOption(instrumentSelect, 'Piano')
      if (chordsInstrumentSelect != null) {
        addOption(chordsInstrumentSelect, 'Piano')
      }
    })
    loadPromises.push(pianoLoadPromise)

    Promise.all(loadPromises)
      .then(() => {
        log.info('Finished loading the samples')
        loadSamplesButtonContainer.remove()
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

export function renderInstrumentSelect(containerElement: HTMLElement): void {
  const instrumentSelectElement = document.createElement('div')
  instrumentSelectElement.id = 'lead-instrument-select-container'
  instrumentSelectElement.classList.add(
    'control-item',
    'main-instrument-select'
  )
  containerElement.appendChild(instrumentSelectElement)

  function instrumentOnChange<T extends string>(
    this: CycleSelect<T>,
    e: Event
  ) {
    currentInstrument = instrumentFactories[this.value]()
  }

  instrumentSelect = new CycleSelect(
    instrumentSelectElement,
    instrumentOnChange,
    mainInstrumentsIcons,
    instrumentIconsBasePath,
    ['PolySynth', 'SteelPan']
  )
  instrumentSelect.interfaceElement.classList.add('playbackInstrumentSelect')

  const initialInstrument = 'PolySynth'
  instrumentSelect.value = initialInstrument
}

export function renderChordsInstrumentSelect(containerElement: HTMLElement) {
  // create second instrument selector for chord instrument
  const chordsInstrumentSelectElement = document.createElement('div')
  chordsInstrumentSelectElement.id = 'chords-instrument-select-container'
  chordsInstrumentSelectElement.classList.add(
    'control-item',
    'chords-instrument-select'
  )
  containerElement.appendChild(chordsInstrumentSelectElement)

  function chordsInstrumentOnChange<T extends string>(
    this: CycleSelect<T>,
    e: Event
  ) {
    currentChordsInstrument = chordsInstrumentFactories[this.value]()
  }

  chordsInstrumentSelect = new CycleSelect(
    chordsInstrumentSelectElement,
    chordsInstrumentOnChange,
    chordsInstrumentsIcons,
    instrumentIconsBasePath,
    ['PolySynth']
  )
  chordsInstrumentSelect.interfaceElement.classList.add(
    'playbackInstrumentSelect'
  )

  const initialChordsInstrument = 'PolySynth'
  chordsInstrumentSelect.value = initialChordsInstrument
}

export function mute(mute: boolean, useChordsInstrument = false) {
  instrumentSelect.disable(mute)
  if (chordsInstrumentSelect != null) {
    chordsInstrumentSelect.disable(mute)
  }
  if (mute) {
    currentInstrument = silentInstrument
    currentChordsInstrument = silentInstrument
  } else {
    instrumentSelect.emit(instrumentSelect.events.ValueChanged)
    if (chordsInstrumentSelect != null) {
      chordsInstrumentSelect.emit(chordsInstrumentSelect.events.ValueChanged)
    }
  }
}
