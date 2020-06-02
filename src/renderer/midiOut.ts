import * as Tone from 'tone';
import WebMidi, {Output} from 'webmidi';
import * as log from 'loglevel';

let Nexus = require('./nexusColored')

let midiOut: false | Output = false;

export function render(useChordsInstrument: boolean = false) {
    let bottomControlsGridElem = document.getElementById('bottom-controls');
    let midiOutSelectElem: HTMLElement = document.createElement('control-item');
    midiOutSelectElem.id = 'select-midiout';
    bottomControlsGridElem.appendChild(midiOutSelectElem);

    WebMidi.enable(function (err) {
        if (err) log.error(err);

        let midiOutSelect = new Nexus.Select('#select-midiout', {
            'size': [150, 50],
            'options': ['No Output'].concat(
                WebMidi.outputs.map((output) => output.name)),
        });

        function midiOutOnChange(_: any): void {
            if (this.value !== 'No Output') {
                if (!(WebMidi.getOutputByName(this.value))) {
                    log.warn('Midi output ' + this.value + ' not found');
                }
                midiOut = WebMidi.getOutputByName(this.value);
            }
            else {
                midiOut = false;
            }
            log.info('Selected MIDI out: ' + this.value);
        };

        midiOutSelect.on('change', midiOutOnChange.bind(midiOutSelect));
        midiOutSelect.value = 'No Output';
    });
}


export function getOutput(): false | Output {
    return midiOut
}
