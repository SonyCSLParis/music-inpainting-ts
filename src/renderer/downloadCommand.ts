import { throws, AssertionError } from "assert";
import { app } from "electron";
import path, { parse } from 'path';

declare var COMPILE_ELECTRON: boolean;

class Radius {
    tl: number;
    tr: number;
    br: number;
    bl: number;

    constructor(tl: number=0, tr: number=0, br: number=0, bl: number=0) {
        this.tl = tl
        this.tr = tr
        this.br = br
        this.bl = bl
    }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number | Radius) {
    if (typeof radius === "undefined") {
        radius = 5;
    }
    if (typeof radius === "number") {
        radius = new Radius(radius, radius, radius, radius);
    } else {
        var defaultRadius = new Radius();
        for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

export type filename = {
    name: string,
    extension: string
}

export class DownloadButton {
    protected readonly parent: HTMLElement;
    readonly container: HTMLElement;
    readonly downloadElem: HTMLAnchorElement;
    protected readonly interface;  // Nexus.TextButton;
    protected readonly iconElem;  // Nexus.TextButton;

    protected mainIconSize: string = 'fa-3x';

    constructor(container: HTMLElement, defaultFilename: filename,
            isAdvancedControl: boolean = false) {
        this.container = container;

        this.interface = document.createElement('control-item');
        this.interface.id = 'download-button-interface';
        this.container.appendChild(this.interface);

        // create invisible anchor element to handle download logic
        this.downloadElem = document.createElement('a');
        this.downloadElem.id = 'download-button';
        this.downloadElem.setAttribute('draggable', 'true');
        this.interface.appendChild(this.downloadElem);

        this.defaultFilename = defaultFilename;

        this.iconElem = document.createElement('i');
        this.iconElem.id = 'download-button-icon';
        this.iconElem.classList.add('fas');
        this.iconElem.classList.add('fa-download');
        this.iconElem.classList.add(this.mainIconSize);
        this.downloadElem.appendChild(this.iconElem);

        this.resizeCanvas = document.createElement('canvas');
        this.resizeCanvas.id = 'drag-n-drop-thumbnail-image-resizer';
        this.resizeCanvas.hidden = true;
        this.interface.appendChild(this.resizeCanvas);

        if ( COMPILE_ELECTRON ) {
            // add support for native Drag and Drop
            const ipcRenderer = require('electron').ipcRenderer;

            function saveBlob(blob, fileName, appDir: 'temp' | 'documents' = 'temp'): Promise<string> {
                return new Promise<string>((resolve, _) => {
                    let reader = new FileReader()
                    const storagePathPromise = ipcRenderer.invoke('get-path', fileName, appDir);
                    storagePathPromise.then((pathName) => {
                        reader.onload = function() {
                            if (reader.readyState == 2) {
                                var buffer = Buffer.from(reader.result)
                                ipcRenderer.invoke('save-file', pathName, buffer).then(() => {
                                    resolve(pathName)
                                });
                            }
                        }
                        reader.readAsArrayBuffer(blob)
                    })
                })
            }

            this.container.addEventListener('dragstart', (event) => {
                event.preventDefault();
                const soundStoragePathPromise = saveBlob(this.content, this.makeFilenameWithTimestamp(), 'documents');
                const imageStoragePathPromise = saveBlob(this.imageContent, "spectrogram.png", 'temp');
                Promise.all([soundStoragePathPromise, imageStoragePathPromise]).then(([soundPath, imagePath]) => {
                    ipcRenderer.send('ondragstart', soundPath, imagePath)
                });
            })
        }
    }

    makeFilenameWithTimestamp(baseName: string = null, extension: string = null): string {
        baseName = baseName || this.defaultFilename.name;

        extension = extension || this.defaultFilename.extension;
        const dotFreeExtension = extension.replace(/^\./, '');

        const timestamp: string = new Date().toISOString().replace(/:/g, '_').replace(/\..+/, '')
        return `${baseName}-${timestamp}.${dotFreeExtension}`
    }

    protected resizeImage(file: Blob, maxWidth: number, maxHeight: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            let image = new Image();
            image.src = URL.createObjectURL(file);
            image.onload = () => {
                URL.revokeObjectURL(image.src);
                let width = image.width;
                let height = image.height;

                if (width <= maxWidth && height <= maxHeight) {
                    resolve(file);
                }

                let newWidth: number;
                let newHeight: number;

                if (width > height) {
                    newHeight = height * (maxWidth / width);
                    newWidth = maxWidth;
                } else {
                    newWidth = width * (maxHeight / height);
                    newHeight = maxHeight;
                }

                this.resizeCanvas.width = newWidth;
                this.resizeCanvas.height = newHeight;

                let context = this.resizeCanvas.getContext('2d');
                let cropWidth = newWidth / 2;
                let cropHeight = newHeight / 2;
                var centerX = 0;
                var centerY = cropHeight;

                context.filter = 'blur(2px)'
                roundRect(context, centerX+2, centerY-2, cropWidth, cropHeight, 20);

                // context.beginPath();
                // context.ellipse(centerX, centerY, ellipseWidth, ellipseHeight, 0, 0, 2 * Math.PI);

                context.fillStyle = "purple";
                context.fill();
                // context.closePath();
                context.filter = 'none'
                context.clip();
                context.drawImage(image, 2, -2, newWidth, newHeight);

                this.resizeCanvas.toBlob((blob) => {
                        image.remove();
                        resolve(blob);
                    },
                    file.type);
            };
            image.onerror = reject;
        });
    }

    protected resizeCanvas: HTMLCanvasElement;

    set targetURL(downloadURL: string) {
        this.downloadElem.href = downloadURL;
    }

    content: Blob;

    protected _imageContent: Blob;
    get imageContent(): Blob {
        return this._imageContent
    };
    set imageContent(imageBlob) {
        this.resizeImage(imageBlob, 150, 150).then((blob) => {
            this._imageContent = blob;
        })
    }

    get targetURL(): string {
        return this.downloadElem.href;
    }

    readonly defaultFilename: filename;

    get filename(): string {
        return this.downloadElem.download;
    }

    set filename(newFilename: string) {
        this.downloadElem.setAttribute('download', this.makeFilenameWithTimestamp(newFilename));
    }

    revokeBlobURL(): void {
        // clean-up previous blob URL
        if ( this.targetURL != '' ) {
            URL.revokeObjectURL(this.targetURL);
            this.targetURL = '';
        };
    }
}
