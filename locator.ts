import { OpenSheetMusicDisplay, VexFlowMeasure,
        Fraction, StaffMeasure, SourceMeasure } from "opensheetmusicdisplay";
import * as $ from 'jquery';
import './styles/overlays.scss';
import 'nipplejs'

export class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, autoResize: boolean = false) {
        super(container, autoResize);
        this._boundingBoxes = [];
    }
    public _boundingBoxes: [number, number, number, number][];

    private computeBoundingBoxes(): void {
        // TODO find measureIndex and staffIndex
        let measureList = this.graphicalMusicSheet.MeasureList;
        let numberOfStaves = measureList[0].length;
        let staffIndex = 0;
        let boundingBoxes = [];
        for (let measureIndex in measureList) {

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

    // compute a position accounting for <this>'s zoom level
    private computePositionZoom(value: number, shift=1): number {
        return ((value - shift) * 10.0 * this.zoom)
    }

    /*
    Create an overlay box with given shape and assign it the given divClass
    */
    private createTimeDiv(x, y, width, height, divClass: string, divId: string,
        onclick: (PointerEvent) => void): HTMLElement {
        let div = (document.getElementById(divId) ||
            document.createElement("div"))

        div.style.top = this.computePositionZoom(y, 0) + 'px';
        div.style.height = this.computePositionZoom(height, 0) + 'px';
        div.style.left = this.computePositionZoom(x, 1) + 'px';
        div.style.width = this.computePositionZoom(width) + 'px';

        if (div.id !== divId) {
            // the div was created in this call, it has no ID set yet
            div.id = divId;
            div.classList.add('notebox');
            div.classList.add('available');
            div.classList.add(divClass);
            let granularitySelect : HTMLSelectElement = <HTMLSelectElement>document.getElementById('select-granularity')
            if (granularitySelect.value == divClass){
                div.classList.add('active')
            }

            // // insert NipppleJS manager
            // var options = {
            //     zone: div,
            //     color: "blue"
            // };
            // var manager = nipplejs.create(options);
            // var joystick_data = {};
            // var last_click = [];

            div.addEventListener('click', onclick);

            // add div to the rendering backend's <HTMLElement> for positioning
            let inner = this.renderingBackend.getInnerElement();
            inner.appendChild(div);
        }

        return div;
    };

    public drawTimestampBoxes(onclickFactory=undefined): void{
        // FIXME this assumes a time signature of 4/4
        let measureList = this.graphicalMusicSheet.MeasureList;
        let numberOfStaves = measureList[0].length;

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

        for (let measureIndex in measureList){
            let measure: StaffMeasure = <StaffMeasure>measureList[measureIndex][0]
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

                        let width = xRight - xLeft;
                        let onclick = (event) => {};
                        if (onclickFactory) {onclick = onclickFactory(leftTimestamp, rightTimestamp)}
                        let timediv = this.createTimeDiv(xLeft, y, width, height,
                            granularityName,
                            `${granularityName}-${measureIndex}-${timestampIndex}`,
                            onclick)

                        // FIXME constrains granularity
                        let quarterNotes = []
                        let quarterNoteStart = Math.floor(leftTimestamp.RealValue * 4)
                        let quarterNoteEnd = Math.floor(rightTimestamp.RealValue*4)
                        for (let i=quarterNoteStart; i<quarterNoteEnd; i++) {
                            quarterNotes.push(i)
                        }
                        timediv.setAttribute('containedQuarterNotes', quarterNotes.toString().replace(/,/g, ' '))
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
