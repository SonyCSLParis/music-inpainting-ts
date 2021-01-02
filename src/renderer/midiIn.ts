import * as log from 'loglevel';
import * as ControlLabels from './controlLabels';

import Nexus from './nexusColored';

import Tone from 'tone';

// @tonejs/piano@0.2.1 is built as an es6 module, so we use the trick from
// https://www.typescriptlang.org/docs/handbook/modules.html#optional-module-loading-and-other-advanced-loading-scenarios
// to load the types and the implementation separately
// this ensures that babel is correctly applied on the imported javascript
import { MidiInput as PianoMidiInputInterface } from '@tonejs/piano'
let PianoMidiInputImplementation: typeof PianoMidiInputInterface = require('babel-loader!@tonejs/piano').MidiInput

let midiInputListener: PianoMidiInputInterface = new PianoMidiInputImplementation('all');

export async function getMidiInputListener(): Promise<PianoMidiInputInterface> {
    await PianoMidiInputImplementation.enabled();
    return midiInputListener;
}

export async function render(useChordsInstrument: boolean = false) {
    let bottomControlsGridElem = document.getElementById('bottom-controls');

    let midiInSelectElem: HTMLElement = document.createElement('control-item');
    midiInSelectElem.id = 'select-midi-in';
    midiInSelectElem.classList.add('advanced');
    bottomControlsGridElem.appendChild(midiInSelectElem);

    ControlLabels.createLabel(midiInSelectElem, 'select-midi-in-label', true);

    const disabledInputId: string = 'Disabled';

    async function makeOptions(): Promise<string[]> {
        const devices = await PianoMidiInputImplementation.getDevices();
        const devicesNames = devices.map((data) => data.name);
        return [disabledInputId, 'All'].concat(devicesNames);
    }

    let midiInSelect = new Nexus.Select('#select-midi-in', {
        'size': [150, 50],
        'options': await makeOptions(),
    });

    async function getDeviceId(name: string): Promise<string> {
        const devices = await PianoMidiInputImplementation.getDevices();
        return devices.find((data) => data.name == name).id
    }

    async function updateOptions(): Promise<void> {
        const currentInput = midiInSelect.value;
        const newOptions = await makeOptions();
        midiInSelect.defineOptions(newOptions);
        if ( newOptions.includes(currentInput) ) {
            // restore previously selected input
            midiInSelect.value = currentInput;
        }
        else {
            // previously selected input is not available anymore,
            // disable input for safety
            midiInSelect.value = disabledInputId;
        }
        log.info('[MIDI IN]: Updated list of inputs, now', JSON.stringify(newOptions));
    }

    midiInputListener.on('connect', updateOptions);
    midiInputListener.on('disconnect', updateOptions);

    async function midiInOnChange(_: any): Promise<void> {
        if (this.value == 'Disabled') {
            midiInputListener.deviceId = null;
        }
        else if (this.value == 'All') {
            midiInputListener.deviceId = 'all';
        }
        else {
            midiInputListener.deviceId = await getDeviceId(this.value);
        }
        log.info('Selected MIDI In: ' + this.value);
    };

    midiInSelect.on('change', midiInOnChange.bind(midiInSelect));
    midiInSelect.value = 'Disabled';
}
