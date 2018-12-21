import * as Tone from 'tone'
let Nexus = require('./nexusColored')

import LinkClient from './linkClient';
import * as ControlLabels from './controlLabels';

let bpmControl;
let minAcceptedBPM: number = 30
let maxAcceptedBPM: number = 300

export function render(useSimpleSlider: boolean): void{
    if (maxAcceptedBPM < 2*minAcceptedBPM) {
        throw Error(`BPM range should be at least one tempo octave wide, ie.
            maxAcceptedBPM at least twice as big as minAcceptedBPM`)
    }

    // Create BPM display
    let bpmContainerElem: HTMLElement = document.createElement('control-item');
    bpmContainerElem.id = 'bpm-control',
    bpmContainerElem.setAttribute('horizontal', '');
    bpmContainerElem.setAttribute('layout', '');
    bpmContainerElem.setAttribute('display', 'grid');
    bpmContainerElem.setAttribute('grid-template-columns', '200px 200px;');

    let bottomControlsElem: HTMLElement = document.getElementById('bottom-controls');
    bottomControlsElem.appendChild(bpmContainerElem);

    ControlLabels.createLabel(bpmContainerElem, 'bpm-control-label');

    if (!useSimpleSlider) {
        let bpmControlElem: HTMLElement = document.createElement('div');
        bpmControlElem.setAttribute('id', 'bpm-control');
        bpmContainerElem.appendChild(bpmControlElem);
        bpmControl = new Nexus.Number('#bpm-control', {
            'min': minAcceptedBPM,
            'max': maxAcceptedBPM,
            'step': 1
        });
    }
    else {
        let bpmSliderElem: HTMLElement = document.createElement('div');
        bpmSliderElem.setAttribute('id', 'bpm-control');
        bpmContainerElem.appendChild(bpmSliderElem);

        bpmControl = new Nexus.Slider('#bpm-control', {
            'size': [100, 40],
            'mode': 'absolute',  // 'relative' or 'absolute'
            'min': 90,
            'max': 120,
            'step': 15,
            'value': 105,
        });
    }

    bpmControl.on('change', function(newBPM){
        Tone.Transport.bpm.value = newBPM;
        LinkClient.updateLinkBPM(newBPM);
    });
}


export function getBPM(): number {
    return bpmControl.value
}


export function setBPM(newBPM): void {
    // ensure the new BPM is in the accepted range
    // this works because the accepted range is at least strictly one octave wide
    while (newBPM > maxAcceptedBPM) { newBPM = newBPM / 2; }
    while (newBPM < minAcceptedBPM) { newBPM = 2 * newBPM; }

    // HACK perform a comparison to avoid messaging loops, since
    // the link update triggers a bpm modification message
    if (Tone.Transport.bpm.value !== newBPM) {
        Tone.Transport.bpm.value = newBPM;
        bpmControl._value.update(newBPM);
        bpmControl.render()
    }
};
