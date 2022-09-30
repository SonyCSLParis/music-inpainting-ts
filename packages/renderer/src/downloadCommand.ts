import { Inpainter } from './inpainter/inpainter'
import { NotonoData } from './spectrogram/spectrogramInpainter'
import { SheetData, SheetInpainter } from './sheet/sheetInpainter'
import { InpainterGraphicalView } from './inpainter/inpainterGraphicalView'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import { PiaInpainter, PianoRollData } from './piano_roll/pianoRollInpainter'
import { PianoRollInpainterGraphicalView } from './piano_roll/pianoRollInpainterGraphicalView'

const VITE_COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

class Radius {
  tl: number
  tr: number
  br: number
  bl: number

  constructor(tl = 0, tr = 0, br = 0, bl = 0) {
    this.tl = tl
    this.tr = tr
    this.br = br
    this.bl = bl
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | Radius,
  fillStyle?: string,
  strokeStyle?: string
) {
  if (typeof radius === 'undefined') {
    radius = 5
  }
  if (typeof radius === 'number') {
    radius = new Radius(radius, radius, radius, radius)
  } else {
    const defaultRadius = new Radius()
    for (const side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side]
    }
  }
  ctx.beginPath()
  ctx.lineWidth = 0.3
  ctx.moveTo(x + radius.tl, y)
  ctx.lineTo(x + width - radius.tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr)
  ctx.lineTo(x + width, y + height - radius.br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height)
  ctx.lineTo(x + radius.bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl)
  ctx.lineTo(x, y + radius.tl)
  ctx.quadraticCurveTo(x, y, x + radius.tl, y)
  if (fillStyle != undefined) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (strokeStyle != undefined) {
    ctx.strokeStyle = strokeStyle
    ctx.stroke()
  }
  ctx.closePath()
}

export type filename = {
  name: string
  extension: string
}

export abstract class DownloadButton<
  DataT = unknown,
  InpainterT extends Inpainter<DataT> = Inpainter<DataT>,
  InpainterGraphicalViewT extends InpainterGraphicalView<DataT> = InpainterGraphicalView<DataT>
> {
  protected readonly inpainter: InpainterT
  protected readonly inpainterGraphicalView: InpainterGraphicalViewT

  protected abstract _refreshCallback: (data: DataT) => Promise<void>
  protected readonly refreshCallback: (data: DataT) => Promise<void> = async (
    data: DataT
  ) => {
    this._refreshCallback(data)
  }

  protected registerUpdateCallback(): void {
    this.inpainter.on('change', this.refreshCallback)
  }
  protected removeUpdateCallback(): void {
    this.inpainter.removeListener('change', this.refreshCallback)
  }

  readonly container: HTMLElement
  readonly interfaceContainer: HTMLElement
  readonly downloadElement: HTMLAnchorElement
  protected readonly interface: HTMLElement
  protected readonly iconElement: HTMLElement
  protected readonly dragImage: HTMLImageElement

  protected mainIconSize = 'fa-3x'

  constructor(
    inpainter: InpainterT,
    inpainterGraphicalView: InpainterGraphicalViewT,
    container: HTMLElement,
    defaultFilename: filename
  ) {
    this.inpainter = inpainter
    this.inpainterGraphicalView = inpainterGraphicalView

    this.container = container
    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.classList.add('download-button-container')
    this.container.prepend(this.interfaceContainer)

    this.interface = document.createElement('div')
    this.interface.classList.add('download-button-interface')
    this.interface.classList.add('control-item')
    this.interface.setAttribute('draggable', 'true')
    this.interfaceContainer.appendChild(this.interface)

    // create invisible anchor element to handle download logic
    this.downloadElement = document.createElement('a')
    this.downloadElement.setAttribute('draggable', 'true')
    this.interface.appendChild(this.downloadElement)

    this.defaultFilename = defaultFilename

    this.iconElement = document.createElement('i')
    this.iconElement.classList.add('fa-solid')
    this.iconElement.classList.add('fa-download')
    this.iconElement.classList.add(this.mainIconSize)
    this.interface.appendChild(this.iconElement)

    this.resizeCanvas = document.createElement('canvas')
    this.resizeCanvas.id = 'drag-n-drop-thumbnail-image-resizer'
    this.resizeCanvas.hidden = true
    this.interfaceContainer.appendChild(this.resizeCanvas)

    this.dragImage = new Image()

    if (VITE_COMPILE_ELECTRON) {
      // add support for native Drag and Drop
      this.interfaceContainer.addEventListener(
        'dragstart',
        this.onDragStartElectron
      )
    } else {
      this.interfaceContainer.addEventListener('dragstart', (event) => {
        if (event.dataTransfer != null) {
          const dragData = `audio/x-wav:${this.filename}:${this.targetURL}`
          event.dataTransfer.setData('DownloadURL', dragData)
          const height = 150
          event.dataTransfer.setDragImage(this.dragImage, 0, height)
        }
      })
    }
    this.registerUpdateCallback()
  }

  protected async saveBlobElectron(
    blob: Blob,
    fileName: string,
    appDir: 'temp' | 'documents' = 'temp'
  ): Promise<string> {
    if (VITE_COMPILE_ELECTRON) {
      const Buffer = (await import('buffer')).Buffer
      const storagePath = await window.ipcRendererInterface.getPath(
        fileName,
        appDir
      )
      const buffer = Buffer.from(await blob.arrayBuffer())
      await window.ipcRendererInterface.saveFile(storagePath, buffer)
      return storagePath
    } else {
      throw Error('Not in an electron environment')
    }
  }

  onDragStartElectron = (event: DragEvent) => {
    event.preventDefault()
    if (this._content != undefined && this.imageContent != undefined) {
      const dataStoragePathPromise = this.saveBlobElectron(
        this._content,
        this.makeFilenameWithTimestamp(),
        'temp'
      )
      const dragThumbnailImagePathPromise = this.saveBlobElectron(
        this.imageContent,
        'spectrogram.png',
        'temp'
      )
      void Promise.all([
        dataStoragePathPromise,
        dragThumbnailImagePathPromise,
      ]).then(([soundPath, imagePath]) => {
        window.ipcRendererInterface.startDrag(soundPath, imagePath)
      })
    }
  }

  makeFilenameWithTimestamp(baseName?: string, extension?: string): string {
    baseName = baseName ?? this.defaultFilename.name
    extension = extension ?? this.defaultFilename.extension
    const dotFreeExtension = extension.replace(/^\./, '')
    const timestamp: string = new Date()
      .toISOString()
      .replace(/:/g, '_')
      .replace(/\..+/, '')

    return `${baseName}-${timestamp}.${dotFreeExtension}`
  }

  protected resizeImage(
    file: Blob,
    maxWidth: number,
    maxHeight: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        URL.revokeObjectURL(image.src)
        const width = image.width
        const height = image.height

        if (width <= maxWidth && height <= maxHeight) {
          resolve(file)
        }

        let newWidth: number
        let newHeight: number

        if (width > height) {
          newHeight = height * (maxWidth / width)
          newWidth = maxWidth
        } else {
          newWidth = width * (maxHeight / height)
          newHeight = maxHeight
        }

        this.resizeCanvas.width = newWidth
        this.resizeCanvas.height = newHeight

        const context = this.resizeCanvas.getContext('2d')
        if (context == null) {
          reject()
        } else {
          const cropWidth = newWidth / 2
          const cropHeight = newHeight / 2
          const centerX = 0
          const centerY = cropHeight

          context.filter = 'blur(0.2px)'
          roundRect(
            context,
            centerX + 2,
            centerY - 2,
            cropWidth,
            cropHeight,
            20,
            'black',
            '#ff6e0099'
          )

          context.filter = 'none'
          context.clip()
          context.filter =
            'invert(1) sepia(1) hue-rotate(-17.8deg) brightness(0.7) contrast(1.5) blur(0.5px)'
          // context.filter =
          //   ' blur(0.5px) contrast(1.5) brightness(0.7) hue-rotate(-17.8deg) sepia(1) invert(1);'
          // context.filter = 'brightness(10)'
          context.drawImage(image, 2, -2, newWidth, newHeight)

          this.resizeCanvas.toBlob((blob) => {
            if (blob == null) {
              reject()
            } else {
              image.remove()
              resolve(blob)
            }
          }, file.type)
        }
      }
      image.src = URL.createObjectURL(file)
      image.onerror = reject
    })
  }

  protected resizeCanvas: HTMLCanvasElement

  protected _content?: Blob
  protected get content(): Blob | undefined {
    return this._content
  }
  protected set content(content: Blob | undefined) {
    URL.revokeObjectURL(this.targetURL)
    this._content = content
    if (content != undefined) {
      this.targetURL = URL.createObjectURL(content)
    }
  }

  protected _imageContent?: Blob
  get imageContent(): Blob | undefined {
    return this._imageContent
  }
  set imageContent(imageBlob: Blob | undefined) {
    if (imageBlob != undefined) {
      void this.resizeImage(imageBlob, 150, 150).then((blob) => {
        this._imageContent = blob

        URL.revokeObjectURL(this.dragImage.src)
        const blobUrl = URL.createObjectURL(<Blob>this.imageContent)
        this.dragImage.src = blobUrl
      })
    }
  }

  get targetURL(): string {
    return this.downloadElement.href
  }
  set targetURL(downloadURL: string) {
    this.downloadElement.href = downloadURL
    this.updateFilename()
  }

  readonly defaultFilename: filename

  get filename(): string {
    return this.downloadElement.download
  }

  set filename(newFilename: string) {
    this.updateFilename(newFilename)
  }

  protected updateFilename(newFilename?: string): void {
    this.downloadElement.setAttribute(
      'download',
      this.makeFilenameWithTimestamp(newFilename)
    )
  }

  revokeBlobURL(): void {
    // clean-up previous blob URL
    if (this.targetURL != '') {
      URL.revokeObjectURL(this.targetURL)
      this.targetURL = ''
    }
  }

  dispose() {
    try {
      this.container.removeChild(this.interfaceContainer)
      URL.revokeObjectURL(this.targetURL)
    } catch (e) {}
  }
}

export class NotonoDownloadButton extends DownloadButton<NotonoData> {
  protected _refreshCallback = async () => {
    this.imageContent = this.inpainter.value.spectrogramImage
    this._content = this.inpainter.value.audio
    this.targetURL = URL.createObjectURL(this.inpainter.value.audio)
  }
}
export class SheetDownloadButton extends DownloadButton<
  SheetData,
  SheetInpainter,
  SheetInpainterGraphicalView
> {
  protected registerUpdateCallback(): void {
    // TODO(@tbazin, 2022/08/10): potentially `this`-unbound callback, check this
    this.inpainterGraphicalView.on('ready', this.refreshCallback)
  }
  protected removeUpdateCallback(): void {
    this.inpainterGraphicalView.removeListener('ready', this.refreshCallback)
  }

  protected _refreshCallback: () => Promise<void> = async () => {
    const sheetBlob = new Blob([this.inpainter.currentXML_string], {
      type: 'text/xml',
    })
    this._content = sheetBlob
    if (VITE_COMPILE_ELECTRON) {
      const sheetPNGBlob = await this.inpainterGraphicalView.getSheetAsPNG()
      if (sheetPNGBlob != null) {
        this.imageContent = sheetPNGBlob
      }
    }
    this.targetURL = URL.createObjectURL(sheetBlob)
  }
}
export class PianotoDownloadButton extends DownloadButton<
  PianoRollData,
  PiaInpainter,
  PianoRollInpainterGraphicalView
> {
  // protected registerUpdateCallback(): void {
  //   // HACK(@tbazin, 2022/08/10): listening to ready on inpainterGraphicalView
  //   // ensures that the
  //   // this.inpainterGraphicalView.on('ready', () => this.refreshCallback())
  //   this.inpainter.on('ch', () => this.refreshCallback())
  // }
  // protected removeUpdateCallback(): void {
  //   this.inpainterGraphicalView.removeListener('ready', () =>
  //     this.refreshCallback()
  //   )
  // }

  protected _refreshCallback = async (data: PianoRollData) => {
    if (data.partialUpdate || data.removeNotes) {
      return
    }
    if (VITE_COMPILE_ELECTRON) {
      const sheetPNGBlob = await this.inpainterGraphicalView.getSheetAsPNG()
      if (sheetPNGBlob != null) {
        this.imageContent = sheetPNGBlob
      }
    }
    const blob = new Blob([this.inpainter.value.midi.toArray()])
    this._content = blob
    this.targetURL = URL.createObjectURL(blob)
  }
}
