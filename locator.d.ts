import { OSMD } from "opensheetmusicdisplay";
export declare class eOSMD extends OSMD {
    constructor(container: string | HTMLElement, autoResize?: boolean);
    _boundingBoxes: [number, number, number, number][];
    private computeBoundingBoxes();
    readonly boundingBoxes: [number, number, number, number][];
}
