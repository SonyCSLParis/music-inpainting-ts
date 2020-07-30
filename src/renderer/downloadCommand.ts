import { throws, AssertionError } from "assert";

let Nexus: any = require('./nexusColored');

export class DownloadButton {
    protected readonly parent: HTMLElement;
    protected readonly container: HTMLElement;
    readonly downloadElem: HTMLAnchorElement;
    protected readonly interface;  // Nexus.TextButton;

    protected mainIconSize: string = 'fa-3x';

    constructor(parent: HTMLElement, configuration: {}, defaultFilename: string = '',
            isAdvancedControl: boolean = false) {
        this.parent = parent;

        this.container = document.createElement('control-item');
        this.container.id = 'download-button-container';
        this.container.classList.toggle('advanced', isAdvancedControl);
        this.parent.appendChild(this.container);

        // create invisible anchor element to handle download logic
        this.downloadElem = document.createElement('a');
        this.downloadElem.id = 'download-button';
        this.downloadElem.setAttribute('download', defaultFilename);
        this.downloadElem.setAttribute('visible', 'false');
        this.container.appendChild(this.downloadElem);

        this.interface = document.createElement('i');
        this.interface.id = 'download-button-icon';
        this.interface.classList.add('fas');
        this.interface.classList.add('fa-download');
        this.interface.classList.add(this.mainIconSize);
        this.downloadElem.appendChild(this.interface);
    }

    set targetURL(downloadURL: string) {
        this.downloadElem.href = downloadURL;
    }

    get targetURL(): string {
        return this.downloadElem.href;
    }

    set filename(newFilename: string) {
        this.downloadElem.setAttribute('download', newFilename);
    }

    revokeBlobURL(): void {
        // clean-up previous blob URL
        if ( this.targetURL != '' ) {
            URL.revokeObjectURL(this.targetURL);
            this.targetURL = '';
        };
    }
}
