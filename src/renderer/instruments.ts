import * as Tone from "tone";
import {Piano} from 'tone-piano';
import { SampleLibrary } from './dependencies/Tonejs-Instruments'
import * as log from 'loglevel'
import * as path from 'path'

let Nexus = require('./nexusColored')

import { CycleSelect } from './cycleSelect';

import { static_correct } from './staticPath'

// add Piano methods to Tone.Insutrument objects for duck typing
Tone.Instrument.prototype.keyDown = function() {return this};
Tone.Instrument.prototype.keyUp = function() {return this};
Tone.Instrument.prototype.pedalDown = function() {return this};
Tone.Instrument.prototype.pedalUp = function() {return this};


let silentInstrument = new Tone.Instrument()

// add dummy Instrument methods for simple duck typing
Piano.prototype.triggerAttackRelease = function() {return this};
Piano.prototype.triggerRelease = function() {return this};

let piano = new Piano([21, 108], 1, {context: Tone.context});
piano.setVolume('release', -25);
piano.setVolume('pedal', -15);


const useEffects: boolean = false;

let chorus = new Tone.Chorus(2, 1.5, 0.5).toMaster();
let reverb = new Tone.Reverb(1.5).connect(chorus);
// let reverb = new Tone.Volume(0).toMaster();

const synthOptions: object =  {
    oscillator: {
        type: 'triangle'  // default: 'triangle'
    },
    envelope: {
        attack: 0.01,  // default: 0.005
        decay: 0.1,  // default: 0.1
        sustain: 0.3,  //default: 0.3
        release: 1.7  // default: 1
    }
};

let polysynth = new Tone.PolySynth(4, Tone.Synth, synthOptions);
// polysynth.stealVoices = false;

let polysynth_chords = new Tone.PolySynth(4, Tone.Synth, synthOptions);
polysynth_chords.set("volume", -8);

let steelpan = new Tone.PolySynth(6).set({
    "oscillator": {
        "type": "fatcustom",
        "partials" : [0.2, 1, 0, 0.5, 0.1],
        "spread" : 40,
        "count" : 3},
    "envelope": {
        "attack": 0.001,
        "decay": 1.6,
        "sustain": 0,
        "release": 1.6}
    }
);

const softSynths: Tone.Instrument[] = [polysynth, polysynth_chords, steelpan];
if (useEffects) {
    reverb.generate();
    softSynths.forEach(instrument => {
        instrument.connect(reverb)
    });
}
else {
    softSynths.forEach(instrument => {
        instrument.toMaster()
    });
}

let instrumentFactories = {
    'PolySynth': () => {return polysynth},
    'Piano': () => {
        piano.disconnect(0); piano.toMaster(); return piano},
    'Piano (w/ reverb)':
        () => {piano.disconnect(0); piano.connect(reverb); return piano},
    'Xylophone': () => {return sampledInstruments['xylophone']},
    'Organ': () => {return sampledInstruments['organ']},
    'Steelpan': () => {return steelpan},
    'None': () => {return silentInstrument}
};

let current_instrument = polysynth;
let instrumentOnChange: {handleEvent: (e: Event) => void} = {
    handleEvent: function(this, e: Event) {
        current_instrument = instrumentFactories[this.value]();}
};

export function getCurrentInstrument() {
    return current_instrument;
}

let chordInstrumentSelectElem: HTMLDivElement;
let chordInstrumentFactories;
let chordInstrumentSelect;
let current_chords_instrument;


export function getCurrentChordsInstrument() {
    return current_chords_instrument;
}


let sampledInstruments;  // declare variables but do not load samples yet
let instrumentSelect;
declare var COMPILE_ELECTRON: boolean;
export function renderDownloadButton(containerElement: HTMLElement,
    useChordsInstruments: boolean): void {
    // Manual samples loading button, to reduce network usage by only loading them
    // when requested
    let loadSamplesButtonElem: HTMLDivElement = document.createElement('div');
    loadSamplesButtonElem.id = 'load-samples-button';
    loadSamplesButtonElem.classList.add('right-column');
    containerElement.appendChild(loadSamplesButtonElem);

    let loadSamplesButton = new Nexus.TextButton('#load-samples-button',{
        'size': [100,50],
        'state': false,
        'text': 'Load samples',
        'alternateText': 'Samples loading'
    });

    $(() => {
        // HACK manually increase fontSize in download samples button
        let textContentDivElem = <HTMLDivElement>loadSamplesButtonElem.children[0].children[0];
        textContentDivElem.style.padding = "18px 0px";
        textContentDivElem.style.fontSize = "12px";
    })


    const sampled_instruments_names = ['organ', 'harmonium', 'xylophone'];

    loadSamplesButton.on('change', () => {
        log.info('Start downloading audio samples');
        // must disable pointer events on *child* node to also use cursor property
        (loadSamplesButtonElem.firstElementChild as HTMLElement).style.pointerEvents = 'none';
        loadSamplesButtonElem.style.cursor = 'wait';

        let loadPromises: Promise<any>[] = []
        let sampleLibraryLoadPromise = new Promise((resolve, reject) => {
            sampledInstruments = SampleLibrary.load({
                        instruments: sampled_instruments_names,
                        baseUrl: path.join(static_correct,
                            'tonejs-instruments/samples/')
                    });
            Object.keys(sampledInstruments).forEach(function(instrument_name) {
                sampledInstruments[instrument_name].release = 1.8;
                sampledInstruments[instrument_name].toMaster();
            });
            resolve(sampledInstruments);
        });
        loadPromises.push(sampleLibraryLoadPromise);

        let pianoLoadPromise: Promise<boolean> = piano.load(
            path.join(static_correct,
                'Salamander/')
        );
        loadPromises.push(pianoLoadPromise);

        Promise.all(loadPromises).then(()=>{
            log.info('Finished loading the samples');
            if (!useChordsInstruments) {
                containerElement.classList.remove('two-columns');
            }
            loadSamplesButtonElem.remove();
            // instrumentSelect.render();
        });
    });

    if (COMPILE_ELECTRON) {
        // auto-download samples
        loadSamplesButton.flip();
    }

};

let instrumentIconsBasePath: string = path.join(static_correct, 'icons');
let mainInstrumentsIcons = new Map([
    ['Piano', '049-piano.svg'],
    ['PolySynth', '019-synthesizer.svg'],
    ['Steelpan', '007-timpani.svg']
]);

let chordInstrumentsIcons = new Map([
    ['PolySynth', '019-synthesizer.svg'],
    ['Organ', '049-piano.svg'],
]);

export function renderChordInstrumentSelect(containerElement: HTMLElement) {
    // create second instrument selector for chord instrument
    let chordInstrumentSelectElem: HTMLElement = document.createElement('control-item');
    chordInstrumentSelectElem.id = 'chord-instrument-select-container';
    chordInstrumentSelectElem.classList.add('right-column');
    containerElement.appendChild(chordInstrumentSelectElem);

    current_chords_instrument = polysynth_chords;

    chordInstrumentFactories = {
        'PolySynth': () => {return polysynth_chords},
        'Organ': () => {return sampledInstruments['organ']},
        'Harmonium': () => {return sampledInstruments['harmonium']},
        'None': () => {return silentInstrument}
    };

    let chordInstrumentOnChange: {handleEvent: (e: Event) => void} = {
        handleEvent: function(this, e: Event) {
            current_chords_instrument = chordInstrumentFactories[this.value]();
    }};

    chordInstrumentSelect = new CycleSelect(chordInstrumentSelectElem,
        'instrument-select-chord',
        chordInstrumentOnChange,  // TODO
        chordInstrumentsIcons, instrumentIconsBasePath
    );

    // chordInstrumentSelect.on('change', chordInstrumentOnChange.bind(chordInstrumentSelect));

    const initialChordInstrument = 'PolySynth';
    chordInstrumentSelect.value = initialChordInstrument;
}

export function renderInstrumentSelect(containerElement: HTMLElement): void {
    let instrumentSelectElem: HTMLElement = document.createElement('control-item');
    instrumentSelectElem.id = 'lead-instrument-select-container';

    instrumentSelectElem.classList.add('left-column');
    containerElement.appendChild(instrumentSelectElem);

    instrumentSelect = new CycleSelect(instrumentSelectElem,
        'instrument-select-lead',
        instrumentOnChange,
        mainInstrumentsIcons, instrumentIconsBasePath
    );

    const initialInstrument = 'Piano';
    instrumentSelect.value = initialInstrument;
}

export function mute(mute: boolean, useChordsInstrument: boolean = false) {
    let instrumentSelectElems = $('.CycleSelect-container[id$="instrument-select-container"]');
    let instruments = [current_instrument, current_chords_instrument];
    if (mute) {
        instrumentSelectElems.toggleClass('CycleSelect-disabled', true);
        current_instrument = silentInstrument;
        if (useChordsInstrument) {
            current_chords_instrument = silentInstrument;
        }
    }
    else {
        instrumentSelectElems.toggleClass('CycleSelect-disabled', false);
        instrumentSelect.value = instrumentSelect.value;
        if (useChordsInstrument) {
            chordInstrumentSelect.value = chordInstrumentSelect.value;
        }
    }
}
