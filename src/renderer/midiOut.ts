import { MidiOutput } from './midi_io/midiOutput';
import WebMidi, { Output } from 'webmidi';

import * as log from 'loglevel';
import * as Instruments from './instruments';
import * as ControlLabels from './controlLabels';

import Nexus from './nexusColored';

let midiOutputListener = new MidiOutput(null);

export async function getMidiOutputListener(): Promise<MidiOutput> {
    await MidiOutput.enabled();
    return midiOutputListener;
}


export async function render(useChordsInstrument: boolean = false) {
    let bottomControlsGridElem = document.getElementById('bottom-controls');

    let midiOutSelectElem: HTMLElement = document.createElement('control-item');
    midiOutSelectElem.id = 'select-midi-out';
    midiOutSelectElem.classList.add('advanced');
    bottomControlsGridElem.appendChild(midiOutSelectElem);

    ControlLabels.createLabel(midiOutSelectElem, 'select-midi-out-label', true);

    const disabledOutputId: string = 'Disabled';

    async function makeOptions(): Promise<string[]> {
        const devices = await MidiOutput.getDevices();
        const devicesNames = devices.map((data) => data.name);
        return [disabledOutputId, 'All'].concat(devicesNames);
    }

    let midiOutSelect = new Nexus.Select('#select-midi-out', {
        'size': [150, 50],
        'options': await makeOptions(),
    });

    async function getDeviceId(name: string): Promise<string> {
        const devices = await MidiOutput.getDevices();
        return devices.find((data) => data.name == name).id
    }

    async function updateOptions(): Promise<void> {
        const currentOutput = midiOutSelect.value;
        const newOptions = await makeOptions();
        midiOutSelect.defineOptions(newOptions);
        if ( newOptions.includes(currentOutput) ) {
            // restore previously selected output
            midiOutSelect.value = currentOutput;
        }
        else {
            // previously selected output is not available anymore,
            // disable output for safety
            midiOutSelect.value = disabledOutputId;
        }
        log.info('[MIDI OUT]: Updated list of outputs, now', JSON.stringify(newOptions));
    }

    (await getMidiOutputListener()).on('connect', updateOptions);
    (await getMidiOutputListener()).on('disconnect', updateOptions);

    async function midiOutOnChange(_: any): Promise<void> {
        if (this.value == disabledOutputId) {
            midiOutputListener.deviceId = null;
            Instruments.mute(false)
        }
        else {
            if (this.value == 'All') {
                midiOutputListener.deviceId = 'all';
            }
            else {
                midiOutputListener.deviceId = await getDeviceId(this.value);
            }
            Instruments.mute(true);
        }
        log.info('Selected MIDI Out: ' + this.value);
    };

    midiOutSelect.on('change', midiOutOnChange.bind(midiOutSelect));
    midiOutSelect.value = await makeOptions()[0];
}


export function getOutput(): false | Output {
    if ( midiOutputListener.deviceId === null ) {
        return false;
    }
    else {
        return WebMidi.getOutputById(midiOutputListener.deviceId);
    }
}
