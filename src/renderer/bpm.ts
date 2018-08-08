import { ipcRenderer } from 'electron'

import * as Tone from 'tone'
let Nexus = require('./nexusColored')

import { updateLinkBPM } from './linkClient'

let link_channel_prefix: string = require('../common/config.json')['link_channel_prefix'];


let bpmCounter;
let minAcceptedBPM: number = 20
let maxAcceptedBPM: number = 999

export function render(): void{
    // Create BPM display
    let bpmContainerElem: HTMLDivElement = document.createElement('div');
    bpmContainerElem.setAttribute('horizontal', '');
    bpmContainerElem.setAttribute('layout', '');
    bpmContainerElem.setAttribute('display', 'grid');
    bpmContainerElem.setAttribute('grid-template-columns', '200px 200px;');

    document.body.appendChild(bpmContainerElem);

    let bpmNameElem: HTMLElement = document.createElement('div');
    bpmNameElem.textContent = 'BPM'
    bpmContainerElem.appendChild(bpmNameElem);
    let bpmCounterElem: HTMLElement = document.createElement('div');
    bpmCounterElem.setAttribute('id', 'bpm-counter');
    bpmContainerElem.appendChild(bpmCounterElem);

    if (maxAcceptedBPM < 2*minAcceptedBPM) {
        throw Error(`BPM range should be at least one tempo octave wide, ie.
            maxAcceptedBPM at least twice as big as minAcceptedBPM`)
    }
    bpmCounter = new Nexus.Number('#bpm-counter', {
        'min': minAcceptedBPM,
        'max': maxAcceptedBPM,
        'step': 0.01
    });

    bpmCounter.on('change', function(newBPM){
        Tone.Transport.bpm.value = newBPM;
        updateLinkBPM(newBPM);
    });
}


export function getBPM(): number {
    return bpmCounter.value
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
        bpmCounter._value.update(newBPM);
        bpmCounter.render()
    }
};
