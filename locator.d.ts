import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import './styles/overlays.scss';
import 'nipplejs';
export declare class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, autoResize?: boolean);
    _boundingBoxes: [number, number, number, number][];
    clickedDiv: any;
    private computeBoundingBoxes();
    private computePositionZoom(value, shift?);
    private createTimeDiv(x, y, width, height, divClass, divId, onclick);
    drawTimestampBoxes(onclickFactory?: any): void;
    readonly boundingBoxes: [number, number, number, number][];
}
