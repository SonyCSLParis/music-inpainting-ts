import * as $ from 'jquery';
import * as log from 'loglevel';
import 'nipplejs';

import { OpenSheetMusicDisplay, VexFlowMeasure,
        Fraction, GraphicalMeasure, SourceMeasure } from "opensheetmusicdisplay";
import { AnnotationBox } from './annotationBox';
import { FermataBox } from './fermata';
import { ChordSelector } from './chord_selector';

import '../common/styles/overlays.scss';

let Nexus: any = require('./nexusColored');

export class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, options: object = {},
            boxDurations_quarters: number[],
            annotationTypes: string[] = [], allowOnlyOneFermata: boolean=false,
            copyTimecontainerContent: (origin: HTMLElement, target: HTMLElement) => void) {
        super(container, options);
        this._annotationTypes = annotationTypes;
        this._boxDurations_quarters = boxDurations_quarters;
        this._allowOnlyOneFermata = allowOnlyOneFermata;
        this.copyTimecontainerContent = copyTimecontainerContent;
    }
    private _boxDurations_quarters: number[];

    private _annotationTypes: string[];
    private _allowOnlyOneFermata: boolean;

    private copyTimecontainerContent: (
        (origin: HTMLElement, target: HTMLElement) => void);

    public get annotationTypes(): string[] {
        return this._annotationTypes;
    }

    public get allowOnlyOneFermata(): boolean {
        return this._allowOnlyOneFermata;
    }

    public get boxDurations_quarters(): number[] {
        return this._boxDurations_quarters;
    }

    private _chordSelectors = [];

    public get chordSelectors(): ChordSelector[] {
        return this._chordSelectors;
    }

    private _fermatas = [];

    public get fermatas(): FermataBox[] {
        return this._fermatas;
    }

    public render(onclickFactory=undefined): void {
        this.updateContainerWidth(false);
        super.render();
        this.drawTimestampBoxes(onclickFactory);
        this.container.setAttribute('sequenceDuration_quarters',
            this.sequenceDuration_quarters.toString());
        this.updateContainerWidth(true);
    }

    private updateContainerWidth(toContentWidth: boolean=true): void {
        // HACK update width of container element to actual width of content
        //
        // this is necessary in order to have OSMD print the sheet with
        // maximum horizontal spread

        const superlarge_width_px: number = 10000000;
        // must use a string to ensure no integer formatting is performed
        // which could lead to invalid values in the CSS
        const superlarge_width_px_str: string = '10000000';

        if (!($('#osmd-container svg')[0].hasAttribute('viewBox'))) {
            // OSMD renderer hasn't been initialized yet, do nothing
            return;
        };

        let newWidth_px: number;
        let newWidth_px_str: string;
        const previousWidth_px: number = parseInt(
            $('#osmd-container svg')[0].getAttribute('width'));
        // let x_px_str: string;
        if (toContentWidth) {
            const shift: number = 0;
            const sheetAbsolutePosition_px: number = this.computePositionZoom(
                this.graphicalMusicSheet.MusicPages[0]
                .MusicSystems[0].PositionAndShape
                .AbsolutePosition.x, shift);
            // x_px_str = `${sheetAbsolutePosition_px}`

            const sheetWidth_px: number = this.computePositionZoom(
                this.graphicalMusicSheet.MusicPages[0]
                .MusicSystems[0].PositionAndShape.BorderRight,
                shift);
            const musicSystemRightBorderAbsolutePosition_px = (
                sheetAbsolutePosition_px + sheetWidth_px);
            // add a right margin for more pleasant display
            const sheetContainerWidthWithAddedBorder_px = (
                musicSystemRightBorderAbsolutePosition_px +
                sheetAbsolutePosition_px);

            newWidth_px = sheetContainerWidthWithAddedBorder_px;
            newWidth_px_str = `${newWidth_px}`;

        }
        else {
            newWidth_px = superlarge_width_px;
            newWidth_px_str = superlarge_width_px_str;
        }

        // update the width of the container so the scrollbar operates properly
        $('#osmd-container')[0].style.width = `${newWidth_px_str}px`;
        // update the width of the svg so the scrollbar operates properly
        $('#osmd-container svg')[0].setAttribute('width', `${newWidth_px_str}`);


        // update the viewBox width to reflect the updated width
        const viewBoxRatio_NewToOld = newWidth_px / previousWidth_px;
        const viewBox = $('#osmd-container svg')[0].getAttribute('viewBox');
        const [x_px, y_px, previousWidth_px_str, height_px] = viewBox.split(' ');
        const newViewBoxWidth_px_str: string = (
            viewBoxRatio_NewToOld * parseInt(previousWidth_px_str)).toString();
        $('#osmd-container svg')[0].setAttribute('viewBox',
            `${x_px} ${y_px} ${newViewBoxWidth_px_str} ${height_px}`);
    }

    // compute a position accounting for <this>'s zoom level
    private computePositionZoom(value: number, shift=1): number {
        return ((value - shift) * 10.0 * this.zoom);
    };

    // CSS class depicting the duration of a timecontainer box
    static makeGranularityCSSClass(duration_quarters: number): string {
        return duration_quarters.toFixed() + '_quarterNote_duration'
    }

    // Unique ID for a timecontainer box
    static makeGranularityID(duration_quarters: number,
        measureIndex: number, positionInMeasure: number): string {
        return ([duration_quarters, measureIndex, positionInMeasure]
            .map((string) => string.toFixed())
            .join("-")
            .concat('-timecontainer'))
    }

    /*
    Update sizing of the box with given ID
    */
    private updateTimeContainerSize(divId: string,
        x: number, y: number, width: number, height: number): void {
        const commonDivId = divId + '-common';
        let commonDiv = (document.getElementById(commonDivId) ||
            document.createElement("div"));

        commonDiv.style.top = this.computePositionZoom(y, 0) + 'px';
        commonDiv.style.height = this.computePositionZoom(height, 0) + 'px';
        commonDiv.style.left = this.computePositionZoom(x, 1) + 'px';
        commonDiv.style.width = this.computePositionZoom(width) + 'px';
    }

    /*
    Create an overlay box with given shape and assign it the given divClass
    */
    private createTimeContainer(divId: string,
        duration_quarters: number,
        onclick: (PointerEvent) => void,
        timestamps: [Fraction, Fraction]): HTMLElement {
        // container for positioning the timestamp box and attached boxes
        // needed to properly filter click actions
        const commonDivId = divId + '-common';
        let commonDiv = (document.getElementById(commonDivId) ||
            document.createElement("div"));
        let div = (document.getElementById(divId) ||
            document.createElement("div"));

        if (commonDiv.id !== commonDivId) {
            // the div has no ID set yet: was created in this call
            commonDiv.id = commonDivId;
            commonDiv.classList.add('timecontainer');
            commonDiv.classList.add(
                eOSMD.makeGranularityCSSClass(duration_quarters));

            div.id = divId;
            div.classList.add('notebox');
            div.classList.add('available');
            // div.classList.add(divClass);

            // FIXME constrains granularity
            let containedQuarterNotes = [];
            let quarterNoteStart = Math.floor(timestamps[0].RealValue * 4);
            let quarterNoteEnd = Math.floor(timestamps[1].RealValue*4);
            for (let i=quarterNoteStart; i<quarterNoteEnd; i++) {
                containedQuarterNotes.push(i);
            };
            commonDiv.setAttribute('containedQuarterNotes',
                containedQuarterNotes.toString().replace(/,/g, ' '));
            // div.setAttribute('containedQuarterNotes',
            //     commonDiv.getAttribute('containedQuarterNotes'));

            let granularitySelect: HTMLSelectElement = <HTMLSelectElement>$('#granularity-select-container select')[0];
            const currentGranularity: number = parseInt(
                granularitySelect.options
                [parseInt(granularitySelect.value)]
                .innerText);
            if (currentGranularity == duration_quarters) {
                div.classList.add('active');
            };

            // // insert NipppleJS manager
            // var options = {
            //     zone: div,
            //     color: "blue"
            // };
            // var manager = nipplejs.create(options);
            // var joystick_data = {};
            // var last_click = [];
            div.addEventListener('click', onclick);
            // use bubbling and preventDefault to block window scrolling
            div.addEventListener('wheel', function(event: WheelEvent){
                event.preventDefault();
                let scrollUp = (-event.deltaY>=0)
                cycleGranularity(scrollUp)
            }, false);


            // add Drag'n'Drop support between timecontainers
            div.setAttribute('draggable', 'true')
            div.addEventListener('dragstart',
                ondragstartTimecontainer_handler, true);
            div.addEventListener('dragover',
                ondragoverTimecontainer_handler, true);
            div.addEventListener('dragenter',
                ondragenterTimecontainer_handler, true);
            div.addEventListener('dragleave',
                ondragleaveTimecontainer_handler, true);
            div.addEventListener('drop',
                makeOndropTimecontainer_handler(this.copyTimecontainerContent),
                true);

            // add div to the rendering backend's <HTMLElement> for positioning
            let inner = this.renderingBackend.getInnerElement();
            inner.appendChild(commonDiv);
            commonDiv.appendChild(div);

            if (this.annotationTypes.includes("fermata") && duration_quarters == 1) {  // FIXME hardcoded quarter-note duration
                // add fermata selection box
                this.fermatas.push(new FermataBox(commonDiv,
                    this.sequenceDuration_quarters,
                    this.allowOnlyOneFermata));
            };

            if (this.annotationTypes.includes("chord_selector") && duration_quarters == 2) {
                // add chord selection boxes at the half-note level
                this._chordSelectors.push(new ChordSelector(commonDiv, onclick));
            };
        }

        return div;
    };

    public get sequenceDuration_quarters(): number {
        // FIXME hardcoded 4/4 time-signature
        return this.graphicalMusicSheet.MeasureList.length * 4;
    }

    public get pieceDuration(): Fraction {
        let pieceDuration = new Fraction(0, 1)
        const measureList = this.graphicalMusicSheet.MeasureList;
        const numMeasures: number = measureList.length;
        for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
            const measure: GraphicalMeasure = <GraphicalMeasure>measureList[measureIndex][0]
            const sourceMeasure: SourceMeasure = measure.parentSourceMeasure;
            const measureDuration = sourceMeasure.Duration;

            pieceDuration.Add(measureDuration)
        }
        return pieceDuration;
    }

    public drawTimestampBoxes(onclickFactory: (startTime: Fraction,
        endTime: Fraction) => ((event: PointerEvent) => void)=undefined): void{
        // FIXME this assumes a time signature of 4/4
        let measureList = this.graphicalMusicSheet.MeasureList;
        const numMeasures: number = measureList.length;
        const pieceDuration: Fraction = this.pieceDuration;

        function makeDurationFraction(duration_quarters: number): Fraction {
            return new Fraction(duration_quarters, 4)
        }

        for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++){
            let measure: GraphicalMeasure = <GraphicalMeasure>measureList[measureIndex][0]
            let beginInstructionsWidth: number = measure.beginInstructionsWidth

            let sourceMeasure: SourceMeasure = measure.parentSourceMeasure;

            // compute time interval covered by the measure
            let measureStartTimestamp: Fraction = sourceMeasure.AbsoluteTimestamp;
            let measureEndTimestamp: Fraction = Fraction.plus(measureStartTimestamp, sourceMeasure.Duration);

            let musicSystem = measure.parentMusicSystem;

            // cf. sizing the Cursor in OpenSheetMusicDisplay/Cursor.ts
            let y = musicSystem.PositionAndShape.AbsolutePosition.y + musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
            const endY: number = (musicSystem.PositionAndShape.AbsolutePosition.y +
                musicSystem.StaffLines[musicSystem.StaffLines.length - 1].PositionAndShape.RelativePosition.y
                + 4.0);
            let height = endY - y;

            // for (const [timestampList, granularityName] of timestampsAndNames) {
            this.boxDurations_quarters.forEach((boxDuration_quarters) => {
            // for (const boxDuration_quarters of ) {
                const boxDuration = makeDurationFraction(boxDuration_quarters);

                // we start at the timestamp of the beginning of the current measure
                // and shift by `duration` until we reach the end of the measure
                // to generate all sub-intervals of `duration` in this measure
                // Will generate a single interval if duration is
                const currentBeginTimestamp = measureStartTimestamp.clone();
                const currentEndTimestamp = Fraction.plus(currentBeginTimestamp,
                    boxDuration);

                // HACK breaks if boxDuration equal e.g. Fraction(3, 2)
                if ( boxDuration.WholeValue > 1 && !(measureIndex % boxDuration.WholeValue == 0)) {
                    return
                }

                // number of boxes generated for this boxDuration and this measure
                let boxIndex: number = 0;
                while (currentBeginTimestamp.lt(measureEndTimestamp) &&
                    currentEndTimestamp.lte(pieceDuration)) {
                        let xBeginBox = this.graphicalMusicSheet
                            .calculateXPositionFromTimestamp(currentBeginTimestamp)[0]

                        let xEndBox : number
                        if (currentEndTimestamp.lt(measureEndTimestamp)) {
                            // x-coordinates for the bounding box
                            xEndBox = this.graphicalMusicSheet
                                .calculateXPositionFromTimestamp(currentEndTimestamp)[0]
                            }
                        else {
                            // index of the last measure contained in the current box
                            // e.g. if durationBox is 2, we arrive in `measureIndex+1`
                            const lastContainedMeasureIndex: number = measureIndex + boxDuration.WholeValue - 1*(boxDuration.RealValue == boxDuration.WholeValue?1:0);
                            const lastMeasure: GraphicalMeasure = <GraphicalMeasure>measureList[lastContainedMeasureIndex][0]
                            // reached last segment of the measure
                            // set xRight as the x-position of the next measure bar
                            xEndBox = (lastMeasure.PositionAndShape.AbsolutePosition.x +
                                lastMeasure.PositionAndShape.Size.width) + 1
                        }

                        if (beginInstructionsWidth>1) {
                            // add x-offset to compensate for the presence of special
                            // symbols (e.g. key symbols) at the beginning of the measure
                            if (beginInstructionsWidth > 5) {
                                xBeginBox -= 1  // HACK hardcoded
                                xEndBox -= 1
                            }
                            else {
                                xBeginBox -= 2
                                xEndBox -= 2
                            }
                        }
                        let width = xEndBox - xBeginBox;
                        let onclick = (event: PointerEvent) => {};
                        if (onclickFactory) {
                            onclick = onclickFactory(currentBeginTimestamp,
                                currentEndTimestamp)
                        };

                        const timecontainerID = eOSMD.makeGranularityID(
                            boxDuration_quarters,
                            measureIndex,
                            boxIndex
                        );

                        if (!document.getElementById(timecontainerID)) {
                            // the time container does not yet exist, create it
                            this.createTimeContainer(
                                timecontainerID,
                                boxDuration_quarters,
                                onclick,
                                [currentBeginTimestamp, currentEndTimestamp]
                            );
                        };

                        this.updateTimeContainerSize(timecontainerID,
                            xBeginBox, y, width, height);


                        // continue to next time container
                        currentBeginTimestamp.Add(boxDuration);
                        currentEndTimestamp.Add(boxDuration)
                        boxIndex++;
                    }
                })
        }
    }
}

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

    public drawTimestampBoxes(onclickFactory: (startTime: Fraction,
        endTime: Fraction) => ((event: PointerEvent) => void)=undefined,
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
export function registerZoomTarget(osmd: eOSMD) {
    zoomTargetOSMD = osmd;
};

export async function renderZoomControls(containerElement: HTMLElement,
    osmd_target_promise: Promise<eOSMD>): Promise<void> {
    // let osmd_target = await osmd_target_promise;
    let zoomOutButton = document.createElement('i');
    let zoomInButton = document.createElement('i');
    containerElement.appendChild(zoomOutButton);
    containerElement.appendChild(zoomInButton);

    zoomOutButton.classList.add("zoom-out", "fa-search-minus");
    zoomInButton.classList.add("zoom-in", "fa-search-plus");

    const mainIconSize: string = 'fa-3x';

    let zoomButtons = [zoomOutButton, zoomInButton];
    zoomButtons.forEach((zoomButton) => {
        zoomButton.classList.add('fas');
        zoomButton.classList.add(mainIconSize);
        zoomButton.style.alignSelf = 'inherit';
        zoomButton.style.cursor = 'pointer';
        // FIXME not super visible
        zoomButton.style.color = 'lightpink';
    });

    zoomOutButton.addEventListener('click', function() {
        zoomTargetOSMD.zoom /= 1.2;
        zoomTargetOSMD.render();
        log.info(`OSMD zoom level now: ${zoomTargetOSMD.zoom}`);
    })
    zoomInButton.addEventListener('click', function() {
        zoomTargetOSMD.zoom *= 1.2;
        zoomTargetOSMD.render();
        log.info(`OSMD zoom level now: ${zoomTargetOSMD.zoom}`);
    })
}
