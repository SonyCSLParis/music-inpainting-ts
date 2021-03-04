import * as Tone from 'tone'

// @tonejs/piano@0.2.1 is built as an es6 module, so we use the trick from
// https://www.typescriptlang.org/docs/handbook/modules.html#optional-module-loading-and-other-advanced-loading-scenarios
// to load the types and the implementation separately
// this ensures that babel is correctly applied on the imported javascript
import { Piano as TonePiano } from '@tonejs/piano'
const Piano: typeof TonePiano = require('babel-loader!@tonejs/piano').Piano

import { SampleLibrary } from './dependencies/Tonejs-Instruments'
import log from 'loglevel'
import * as path from 'path'

import Nexus from './nexusColored'

import { CycleSelect } from './cycleSelect'

import { static_correct } from './staticPath'

let piano: TonePiano
let sampledInstruments // declare variable but do not load samples yet
let current_instrument: any
let instrumentFactories
let silentInstrument: any
export function getCurrentInstrument(): any {
  return current_instrument
}

let chordInstrumentSelectElem: HTMLDivElement
let chordInstrumentFactories
let chordInstrumentSelect

let current_chords_instrument
export function getCurrentChordsInstrument() {
  return current_chords_instrument
}

export function initializeInstruments() {
  piano = new Piano({
    release: false,
    pedal: false,
    velocities: 5,
    // volume: {
    //     keybed: -25,
    //     pedal: -15,
    //     harmonics: 0,
    //     strings: 0,
    // }
  })

  const useEffects = false

  const chorus = new Tone.Chorus(2, 1.5, 0.5).toDestination()
  const reverb = new Tone.Reverb(1.5).connect(chorus)

  const synthOptions: object = {
    oscillator: {
      type: 'triangle', // default: 'triangle'
    },
    envelope: {
      attack: 0.01, // default: 0.005
      decay: 0.1, // default: 0.1
      sustain: 0.3, //default: 0.3
      release: 1.7, // default: 1
    },
    maxPolyphony: 64,
  }

  silentInstrument = new Tone.Synth().set({
    oscillator: {
      mute: true,
    },
  })

  const polysynth = new Tone.PolySynth(synthOptions)
  // polysynth.stealVoices = false;

  const polysynth_chords = new Tone.PolySynth(synthOptions)
  polysynth_chords.set({
    oscillator: {
      volume: -8,
    },
  })

  const steelpan = new Tone.PolySynth(synthOptions).set({
    oscillator: {
      type: 'fatcustom',
      partials: [0.2, 1, 0, 0.5, 0.1],
      spread: 40,
      count: 3,
    },
    envelope: {
      attack: 0.001,
      decay: 1.6,
      sustain: 0,
      release: 1.6,
    },
  })

  const softSynths = [polysynth, polysynth_chords, steelpan]
  if (useEffects) {
    reverb.generate()
    softSynths.forEach((instrument) => {
      instrument.connect(reverb)
    })
  } else {
    softSynths.forEach((instrument) => {
      instrument.toDestination()
    })
  }

  instrumentFactories = {
    PolySynth: () => {
      return polysynth
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
    Steelpan: () => {
      return steelpan
    },
    None: () => {
      return silentInstrument
    },
  }

  chordInstrumentFactories = {
    PolySynth: () => {
      return polysynth_chords
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

let instrumentSelect
declare let COMPILE_ELECTRON: boolean
export function renderDownloadButton(
  containerElement: HTMLElement,
  useChordsInstruments: boolean
): void {
  // Manual samples loading button, to reduce network usage by only loading them
  // when requested
  const loadSamplesButtonElem: HTMLDivElement = document.createElement('div')
  loadSamplesButtonElem.id = 'load-samples-button'
  loadSamplesButtonElem.classList.add('right-column')
  containerElement.appendChild(loadSamplesButtonElem)

  const loadSamplesButton = new Nexus.TextButton('#load-samples-button', {
    size: [100, 50],
    state: false,
    text: 'Load samples',
    alternateText: 'Samples loading',
  })

  $(() => {
    // HACK manually increase fontSize in download samples button
    const textContentDivElem = <HTMLDivElement>(
      loadSamplesButtonElem.children[0].children[0]
    )
    textContentDivElem.style.padding = '18px 0px'
    textContentDivElem.style.fontSize = '12px'
  })

  const sampled_instruments_names = ['organ', 'harmonium', 'xylophone']

  loadSamplesButton.on('change', () => {
    log.info('Start downloading audio samples')
    // must disable pointer events on *child* node to also use cursor property
    ;(loadSamplesButtonElem.firstElementChild as HTMLElement).style.pointerEvents =
      'none'
    loadSamplesButtonElem.style.cursor = 'wait'

    const loadPromises: Promise<any>[] = []
    const sampleLibraryLoadPromise = new Promise((resolve, reject) => {
      sampledInstruments = SampleLibrary.load({
        instruments: sampled_instruments_names,
        baseUrl: path.join(static_correct, 'tonejs-instruments/samples/'),
      })
      Object.keys(sampledInstruments).forEach(function (instrument_name) {
        sampledInstruments[instrument_name].release = 1.8
        sampledInstruments[instrument_name].toDestination()
      })
      resolve(sampledInstruments)
    })
    loadPromises.push(sampleLibraryLoadPromise)

    const pianoLoadPromise: Promise<void> = piano.load()
    loadPromises.push(pianoLoadPromise)

    Promise.all(loadPromises).then(() => {
      log.info('Finished loading the samples')
      if (!useChordsInstruments) {
        containerElement.classList.remove('two-columns')
      }
      loadSamplesButtonElem.remove()
      // instrumentSelect.render();
    })
  })

  if (COMPILE_ELECTRON) {
    // auto-download samples
    // TODO: Restore this
    // loadSamplesButton.flip();
  }
}

const instrumentIconsBasePath: string = path.join(static_correct, 'icons')
const mainInstrumentsIcons = new Map([
  ['Piano', '049-piano.svg'],
  ['PolySynth', '019-synthesizer.svg'],
  ['Steelpan', '007-timpani.svg'],
])

const chordInstrumentsIcons = new Map([
  ['PolySynth', '019-synthesizer.svg'],
  ['Organ', '049-piano.svg'],
])

export function renderInstrumentSelect(containerElement: HTMLElement): void {
  const instrumentSelectElem: HTMLElement = document.createElement(
    'control-item'
  )
  instrumentSelectElem.id = 'lead-instrument-select-container'

  instrumentSelectElem.classList.add('left-column')
  containerElement.appendChild(instrumentSelectElem)

  const instrumentOnChange: { handleEvent: (e: Event) => void } = {
    handleEvent: function (this, e: Event) {
      current_instrument = instrumentFactories[this.value]()
    },
  }

  instrumentSelect = new CycleSelect(
    instrumentSelectElem,
    'instrument-select-lead',
    instrumentOnChange,
    mainInstrumentsIcons,
    instrumentIconsBasePath
  )

  const initialInstrument = 'Piano'
  instrumentSelect.value = initialInstrument
}

export function renderChordInstrumentSelect(containerElement: HTMLElement) {
  // create second instrument selector for chord instrument
  const chordInstrumentSelectElem: HTMLElement = document.createElement(
    'control-item'
  )
  chordInstrumentSelectElem.id = 'chord-instrument-select-container'
  chordInstrumentSelectElem.classList.add('right-column')
  containerElement.appendChild(chordInstrumentSelectElem)

  const chordInstrumentOnChange: { handleEvent: (e: Event) => void } = {
    handleEvent: function (this, e: Event) {
      current_chords_instrument = chordInstrumentFactories[this.value]()
    },
  }

  chordInstrumentSelect = new CycleSelect(
    chordInstrumentSelectElem,
    'instrument-select-chord',
    chordInstrumentOnChange, // TODO
    chordInstrumentsIcons,
    instrumentIconsBasePath
  )

  // chordInstrumentSelect.on('change', chordInstrumentOnChange.bind(chordInstrumentSelect));

  const initialChordInstrument = 'PolySynth'
  chordInstrumentSelect.value = initialChordInstrument
}

export function mute(mute: boolean, useChordsInstrument = false) {
  const instrumentSelectElems = $(
    '.CycleSelect-container[id$="instrument-select-container"]'
  )
  const instruments = [current_instrument, current_chords_instrument]
  if (mute) {
    instrumentSelectElems.toggleClass('CycleSelect-disabled', true)
    current_instrument = silentInstrument
    if (useChordsInstrument) {
      current_chords_instrument = silentInstrument
    }
  } else {
    instrumentSelectElems.toggleClass('CycleSelect-disabled', false)
    instrumentSelect.value = instrumentSelect.value
    if (useChordsInstrument) {
      chordInstrumentSelect.value = chordInstrumentSelect.value
    }
  }
}
