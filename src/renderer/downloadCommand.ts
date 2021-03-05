declare let COMPILE_ELECTRON: boolean

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

export class DownloadButton {
  protected readonly parent: HTMLElement
  readonly container: HTMLElement
  readonly downloadElement: HTMLAnchorElement
  protected readonly interface // Nexus.TextButton;
  protected readonly iconElement // Nexus.TextButton;

  protected mainIconSize = 'fa-3x'

  constructor(
    container: HTMLElement,
    defaultFilename: filename,
    isAdvancedControl = false
  ) {
    this.container = container

    this.interface = document.createElement('control-item')
    this.interface.id = 'download-button-interface'
    this.container.appendChild(this.interface)

    // create invisible anchor element to handle download logic
    this.downloadElement = document.createElement('a')
    this.downloadElement.id = 'download-button'
    this.downloadElement.setAttribute('draggable', 'true')
    this.interface.appendChild(this.downloadElement)

    this.defaultFilename = defaultFilename

    this.iconElement = document.createElement('i')
    this.iconElement.id = 'download-button-icon'
    this.iconElement.classList.add('fas')
    this.iconElement.classList.add('fa-download')
    this.iconElement.classList.add(this.mainIconSize)
    this.downloadElement.appendChild(this.iconElement)

    this.resizeCanvas = document.createElement('canvas')
    this.resizeCanvas.id = 'drag-n-drop-thumbnail-image-resizer'
    this.resizeCanvas.hidden = true
    this.interface.appendChild(this.resizeCanvas)

    if (COMPILE_ELECTRON) {
      // add support for native Drag and Drop
      const ipcRenderer = require('electron').ipcRenderer

      function saveBlob(
        blob: Blob,
        fileName: string,
        appDir: 'temp' | 'documents' = 'temp'
      ): Promise<string> {
        return new Promise<string>((resolve, _) => {
          const reader = new FileReader()
          const storagePathPromise = ipcRenderer.invoke(
            'get-path',
            fileName,
            appDir
          )
          storagePathPromise.then((pathName) => {
            reader.onload = function () {
              if (reader.readyState == 2) {
                const buffer = Buffer.from(reader.result)
                ipcRenderer.invoke('save-file', pathName, buffer).then(() => {
                  resolve(pathName)
                })
              }
            }
            reader.readAsArrayBuffer(blob)
          })
        })
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
          ipcRenderer.send('ondragstart', soundPath, imagePath)
        })
      })
    }
  }

  makeFilenameWithTimestamp(
    baseName: string = null,
    extension: string = null
  ): string {
    baseName = baseName || this.defaultFilename.name

    extension = extension || this.defaultFilename.extension
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
      image.src = URL.createObjectURL(file)
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

        // context.beginPath();
        // context.ellipse(centerX, centerY, ellipseWidth, ellipseHeight, 0, 0, 2 * Math.PI);

        context.fillStyle = 'purple'
        context.fill()
        // context.closePath();
        context.filter = 'none'
        context.clip()
        context.drawImage(image, 2, -2, newWidth, newHeight)

        this.resizeCanvas.toBlob((blob) => {
          image.remove()
          resolve(blob)
        }, file.type)
      }
      image.onerror = reject
    })
  }

  protected resizeCanvas: HTMLCanvasElement

  content: Blob

  protected _imageContent: Blob
  get imageContent(): Blob {
    return this._imageContent
  }
  set imageContent(imageBlob: Blob) {
    void this.resizeImage(imageBlob, 150, 150).then((blob) => {
      this._imageContent = blob
    })
  }

  get targetURL(): string {
    return this.downloadElement.href
  }

  set targetURL(downloadURL: string) {
    this.downloadElement.href = downloadURL
  }

  readonly defaultFilename: filename

  get filename(): string {
    return this.downloadElement.download
  }

  set filename(newFilename: string) {
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
