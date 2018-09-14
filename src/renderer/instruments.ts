import * as Tone from "tone";
import {Piano} from 'tone-piano';
import { SampleLibrary } from './tonejs-instruments/Tonejs-Instruments'
import * as log from 'loglevel'
import * as path from 'path'

let Nexus = require('./nexusColored')

import CycleSelect from './cycleSelect';

import { static_correct } from './staticPath'

// add Piano methods to Tone.Insutrument objects for duck typing
Tone.Instrument.prototype.keyDown = function() {return this};
Tone.Instrument.prototype.keyUp = function() {return this};
Tone.Instrument.prototype.pedalDown = function() {return this};
Tone.Instrument.prototype.pedalUp = function() {return this};


let silentInstrument = new Tone.Instrument()

let piano = new Piano([21, 108], 1);
piano.setVolume('release', -25);
piano.setVolume('pedal', -15);


// let chorus = new Tone.Chorus(2, 1.5, 0.5).toMaster();
// let reverb = new Tone.Reverb(1.5).connect(chorus);
// reverb.generate();
let reverb = new Tone.Volume(0).toMaster();

let polysynth = new Tone.PolySynth(4);
// polysynth.stealVoices = false;
polysynth.connect(reverb);

let polysynth_chords = new Tone.PolySynth(24);
polysynth_chords.connect(reverb);

let steelpan = new Tone.PolySynth(12).set({
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
steelpan.connect(reverb);


function addTriggerAttackRelease_(piano: Piano) {
    // add dummy Instrument method for simple duck typing
    piano.triggerAttackRelease = () => {return piano};
    return piano;
};
addTriggerAttackRelease_(piano);

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
export function renderDownloadButton() {
    // Manual samples loading button, to reduce network usage by only loading them
    // when requested
    let loadSamplesButtonElem: HTMLDivElement = document.createElement('div');
    loadSamplesButtonElem.id = 'load-samples-button';
    document.body.appendChild(loadSamplesButtonElem);

    let loadSamplesButton = new Nexus.TextButton('#load-samples-button',{
        'size': [150,50],
        'state': false,
        'text': 'Load samples',
        'alternateText': 'Samples loading'
    });


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

        let pianoLoadPromise: Promise<boolean> = piano.load();
        loadPromises.push(pianoLoadPromise);

        Promise.all(loadPromises).then(()=>{
            log.info('Finished loading the samples');
            loadSamplesButtonElem.remove();
            instrumentSelect.render();
        });
    });

    if (COMPILE_ELECTRON) {
        // auto-download samples
        loadSamplesButton.flip();
    }

};

let instrumentIconsBasePath: string = path.join(static_correct, 'icons');
let mainInstrumentsIcons = new Map([
    ['PolySynth', '019-synthesizer.svg'],
    ['Piano', '049-piano.svg'],
]);

export function renderInstrumentSelect(useLeadsheetMode: boolean) {
    let instrumentSelectElem: HTMLElement = document.createElement('control-item');
    instrumentSelectElem.id = 'instrument-select-container';
    document.getElementById('bottom-controls').appendChild(instrumentSelectElem);

    let instrumentSelect = new CycleSelect(instrumentSelectElem,
        'instrument-select',
        instrumentOnChange,
        mainInstrumentsIcons, instrumentIconsBasePath
    )

    const initialInstrument = 'PolySynth';
    instrumentSelect.value = initialInstrument;

    const initialChordInstrument = 'PolySynth';

    if (useLeadsheetMode) {
        // create second instrument selector for chord instrument
        chordInstrumentSelectElem = document.createElement('div');
        chordInstrumentSelectElem.id = 'chord-instrument-select';
        document.body.appendChild(chordInstrumentSelectElem);

        chordInstrumentFactories = {
            'PolySynth': () => {return polysynth_chords},
            'Organ': () => {return sampledInstruments['organ']},
            'Harmonium': () => {return sampledInstruments['harmonium']},
            'None': () => {return silentInstrument}
        };

        chordInstrumentSelect = new Nexus.Select('#chord-instrument-select', {
            'size': [275, 40],
            'options': Object.keys(chordInstrumentFactories)
        });

        current_chords_instrument = polysynth_chords;
        let chordInstrumentOnChange = function() {
            current_chords_instrument = chordInstrumentFactories[this.value]();
        };

        chordInstrumentSelect.on('change', chordInstrumentOnChange.bind(chordInstrumentSelect));
        chordInstrumentSelect.value = initialChordInstrument;
    }
}
