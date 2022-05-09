import { Inpainter } from './inpainter/inpainter'
import { NotonoData } from './spectrogram/spectrogramInpainter'
import { SheetData, SheetInpainter } from './sheet/sheetInpainter'

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
  radius: number | Radius
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
  ctx.moveTo(x + radius.tl, y)
  ctx.lineTo(x + width - radius.tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr)
  ctx.lineTo(x + width, y + height - radius.br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height)
  ctx.lineTo(x + radius.bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl)
  ctx.lineTo(x, y + radius.tl)
  ctx.quadraticCurveTo(x, y, x + radius.tl, y)
  ctx.closePath()
}

export type filename = {
  name: string
  extension: string
}

export abstract class DownloadButton<
  DataT = unknown,
  InpainterT extends Inpainter<DataT> = Inpainter<DataT>
> {
  protected readonly inpainter: InpainterT

  protected abstract onInpainterChange(data: DataT): void

  protected readonly parent: HTMLElement
  readonly container: HTMLElement
  readonly downloadElement: HTMLAnchorElement
  protected readonly interface: HTMLElement
  protected readonly iconElement: HTMLElement
  protected readonly dragImage: HTMLImageElement

  protected mainIconSize = 'fa-3x'

  constructor(
    inpainter: InpainterT,
    container: HTMLElement,
    defaultFilename: filename
  ) {
    this.inpainter = inpainter

    this.container = container

    this.interface = document.createElement('div')
    this.interface.id = 'download-button-interface'
    this.interface.classList.add('control-item')
    this.interface.setAttribute('draggable', 'true')
    this.container.appendChild(this.interface)

    // create invisible anchor element to handle download logic
    this.downloadElement = document.createElement('a')
    this.downloadElement.id = 'download-button'
    this.downloadElement.setAttribute('draggable', 'true')
    this.interface.appendChild(this.downloadElement)

    this.defaultFilename = defaultFilename

    this.iconElement = document.createElement('i')
    this.iconElement.id = 'download-button-icon'
    this.iconElement.classList.add('fa-solid')
    this.iconElement.classList.add('fa-download')
    this.iconElement.classList.add(this.mainIconSize)
    this.downloadElement.appendChild(this.iconElement)

    this.resizeCanvas = document.createElement('canvas')
    this.resizeCanvas.id = 'drag-n-drop-thumbnail-image-resizer'
    this.resizeCanvas.hidden = true
    this.interface.appendChild(this.resizeCanvas)

    this.dragImage = new Image()

    if (VITE_COMPILE_ELECTRON) {
      // add support for native Drag and Drop
      // FIXME(@tbazin, 2021/11/10): Fix DownloadButton drag-out for MIDI
      const saveBlob = async (
        blob: Blob,
        fileName: string,
        appDir: 'temp' | 'documents' = 'temp'
      ): Promise<string> => {
        {
          const reader = new FileReader()
          const storagePath = <string>(
            await window.ipcRendererInterface.getPath(fileName, appDir)
          )
          reader.onload = async function () {
            if (reader.readyState == 2) {
              if (reader.result == null) {
                throw new EvalError('Unexpected null reader')
              }
              const buffer = Buffer.from(reader.result)
              await window.ipcRendererInterface.saveFile(storagePath, buffer)
            }
            reader.readAsArrayBuffer(blob)
          }
          return storagePath
        }
      }

      this.container.addEventListener('dragstart', (event) => {
        event.preventDefault()
        const soundStoragePathPromise = saveBlob(
          this.content,
          this.makeFilenameWithTimestamp(),
          'documents'
        )
        const imageStoragePathPromise = saveBlob(
          this.imageContent,
          'spectrogram.png',
          'temp'
        )
        void Promise.all([
          soundStoragePathPromise,
          imageStoragePathPromise,
        ]).then(([soundPath, imagePath]) => {
          window.ipcRendererInterface.startDrag(soundPath, imagePath)
        })
      })
    } else {
      this.interface.addEventListener('dragstart', (event) => {
        // event.preventDefault()
        const dragData = `audio/x-wav:${this.filename}:${this.targetURL}`
        event.dataTransfer.setData('DownloadURL', dragData)
        const height = 150
        event.dataTransfer.setDragImage(this.dragImage, 0, height)
      })
    }

    inpainter.on('change', (data: DataT) => this.onInpainterChange(data))
  }

  makeFilenameWithTimestamp(baseName?: string, extension?: string): string {
    baseName = baseName != null ? baseName : this.defaultFilename.name

    extension = extension != null ? extension : this.defaultFilename.extension
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
        const cropWidth = newWidth / 2
        const cropHeight = newHeight / 2
        const centerX = 0
        const centerY = cropHeight

        context.filter = 'blur(2px)'
        roundRect(context, centerX + 2, centerY - 2, cropWidth, cropHeight, 20)

        context.filter = 'none'
        context.clip()
        context.filter =
          'invert(1) sepia(1) hue-rotate(-17.8deg) brightness(0.7) contrast(1.5) blur(0.5px);'
        context.filter =
          ' blur(0.5px) contrast(1.5) brightness(0.7) hue-rotate(-17.8deg) sepia(1) invert(1);'
        context.drawImage(image, 2, -2, newWidth, newHeight)

        this.resizeCanvas.toBlob((blob) => {
          image.remove()
          resolve(blob)
        }, file.type)
      }
      image.src = URL.createObjectURL(file)
      image.onerror = reject
    })
  }

  protected resizeCanvas: HTMLCanvasElement

  protected content: Blob

  protected _imageContent: Blob
  get imageContent(): Blob {
    return this._imageContent
  }
  set imageContent(imageBlob: Blob) {
    void this.resizeImage(imageBlob, 150, 150).then((blob) => {
      this._imageContent = blob

      URL.revokeObjectURL(this.dragImage.src)
      const blobUrl = URL.createObjectURL(this.imageContent)
      this.dragImage.src = blobUrl
    })
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
}

export class NotonoDownloadButton extends DownloadButton<NotonoData> {
  protected onInpainterChange(data: NotonoData): void {
    this.imageContent = data.spectrogramImage
    this.content = data.audio
    this.targetURL = URL.createObjectURL(data.audio)
  }
}
export class SheetDownloadButton extends DownloadButton<
  SheetData,
  SheetInpainter
> {
  protected onInpainterChange(data: SheetData): void {
    const sheetBlob = new Blob([this.inpainter.currentXML_string], {
      type: 'text/xml',
    })
    this.content = sheetBlob
    this.targetURL = URL.createObjectURL(sheetBlob)
  }
}
