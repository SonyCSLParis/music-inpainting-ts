import * as Tone from 'tone'
import Nexus from './nexusColored';

import LinkClient from './ableton_link/linkClient';
import * as ControlLabels from './controlLabels';

export class NumberControl {
    protected readonly parent: HTMLElement;
    readonly interactionId: string;
    readonly labelId: string;
    readonly id: string;
    readonly range: [number, number];
    protected controller;
    readonly onchange: (newValue: number) => void;
    private readonly initialValue: number;

    constructor (parent: HTMLElement, id: string, range: [number, number],
        initialValue: number,
        onchange: (newValue: number) => void = (v) => {}
        ) {
        this._checkRange(range, initialValue);

        this.parent = parent;
        this.id = id;
        this.labelId = this.id + '-label';
        this.interactionId = this.id + '-interaction';
        this.range = range;
        this.onchange = onchange;
        this.initialValue = initialValue;
    }

    protected _checkRange(range: [number, number], initialValue: number) {
        if (range[1] < initialValue || range[0] > initialValue) {
            throw Error(`Selected initial value should be in the accepted range`);
        }
    }

    get container(): HTMLElement {
        return document.getElementById(this.id);
    }

    render(useSimpleSlider: boolean = false, elementWidth: number): void{
        let containerElem: HTMLElement = document.createElement('control-item');
        containerElem.id = this.id,
        containerElem.setAttribute('horizontal', '');
        containerElem.setAttribute('layout', '');
        containerElem.setAttribute('display', 'grid');
        containerElem.setAttribute('grid-template-columns', '200px 200px;');

        this.parent.appendChild(containerElem);

        ControlLabels.createLabel(containerElem, this.labelId, false, null,
            this.parent);

        if (!useSimpleSlider) {
            let interactionElem: HTMLElement = document.createElement('div');
            interactionElem.id = this.interactionId;
            containerElem.appendChild(interactionElem);
            this.controller = new Nexus.Number('#' + this.interactionId, {
                'min': this.range[0],
                'max': this.range[1],
                'step': 1,
                'value': this.initialValue,
            });
            this.controller.element.style.width = Math.round(elementWidth).toString() + 'px';
        }
        else {
            let bpmSliderElem: HTMLElement = document.createElement('div');
            bpmSliderElem.id = this.id;
            containerElem.appendChild(bpmSliderElem);

            this.controller = new Nexus.Slider('#' + this.id, {
                'size': [100, 40],
                'mode': 'absolute',  // 'relative' or 'absolute'
                'min': this.range[0],
                'max': this.range[1],
                'step': (this.range[1] - this.range[0]) / 10,
                'value': this.initialValue,
            });
        }

        this.controller.on('change', this.onchange);
    }

    get value(): number {
        return this.controller.value;
    }

    set value(newValue: number) {
        this.controller.value = newValue;
    }
}

export class BPMControl extends NumberControl {
    protected static onchangeCallback_default= (newBPM) => {
        Tone.getTransport().bpm.value = newBPM;
        LinkClient.updateLinkBPM(newBPM);
    }
    protected static defaultRange: [number, number] = [30, 300];
    protected static defaultInitialValue: number = 100;

    constructor(containerElement: HTMLElement, id: string,
            range: [number, number] = BPMControl.defaultRange,
            initialValue: number = BPMControl.defaultInitialValue,
            onchange: (newValue: number) => void = BPMControl.onchangeCallback_default
            ) {
        super(containerElement, id, range, initialValue, onchange);
    }

    protected _checkRange(range: [number, number]) {
        if (range[1] < 2 * range[0]) {
            throw Error(`BPM range should be at least one tempo octave wide, ie.
            maxAcceptedBPM at least twice as big as minAcceptedBPM`);
        }
    }

    // ensure the new BPM is in the accepted range
    // this works because the accepted range is at least strictly one octave wide
    set value(newBPM: number) {
        while (newBPM > this.range[1]) { newBPM = newBPM / 2; }
        while (newBPM < this.range[0]) { newBPM = 2 * newBPM; }

        // HACK perform a comparison to avoid messaging loops, since
        // the link update triggers a bpm modification message
        if (Tone.getTransport().bpm.value !== newBPM) {
            Tone.getTransport().bpm.value = newBPM;
            this.controller._value.update(newBPM);
            this.controller.render()
        }
    };

    // must also subclass getter if subclassing setter,
    // see https://stackoverflow.com/a/28951055
    // otherwise return value is `undefined`
    get value(): number {
        return super.value
    }

}
