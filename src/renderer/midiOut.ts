import * as Tone from 'tone'
import * as WebMidi from 'webmidi'
import * as log from 'loglevel'

let Nexus = require('./nexusColored')

let dummyMidiOut = new Tone.Instrument();
dummyMidiOut.playNote = () => {};

let midiOut = dummyMidiOut;

export function render() {
    let topControlsGridElem = document.getElementById('bottom-controls');
    let midiOutSelectElem: HTMLElement = document.createElement('control-item');
    midiOutSelectElem.id = 'select-midiout';
    topControlsGridElem.appendChild(midiOutSelectElem);

    let instrumentSelectElem = document.getElementById('instrument-select-container');

    WebMidi.enable(function (err) {
        if (err) log.error(err);

        let midiOutSelect = new Nexus.Select('#select-midiout', {
            'size': [150, 50],
            'options': ['No Output'].concat(WebMidi.outputs.map((output) => output.name)),
        });
        function midiOutOnChange(ev) {
            if (this.value !== 'No Output') {
                instrumentSelectElem.classList.toggle('disabled', true);
                midiOut = WebMidi.getOutputByName(this.value);
                Tone.Master.mute = true;
            }
            else {
                instrumentSelectElem.classList.toggle('disabled', false);
                Tone.Master.mute = false;
                midiOut = dummyMidiOut;
            }
            log.info('Selected MIDI out: ' + this.value);
        };
        midiOutSelect.on('change', midiOutOnChange.bind(midiOutSelect));
        midiOutSelect.value = 'No Output';
    });
}


export function getOutput() {
    return midiOut
}
