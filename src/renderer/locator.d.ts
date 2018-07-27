import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { FermataBox } from './fermata';
import { ChordSelector } from './chord_selector';
import 'nipplejs';
import '../common/styles/overlays.scss';
export declare class eOSMD extends OpenSheetMusicDisplay {
    constructor(container: string | HTMLElement, autoResize?: boolean, leadsheet?: boolean);
    _boundingBoxes: [number, number, number, number][];
    leadsheet: boolean;
    private _chordSelectors;
    readonly chordSelectors: ChordSelector[];
    private _fermatas;
    readonly fermatas: FermataBox[];
    render(onclickFactory?: any): void;
    private computeBoundingBoxes;
    private computePositionZoom;
    private createTimeDiv;
    private sequenceDuration;
    private drawChordBox;
    drawTimestampBoxes(onclickFactory?: any): void;
    readonly boundingBoxes: [number, number, number, number][];
}
