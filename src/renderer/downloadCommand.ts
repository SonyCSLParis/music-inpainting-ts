import { throws, AssertionError } from "assert";

let Nexus: any = require('./nexusColored');

export class DownloadButton {
    protected readonly parent: HTMLElement;
    protected readonly container: HTMLElement;
    readonly downloadElem: HTMLAnchorElement;
    protected readonly interface;  // Nexus.TextButton;

    constructor(parent: HTMLElement, configuration: {}) {
        this.parent = parent;

        this.container = document.createElement('control-item');
        this.container.id = 'download-button-container'
        this.parent.appendChild(this.container);

        // create invisible anchor element to handle download logic
        this.downloadElem = document.createElement('a');
        this.downloadElem.id = 'download-button';
        this.downloadElem.setAttribute('download', '');
        this.downloadElem.setAttribute('visible', 'false');
        this.container.appendChild(this.downloadElem);

        let interface_text: string;
        if ( configuration['osmd'] ) {
            interface_text = 'Save MIDI' }
        else if ( configuration['spectrogram'] ) {
            interface_text = 'Save .wav'
        }
        else { throw EvalError("Unexpected configuration object") }
        this.interface = new Nexus.TextButton('#' + this.container.id, {
            'size': [150,50],
            'state': false,
            'text': interface_text
        });

        this.interface.on('change', (value: string) => {
            if ( value ) {
                // trigger download
                this.downloadElem.click();
                this.interface.flip(false);
            }
            else {};
        });
    }

    set targetURL(downloadURL: string) {
        this.downloadElem.href = downloadURL;
    }

    get targetURL(): string {
        return this.downloadElem.href;
    }

    revokeBlobURL(): void {
        // clean-up previous blob URL
        if ( this.targetURL != '' ) {
            URL.revokeObjectURL(this.targetURL);
            this.targetURL = '';
        };
    }
}
