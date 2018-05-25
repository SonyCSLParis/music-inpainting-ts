import { OpenSheetMusicDisplay, VexFlowMeasure } from "opensheetmusicdisplay";


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

    }

    public get boundingBoxes() {
        this.computeBoundingBoxes();
        return this._boundingBoxes;
    }

}
