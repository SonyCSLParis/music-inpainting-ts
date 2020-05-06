import * as $ from 'jquery';
import * as log from 'loglevel';
import 'nipplejs';

import '../common/styles/overlays.scss';

let Nexus: any = require('./nexusColored');

export class Spectrogram {
    protected resizeTimeoutDuration: number = 10;
    protected resizeTimeout: NodeJS.Timeout;
    readonly container: HTMLElement;
    readonly interfaceContainer: HTMLElement;
    private sequencer = null;

    constructor(container: HTMLElement, options: object = {},
            boxDurations_quarters: number[],
            copyTimecontainerContent: (origin: HTMLElement, target: HTMLElement) => void) {
        this.container = container;

        // necessary to handle 'busy' state cursor change and pointer events disabling
        this.interfaceContainer = document.createElement('div');
        this.interfaceContainer.id = this.container.id + '-interface-container';
        this.container.appendChild(this.interfaceContainer);

        this._boxDurations_quarters = boxDurations_quarters;
        this.copyTimecontainerContent = copyTimecontainerContent;

        window.addEventListener('resize', (uiEvent: UIEvent) => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.render(this.numRows, this.numColumns);},
                this.resizeTimeoutDuration)
        })
    }

    public get mask(): number[][] {
        return this.sequencer.matrix.pattern;
    }

    private _boxDurations_quarters: number[];

    private copyTimecontainerContent: (
        (origin: HTMLElement, target: HTMLElement) => void);

    public get boxDurations_quarters(): number[] {
        return this._boxDurations_quarters;
    }

    public registerCallback(callback: (ev: any) => void) {
        let self = this;
        let registerReleaseCallback = () => {
            // call the actual callback on pointer release to allow for click and drag
            document.addEventListener('pointerup',
                (v) => { if ( !this.isEmpty() ) {callback(v)}},
                {'once': true}  // eventListener removed after being called
            );
        }

        this.interfaceContainer.addEventListener('pointerdown', registerReleaseCallback);
    }

    setPosition(timePosition: number): void {
        this.sequencer.stepper.value = timePosition;
    }

    protected get numRows(): number {
        return this.sequencer.rows;
    };

    protected get numColumns(): number {
        return this.sequencer.columns;
    };

    public render(numRows: number, numColumns: number, onclickFactory=undefined): void {
        if ( this.sequencer !== null ) {
            this.sequencer.destroy();}
        this.drawTimestampBoxes(onclickFactory, numRows, numColumns);
        this.container.setAttribute('sequenceDuration_quarters',
            this.sequenceDuration_quarters.toString());
    }

    public clear(): void {
        this.sequencer.matrix.populate.all(0);
    }

    public isEmpty(): boolean {
        return this.mask.reduce(
            (acc, val) => acc + val.reduce((acc, val) => acc+val, 0), 0) == 0
    }

    private zoom: number = 1;

    // compute a position accounting for <this>'s zoom level
    private computePositionZoom(value: number, shift=0): number {
        return ((value - shift) * 10.0 * this.zoom);
    };

    public get sequenceDuration_quarters(): number {
        // TODO(theis): check this, does it make any sense to have this attribute?
        return 2;
    }

    public drawTimestampBoxes(onclickFactory: undefined,
        numRows: number, numColumns: number): void{
            const spectrogramImageElem: HTMLImageElement = this.container.getElementsByTagName('img')[0];
            const width: number = spectrogramImageElem.clientWidth;
            const height: number = spectrogramImageElem.clientHeight;

            this.sequencer = new Nexus.Sequencer(this.interfaceContainer.id, {
                'size': [width, height],
                'mode': 'toggle',
                'rows': numRows,
                'columns': numColumns,
            });
    }
}


function cycleGranularity(increase: boolean) {
    let granularitySelect = $('#granularity-select-container select');
    // if (granularitySelect.length > 0) {
    let granularitySelectElem = <HTMLSelectElement>granularitySelect[0];
    // let granularitySelectElem: HTMLSelectElement = <HTMLSelectElement>document.getElementById('select-granularity').children[0]
    const selectedGranularity = parseInt(granularitySelect.val().toString());
    const numOptions = granularitySelectElem.children.length

    if (increase) {
        granularitySelectElem.value =
            Math.min(selectedGranularity + 1, numOptions-1).toString()
    }
    else {
        granularitySelectElem.value =
            Math.max(selectedGranularity - 1, 0).toString()}

    // trigger `onchange` callback
    granularitySelectElem.dispatchEvent(new Event('change'))
// }
}

// Drag and Drop

// Allow drag and drop of one timecontainer's content onto another

function ondragstartTimecontainer_handler(event: DragEvent) {
    // perform a copy operation of the data in the time container
    event.dataTransfer.dropEffect = 'copy';
    // Store the dragged container's ID to allow retrieving it from the drop
    // target
    const targetID: string = (<HTMLElement>event.target).id;
    event.dataTransfer.setData("text/plain", targetID);
}

function ondragoverTimecontainer_handler(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

function ondragenterTimecontainer_handler(event: DragEvent) {
    (<HTMLElement>event.target).classList.add('dragover');
}

function ondragleaveTimecontainer_handler(event: DragEvent) {
    (<HTMLElement>event.target).classList.remove('dragover');
}

function makeOndropTimecontainer_handler(copyTimecontainerContent: (
    origin: HTMLElement, target: HTMLElement) => void) {
    return function (event: DragEvent) {
        // only allow drop if the source of the drag was a time-container
        const sourceID: string = event.dataTransfer.getData("text/plain");
        const sourceElement: HTMLElement = document.getElementById(sourceID);
        const isValidID: boolean = sourceElement != null;
        if (isValidID && sourceElement.classList.contains("notebox")) {
            event.preventDefault();
            const targetElement: HTMLElement = <HTMLElement>event.target;
            copyTimecontainerContent(sourceElement.parentElement,
                    targetElement.parentElement);

            // clean-up after drag
            targetElement.classList.remove('dragover');
        }
    }
}

// TODO replace this with using a Promise<eOSMD> in the renderZoomControl function
let zoomTargetOSMD;