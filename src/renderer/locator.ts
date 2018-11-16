import * as $ from 'jquery';
import * as log from 'loglevel';
import 'nipplejs';

import { OpenSheetMusicDisplay, VexFlowMeasure,
        Fraction, GraphicalMeasure, SourceMeasure } from "opensheetmusicdisplay";
import { AnnotationBox } from './annotationBox';
import { FermataBox } from './fermata';
import { ChordSelector } from './chord_selector';

import '../common/styles/overlays.scss';

export class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, options: object = {},
            annotationType: string = "none", allowOnlyOneFermata: boolean=false) {
        super(container, options);
        this._boundingBoxes = [];
        this.annotationType = annotationType;
        this._allowOnlyOneFermata = allowOnlyOneFermata;

        let self = this;
        // document.addEventListener('onresize',
        //     () => self.updateContainerWidth(true));
    }
    public _boundingBoxes: [number, number, number, number][];

    public annotationType: string;
    private _allowOnlyOneFermata: boolean;

    public get allowOnlyOneFermata(): boolean {
        return this._allowOnlyOneFermata;
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
        this.updateContainerWidth(true);
    }

    private computeBoundingBoxes(): void {
        // TODO find measureIndex and staffIndex
        let measureList = this.graphicalMusicSheet.MeasureList;
        let numMeasures: number = measureList.length;
        let numberOfStaves = measureList[0].length;
        let staffIndex = 0;
        let boundingBoxes = [];
        for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {

            let measure: VexFlowMeasure = <VexFlowMeasure>measureList[measureIndex][staffIndex] // first staff
            // let staff = measure.getVFStave();
            let system = measure.parentMusicSystem;
            let height = system.PositionAndShape.Size.height;
            let measureBoundingBox = measure.PositionAndShape;
            let x = measureBoundingBox.AbsolutePosition.x;
            let y = measureBoundingBox.AbsolutePosition.y;
            let width = measureBoundingBox.Size.width;

            let rectangle = {
                "xmin": x * 10,
                "ymin": y * 10,
                "xmax": (x + width) * 10,
                "ymax": (y + height) * 10
            };
            boundingBoxes.push(rectangle);

        }
        this._boundingBoxes = boundingBoxes;
    };

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

    /*
    Create an overlay box with given shape and assign it the given divClass
    */
    private createTimeDiv(x, y, width, height, divClass: string, divId: string,
        onclick: (PointerEvent) => void,
        timestamps: [Fraction, Fraction]): HTMLElement {
        // container for positioning the timestamp box and attached boxes
        // needed to properly filter click actions
        const commonDivId = divId + '-common';
        let commonDiv = (document.getElementById(commonDivId) ||
            document.createElement("div"));
        let div = (document.getElementById(divId) ||
            document.createElement("div"));

        commonDiv.style.top = this.computePositionZoom(y, 0) + 'px';
        commonDiv.style.height = this.computePositionZoom(height, 0) + 'px';
        commonDiv.style.left = this.computePositionZoom(x, 1) + 'px';
        commonDiv.style.width = this.computePositionZoom(width) + 'px';

        if (commonDiv.id !== commonDivId) {
            // the div has no ID set yet: was created in this call
            commonDiv.id = commonDivId;
            commonDiv.classList.add('timecontainer');
            commonDiv.classList.add(divClass);

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

            let granularitySelect : HTMLSelectElement = <HTMLSelectElement>$('#granularity-select-container select')[0];
            const currentGranularity = granularitySelect[
                parseInt(granularitySelect.value)].textContent;
            if (currentGranularity == divClass) div.classList.add('active');

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
            div.addEventListener('wheel', function(event){
                event.preventDefault();
                let scrollUp = (-event.deltaY>=0)
                cycleGranularity(scrollUp)
            }, false);

            // add div to the rendering backend's <HTMLElement> for positioning
            let inner = this.renderingBackend.getInnerElement();
            inner.appendChild(commonDiv);
            commonDiv.appendChild(div);

            if (this.annotationType == "fermata" && divClass === 'quarter-note') {  // FIXME hardcoded quarter-note duration
                // add fermata selection box
                this.fermatas.push(new FermataBox(commonDiv, this.sequenceDuration(), this.allowOnlyOneFermata));
            };

            if (this.annotationType == "chord-selector" && divClass == 'half-note') {
                // add chord selection boxes at the half-note level
                this._chordSelectors.push(new ChordSelector(commonDiv, onclick));
            };
        }

        return div;
    };

    private sequenceDuration(): number {
        // FIXME hardcoded 4/4 time-signature
        return this.graphicalMusicSheet.MeasureList.length * 4;
    }

    private drawChordBox(timestampDiv: HTMLElement) {
        // Position chord box over `timestampElement`
        // FIXME hardcoded half-note duration
        const chordDivId = timestampDiv.id + '-chord'
        let chordDiv = (document.getElementById(chordDivId) ||
            document.createElement("div"));
        chordDiv.id = chordDivId
        chordDiv.classList.add('chord');

        let containedQuarters_str: string = timestampDiv.getAttribute('containedquarternotes')
        chordDiv.setAttribute('containedquarternotes', containedQuarters_str);

        chordDiv.addEventListener('click', () => {
            chordDiv.classList.toggle('active')
        })

        timestampDiv.parentNode.appendChild(chordDiv);
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

    public drawTimestampBoxes(onclickFactory: (startTime: Fraction, endTime: Fraction) => ((event) => void)=undefined): void{
        // FIXME this assumes a time signature of 4/4
        let measureList = this.graphicalMusicSheet.MeasureList;
        const numMeasures: number = measureList.length;
        const pieceDuration: Fraction = this.pieceDuration;

        function makeTimestamps(timeTuples: [number, number][]): Fraction[]{
            return timeTuples.map(([num, den]) => new Fraction(num, den))
        }

        const durationQuarterNote: Fraction = new Fraction(1, 4)
        const durationHalfNote: Fraction = new Fraction(1, 2);
        const durationWholeNote: Fraction = new Fraction(1, 1);

        const durationTwoWhole: Fraction = new Fraction(2, 1);
        const durationThreeWhole: Fraction = new Fraction(3, 1);
        const durationFourWhole: Fraction = new Fraction(4, 1);

        const boxDurationsAndNames: [Fraction, string][] = [
            [durationQuarterNote, "quarter-note"],
            [durationHalfNote, "half-note"],
            [durationWholeNote, "whole-note"],
            [durationTwoWhole, "two-whole-notes"],
            [durationThreeWhole, "three-whole-notes"],
            [durationFourWhole, "four-whole-notes"]
        ]

        for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++){
            let measure: GraphicalMeasure = <GraphicalMeasure>measureList[measureIndex][0]
            let beginInstructionsWidth: number = measure.beginInstructionsWidth

            let sourceMeasure: SourceMeasure = measure.parentSourceMeasure;

            // compute time interval covered by the measure
            let measureStartTimestamp: Fraction = sourceMeasure.AbsoluteTimestamp;
            let measureEndTimestamp: Fraction = Fraction.plus(measureStartTimestamp, sourceMeasure.Duration);

            let musicSystem = measure.parentMusicSystem;
            let systemTop = musicSystem.PositionAndShape.AbsolutePosition.y;
            let systemHeight = musicSystem.PositionAndShape.Size.height;

            // cf. sizing the Cursor in OpenSheetMusicDisplay/Cursor.ts
            let y = musicSystem.PositionAndShape.AbsolutePosition.y + musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
            const endY: number = musicSystem.PositionAndShape.AbsolutePosition.y +
              musicSystem.StaffLines[musicSystem.StaffLines.length - 1].PositionAndShape.RelativePosition.y + 4.0;
            let height = endY - y;

            // for (const [timestampList, granularityName] of timestampsAndNames) {
            for (const [boxDuration, granularityName] of boxDurationsAndNames) {
                // we start at the timestamp of the beginning pof the current measure
                // and shift by `duration` until we reach the end of the measure
                // to generate all sub-intervals of `duration` in this measure
                // Will generate a single interval if duration is
                const currentBeginTimestamp = measureStartTimestamp.clone();
                const currentEndTimestamp = Fraction.plus(currentBeginTimestamp,
                    boxDuration);

                // HACK breaks if boxDuration equal e.g. Fraction(3, 2)
                if ( boxDuration.WholeValue > 1 && !(measureIndex % boxDuration.WholeValue == 0)) {
                    continue
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
                        let onclick = (event) => {};
                        if (onclickFactory) {
                            onclick = onclickFactory(currentBeginTimestamp,
                                currentEndTimestamp)
                        };

                        this.createTimeDiv(
                            xBeginBox, y, width, height,
                            granularityName,
                            `${granularityName}-${measureIndex}-${boxIndex}`,
                            onclick,
                            [currentBeginTimestamp, currentEndTimestamp]
                        );

                        // translate the box in time
                        currentBeginTimestamp.Add(boxDuration);
                        currentEndTimestamp.Add(boxDuration)
                        boxIndex++;
                    }

            }
        }
    }

    public get boundingBoxes() {
        this.computeBoundingBoxes();
        return this._boundingBoxes;
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

export function renderZoomControls(containerElement: HTMLElement,
    osmd_target: eOSMD): void {
    let zoomOutButton = document.createElement('i');
    let zoomInButton = document.createElement('i');
    containerElement.appendChild(zoomOutButton);
    containerElement.appendChild(zoomInButton);

    zoomOutButton.classList.add("zoom-out", "fa-search-minus");
    zoomInButton.classList.add("zoom-in", "fa-search-plus");

    // zoomOutButton.classList.add('left-column');
    // zoomInButton.classList.add('right-column');

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
        osmd_target.zoom /= 1.2;
        osmd_target.render();
        log.info(`OSMD zoom level now: ${osmd_target.zoom}`);
    })
    zoomInButton.addEventListener('click', function() {
        osmd_target.zoom *= 1.2;
        osmd_target.render();
        log.info(`OSMD zoom level now: ${osmd_target.zoom}`);
    })
}
