import { OpenSheetMusicDisplay, VexFlowMeasure,
        Fraction, StaffMeasure, SourceMeasure } from "opensheetmusicdisplay";
import { FermataBox } from './fermata';
import { ChordSelector } from './chord_selector';
import * as $ from 'jquery';
import 'nipplejs'
import '../common/styles/overlays.scss';

export class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, autoResize: boolean = false,
            isLeadsheet: boolean = false) {
        super(container, autoResize);
        this._boundingBoxes = [];
        this.isLeadsheet = isLeadsheet;

        let self = this;
        // document.addEventListener('onresize',
        //     () => self.updateContainerWidth(true));
    }
    public _boundingBoxes: [number, number, number, number][];

    public isLeadsheet: boolean;

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

        // must use a string to ensure no integer formatting is performed
        const superlarge_width_px_str: string = '10000000';

        if (!($('#osmd-container svg')[0].hasAttribute('viewBox'))) {
            // OSMD renderer hasn't been initialized yet, do nothing
            return;
        };

        let width_px_str: string;
        if (toContentWidth) {
            const shift: number = 0;
            const sheetAbsolutePosition_px: number = this.computePositionZoom(
                this.graphicalMusicSheet.MusicPages[0]
                .MusicSystems[0].PositionAndShape
                .AbsolutePosition.x, shift);
            const sheetWidth_px: number = this.computePositionZoom(
                this.graphicalMusicSheet.MusicPages[0]
                .MusicSystems[0].PositionAndShape.BorderRight,
                shift);
            const musicSystemWidthRightBorderAbsolutePosition_px = (
                sheetAbsolutePosition_px + sheetWidth_px);
            // add a right margin for more pleasant display
            const sheetContainerWidthWithAddedBorder_px = (
            musicSystemWidthRightBorderAbsolutePosition_px +
            sheetAbsolutePosition_px);

            let width_px = sheetContainerWidthWithAddedBorder_px;
            width_px_str = `${width_px}`
        }
        else {
            width_px_str = superlarge_width_px_str;
        }

        // HACK to make the scrollbar fit into the screen
        let new_height_px = 600;

        $('#osmd-container')[0].style.width = `${width_px_str}px`;
        $('#osmd-container svg')[0].setAttribute('width', `${width_px_str}`);

        $('#osmd-container')[0].style.height = `${new_height_px}px`;
        $('#osmd-container svg')[0].setAttribute('height', `${new_height_px}`);

        const viewBox = $('#osmd-container svg')[0].getAttribute('viewBox');
        const [x_px, y_px, _, height_px] = viewBox.split(' ');
        $('#osmd-container svg')[0].setAttribute('viewBox',
            `${x_px} ${y_px} ${width_px_str} ${new_height_px}`);


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

            let granularitySelect : HTMLSelectElement = <HTMLSelectElement>document.getElementById('select-granularity').children[0];
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

            if (!this.isLeadsheet && divClass === 'quarter-note') {  // FIXME hardcoded quarter-note duration
                // add fermata selection box
                this.fermatas.push(new FermataBox(commonDiv, this.sequenceDuration()));
            };

            if (this.isLeadsheet && divClass == 'half-note') {
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

    public drawTimestampBoxes(onclickFactory=undefined): void{
        // FIXME this assumes a time signature of 4/4
        let measureList = this.graphicalMusicSheet.MeasureList;
        const numMeasures: number = measureList.length;
        const numberOfStaves = measureList[0].length;

        function makeTimestamps(timeTuples: [number, number][]): Fraction[]{
            return timeTuples.map(([num, den]) => new Fraction(num, den))
        }

        const timestampsQuarter: Fraction[] = makeTimestamps([[0, 4], [1, 4],
            [2, 4], [3, 4], [4, 4]])
        const timestampsHalf: Fraction[] = makeTimestamps([[0, 2], [1, 2], [2, 2]])
        const timestampsWhole: Fraction[] = makeTimestamps([[0, 1], [1, 1]])

        const timestampsAndNames: [Fraction[], string][] = [
            [timestampsQuarter, "quarter-note"],
            [timestampsHalf, "half-note"],
            [timestampsWhole, "whole-note"]]

        for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++){
            let measure: GraphicalMeasure = <GraphicalMeasure>measureList[measureIndex][0]
            let beginInstructionsWidth: number = measure.beginInstructionsWidth

            let sourceMeasure: SourceMeasure = measure.parentSourceMeasure;
            let absoluteTimestamp: Fraction = sourceMeasure.AbsoluteTimestamp;
            let musicSystem = measure.parentMusicSystem;
            let systemTop = musicSystem.PositionAndShape.AbsolutePosition.y;
            let systemHeight = musicSystem.PositionAndShape.Size.height;

            // cf. sizing the Cursor in OpenSheetMusicDisplay/Cursor.ts
            let y = musicSystem.PositionAndShape.AbsolutePosition.y + musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y;
            const endY: number = musicSystem.PositionAndShape.AbsolutePosition.y +
              musicSystem.StaffLines[musicSystem.StaffLines.length - 1].PositionAndShape.RelativePosition.y + 4.0;
            let height = endY - y;

            for (const [timestampList, granularityName] of timestampsAndNames) {
                for (var timestampIndex=0; timestampIndex < timestampList.length-1;
                    timestampIndex++) {
                        let leftTimestamp = Fraction.plus(absoluteTimestamp,
                            timestampList[timestampIndex])
                        let rightTimestamp = Fraction.plus(absoluteTimestamp,
                            timestampList[timestampIndex+1])

                        let xLeft = this.graphicalMusicSheet
                            .calculateXPositionFromTimestamp(leftTimestamp)[0]

                        let xRight : number
                        if (timestampIndex < timestampList.length-2) {
                            // x-coordinates for the bounding box
                            xRight = this.graphicalMusicSheet
                                .calculateXPositionFromTimestamp(rightTimestamp)[0]
                            }
                        else {
                            // reached last segment of the measure
                            // set xRight as the x-position of the next measure bar
                            xRight = (measure.PositionAndShape.AbsolutePosition.x +
                                measure.PositionAndShape.Size.width) + 1
                        }

                        if (beginInstructionsWidth>1) {
                            if (beginInstructionsWidth > 5) {
                                xLeft -= 1  // HACK hardcoded
                                xRight -= 1
                            }
                            else {
                                xLeft -= 2
                                xRight -= 2
                            }
                        }
                        let width = xRight - xLeft;
                        let onclick = (event) => {};
                        if (onclickFactory) {onclick = onclickFactory(leftTimestamp, rightTimestamp)}

                        let timediv = this.createTimeDiv(
                            xLeft, y, width, height,
                            granularityName,
                            `${granularityName}-${measureIndex}-${timestampIndex}`,
                            onclick,
                            [leftTimestamp, rightTimestamp])
                    }

            }
            let duration = sourceMeasure.Duration
        }
    }

    public get boundingBoxes() {
        this.computeBoundingBoxes();
        return this._boundingBoxes;
    }

}

function cycleGranularity(increase: boolean) {
    let granularitySelect = $('#select-granularity > select')
    // if (granularitySelect.length > 0) {
    let granularitySelectElem = <HTMLSelectElement>granularitySelect[0]
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
