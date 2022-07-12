import { UndoManager } from 'typed-undo'
import { Unit as ToneUnit } from 'tone'

import { UndoableInpainter } from '../inpainter/inpainter'

export type Codemap = number[][]
export type InpaintingMask = boolean[][]
export type ConditioningMap = Map<string, (number | string)[][]>

export interface NotonoData<Layers extends string = never> {
  codemap: Record<Layers, Codemap>
  audio: Blob
  spectrogramImage: Blob
  conditioning: Record<Layers, ConditioningMap>
}

function formatConditioningMap(conditioning_map: ConditioningMap) {
  return {
    pitch: conditioning_map.get('pitch'),
    instrument_family_str: conditioning_map.get('instrument_family_str'),
  }
}

function parseConditioningMap(
  newConditioningMap: Record<string, (number | string)[][]>
): ConditioningMap {
  const conditioning_map: ConditioningMap = new Map<
    string,
    (number | string)[][]
  >()
  conditioning_map.set('pitch', newConditioningMap['pitch'])
  conditioning_map.set(
    'instrument_family_str',
    newConditioningMap['instrument_family_str']
  )
  return conditioning_map
}

export const enum VqvaeLayer {
  Top = 'top',
  Bottom = 'bottom',
}

export const enum NotonoTool {
  Inpaint = 'inpaint',
  Randomize = 'randomize',
  Eraser = 'erase',
}

export type LayerAndTool = { layer: VqvaeLayer; tool: NotonoTool }

export interface AudioVQVAELayerDimensions {
  frequencyRows: number
  timeColumns: number
  timeResolution: ToneUnit.Seconds
}

export class SpectrogramInpainter extends UndoableInpainter<
  NotonoData<VqvaeLayer>,
  'analyze-audio'
> {
  constructor(
    defaultApiAddress: URL,
    undoManager: UndoManager,
    // TODO(theis, 2021/08/26): retrieve this value from the API
    layerDimensions: Map<VqvaeLayer, AudioVQVAELayerDimensions>
  ) {
    super(defaultApiAddress, undoManager)
    this.layerDimensions = layerDimensions
  }

  readonly layerDimensions: Map<VqvaeLayer, AudioVQVAELayerDimensions>

  protected async apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string | null }
  ): Promise<NotonoData<VqvaeLayer>> {
    return this.loadAudioAndSpectrogram(httpMethod, href, timeout, requestBody)
  }

  protected async getAudioSampleFromDataset(
    queryParameters: string[],
    jsonData?: Record<string, any>,
    timeout?: number,
    inpaintingApiUrl?: URL
  ): Promise<Blob | null> {
    const generationUrl = new URL(
      'sample-from-dataset-audio' + this.formatQueryParameters(queryParameters),
      inpaintingApiUrl
    )
    const response = await this.fetch(
      generationUrl.href,
      {
        method: 'GET',
      },
      timeout,
      'get audio sample'
    )
    if (response != null) {
      return response.blob()
    } else {
      return null
    }
  }

  protected async getAudio(
    queryParameters: string[],
    top?: Codemap,
    bottom?: Codemap,
    timeout?: number,
    inpaintingApiUrl: URL = this.defaultApiAddress
  ): Promise<Blob | null> {
    const payload = {
      top_code: top != null ? top : this.value.codemap.top,
      bottom_code: bottom != null ? bottom : this.value.codemap.bottom,
    }
    const requestData = JSON.stringify(payload)

    const generationUrl = new URL('get-audio', inpaintingApiUrl)
    const response = await this.fetch(
      generationUrl.href + this.formatQueryParameters(queryParameters),
      {
        method: 'POST',
        body: requestData,
        // headers: {
        //   ContentType: 'application/json',
        // },
      },
      timeout,
      'convert codemaps to audio'
    )
    if (response != null) {
      return this.base64ResponseToBlob(response)
    } else {
      return null
    }
  }

  protected async base64DataToBlob(
    base64: string,
    contentType: string
  ): Promise<Blob> {
    return (await fetch(`data:${contentType};base64,${base64}`)).blob()
  }

  protected async base64ResponseToBlob(response: Response): Promise<Blob> {
    const base64 = await response.text()
    const contentType = response.headers.get('content-type')
    return (await fetch(`data:${contentType};base64,${base64}`)).blob()
  }

  protected async getSpectrogramImage(
    queryParameters: string[],
    top?: Codemap,
    bottom?: Codemap,
    timeout?: number,
    inpaintingApiUrl: URL = this.defaultApiAddress
  ): Promise<Blob | null> {
    const payload = {
      top_code: top != null ? top : this.value.codemap.top,
      bottom_code: bottom != null ? bottom : this.value.codemap.bottom,
    }
    const requestData = JSON.stringify(payload)

    const generationCommand = 'get-spectrogram-image'
    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    const response = await this.fetch(
      generationUrl.href + this.formatQueryParameters(queryParameters),
      {
        method: 'POST',
        body: requestData,
        // headers: {
        //   ContentType: 'application/json',
        // },
      },
      timeout,
      'convert codemaps to spectrogram image'
    )
    if (response != null) {
      return this.base64ResponseToBlob(response)
    } else {
      return null
    }
  }

  async sendAudio(
    audioBlob: Blob,
    queryParameters: string[],
    timeout: number = 30000,
    inpaintingApiUrl = this.defaultApiAddress
  ): Promise<this> {
    const audioForm = new FormData()
    audioForm.append('audio', audioBlob)
    const audioRequestBody = {
      data: audioForm,
      // should *not* set Content-Type header when sending FormData through the fetch API
      // https://stackoverflow.com/questions/36067767/#comment98412965_36082038
      dataType: null,
    }
    return this.apiRequestHelper(
      'POST',
      'analyze-audio',
      queryParameters,
      inpaintingApiUrl,
      false,
      timeout,
      audioRequestBody
    )
  }

  protected valueToJSONData(
    value: NotonoData<VqvaeLayer> = this.value
  ): Record<string, any> {
    return {
      top_code: value.codemap.top,
      bottom_code: value.codemap.bottom,
      top_conditioning: formatConditioningMap(value.conditioning.top),
      bottom_conditioning: formatConditioningMap(value.conditioning.bottom),
    }
  }
  protected get valueAsJSONData(): Record<string, any> {
    return this.valueToJSONData(this.value)
  }

  protected async loadAudioAndSpectrogram(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string | null }
  ): Promise<NotonoData<VqvaeLayer>> {
    let newCodes_top: Codemap
    let newCodes_bottom: Codemap
    let newConditioning_top: ConditioningMap
    let newConditioning_bottom: ConditioningMap
    let audio: Blob
    let spectrogramImage: Blob

    try {
      const response = await this.fetch(
        href,
        {
          method: httpMethod,
          body: requestBody != null ? requestBody.data : null,
          headers:
            requestBody != null && requestBody.dataType != null
              ? {
                  'Content-Type': requestBody.dataType,
                }
              : {},
        },
        timeout,
        'perform inpainting operation'
      )
      // TODO(@tbazin, 2022/04/22): typed API requests
      const jsonContent = <
        {
          top_code: Codemap
          bottom_code: Codemap
          audio: {
            data: string
            'content-type': string
          }
          image: {
            data: string
            'content-type': string
          }
        }
      >await response.json()

      newCodes_top = jsonContent['top_code']
      newCodes_bottom = jsonContent['bottom_code']
      newConditioning_top = parseConditioningMap(
        jsonContent['top_conditioning']
      )
      newConditioning_bottom = parseConditioningMap(
        jsonContent['bottom_conditioning']
      )

      audio = await this.base64DataToBlob(
        jsonContent['audio']['data'],
        jsonContent['audio']['content-type']
      )
      spectrogramImage = await this.base64DataToBlob(
        jsonContent['image']['data'],
        jsonContent['image']['content-type']
      )
    } catch (e) {
      console.log(e)
      throw e
    }

    return {
      audio: audio,
      spectrogramImage: spectrogramImage,
      codemap: {
        top: newCodes_top,
        bottom: newCodes_bottom,
      },
      conditioning: {
        top: newConditioning_top,
        bottom: newConditioning_bottom,
      },
    }
  }

  // sample(
  //   inpaintingApiUrl = this.defaultApiAddress,
  //   timeout = 10000
  // ): Promise<this> {
  //   return super.sample(inpaintingApiUrl, timeout).then(
  //     () => {
  //       this.enableChanges()
  //       return this
  //     },
  //     (rejectionReason) => {
  //       // FIXME(theis, 2021_04_21): sampling can fail in the current setting if either:
  //       // - the Inpainting API is not reachable, in which case it might fail instantly,
  //       //   and would lead to a very high number of requests in a very short time,
  //       // - the sampling procedure didn't manage to find a suitable sample in the database
  //       //   in a reasonable time
  //       // We should distinguish those two cases and only re-run a sampling if the API is
  //       // accessible
  //       console.log(rejectionReason)
  //       if (rejectionReason.statusText == 'timeout') {
  //         log.error(
  //           'Failed to sample appropriate sound in required time, retrying with new parameters'
  //         )
  //         this.instrumentConstraintSelect.shuffle()
  //         return this.sample(inpaintingApiUrl, timeout)
  //       } else {
  //         throw rejectionReason
  //       }
  //     }
  //   )
  // }

  // TODO(@tbazin, 2022/01/06): clean this up
  async sampleFromDataset(
    queryParameters: string[],
    jsonData?: Record<string, any>,
    timeout?: number,
    inpaintingApiUrl?: URL
  ): Promise<this> {
    const audioBlob = await this.getAudioSampleFromDataset(
      queryParameters,
      jsonData,
      timeout,
      inpaintingApiUrl
    )
    if (audioBlob != null) {
      await this.sendAudio(
        audioBlob,
        queryParameters,
        timeout,
        inpaintingApiUrl
      )
    }
    return this
  }

  protected async setCodemap(
    codemaps: Record<VqvaeLayer, Codemap>,
    conditioning: Record<VqvaeLayer, ConditioningMap>,
    queryParameters: string[] = [],
    silent: boolean = true
  ): Promise<NotonoData<VqvaeLayer> | null> {
    const audioPromise = this.getAudio(
      queryParameters,
      codemaps.top,
      codemaps.bottom
    )
    const imagePromise = this.getSpectrogramImage(
      queryParameters,
      codemaps.top,
      codemaps.bottom
    )
    const [audio, image] = await Promise.all([audioPromise, imagePromise])
    if (audio == null || image == null) {
      return null
    }
    const newValue = {
      codemap: codemaps,
      conditioning: conditioning,
      audio: audio,
      spectrogramImage: image,
    }
    this.setValueInteractive(newValue, silent)
    return newValue
  }

  async dummyGenerate(
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    this.emit('busy')
    await this.setCodemap(
      exampleCodemapAndConditioning.codemap,
      exampleCodemapAndConditioning.conditioning,
      queryParameters,
      silent
    )
    this.emit('ready')
    return this
  }
}

const exampleCodemapAndConditioning: Pick<
  NotonoData<VqvaeLayer>,
  'codemap' | 'conditioning'
> = {
  codemap: {
    top: [
      [408, 430, 437, 245],
      [203, 382, 223, 449],
      [332, 126, 194, 139],
      [147, 412, 382, 90],
      [214, 69, 53, 270],
      [142, 34, 130, 488],
      [164, 70, 50, 266],
      [394, 415, 99, 469],
      [267, 415, 454, 16],
      [468, 31, 301, 165],
      [122, 449, 241, 286],
      [132, 503, 301, 473],
      [385, 408, 463, 473],
      [332, 28, 28, 429],
      [505, 463, 425, 134],
      [124, 468, 124, 301],
      [505, 430, 507, 92],
      [358, 428, 25, 473],
      [134, 270, 124, 90],
      [308, 257, 463, 463],
      [385, 249, 310, 399],
      [414, 198, 21, 414],
      [334, 469, 257, 469],
      [329, 295, 248, 498],
      [31, 21, 13, 453],
      [21, 449, 21, 139],
      [134, 97, 414, 339],
      [9, 9, 453, 436],
      [501, 139, 133, 333],
      [451, 301, 301, 339],
      [139, 449, 134, 479],
      [488, 310, 132, 301],
    ],
    bottom: [
      [155, 155, 333, 350, 14, 398, 221, 477],
      [220, 61, 106, 323, 403, 326, 251, 460],
      [293, 370, 450, 435, 488, 266, 219, 318],
      [253, 414, 42, 406, 405, 430, 111, 477],
      [365, 77, 115, 15, 55, 455, 49, 386],
      [115, 439, 196, 483, 167, 439, 369, 50],
      [44, 393, 213, 213, 214, 307, 330, 489],
      [294, 334, 108, 439, 444, 409, 217, 276],
      [431, 123, 10, 430, 115, 380, 136, 391],
      [290, 166, 31, 173, 478, 313, 474, 481],
      [435, 501, 281, 451, 219, 366, 415, 140],
      [9, 450, 36, 270, 308, 24, 307, 311],
      [44, 330, 393, 393, 393, 393, 75, 21],
      [113, 319, 319, 30, 319, 319, 437, 276],
      [131, 175, 115, 1, 175, 435, 365, 117],
      [502, 123, 359, 488, 237, 415, 502, 246],
      [196, 470, 213, 486, 486, 213, 330, 434],
      [154, 415, 510, 478, 366, 292, 53, 41],
      [49, 326, 211, 283, 33, 455, 179, 249],
      [0, 44, 486, 44, 338, 486, 356, 311],
      [439, 417, 137, 417, 417, 486, 330, 434],
      [398, 501, 423, 423, 203, 366, 370, 385],
      [33, 329, 24, 308, 260, 308, 141, 174],
      [301, 313, 485, 334, 108, 208, 112, 318],
      [412, 266, 298, 219, 110, 359, 110, 128],
      [264, 194, 307, 417, 44, 307, 393, 311],
      [385, 435, 337, 427, 198, 111, 230, 128],
      [106, 509, 364, 151, 502, 325, 499, 80],
      [350, 161, 370, 261, 423, 510, 365, 218],
      [10, 30, 139, 359, 366, 325, 260, 385],
      [134, 501, 15, 191, 365, 367, 283, 304],
      [111, 358, 444, 450, 478, 246, 325, 504],
      [446, 319, 502, 415, 30, 196, 341, 388],
      [225, 67, 170, 67, 170, 67, 347, 477],
      [162, 298, 475, 298, 92, 298, 284, 269],
      [151, 308, 485, 108, 485, 485, 264, 276],
      [301, 264, 313, 334, 108, 264, 112, 328],
      [472, 111, 230, 43, 43, 43, 497, 433],
      [123, 366, 153, 30, 30, 292, 151, 318],
      [109, 379, 379, 379, 238, 379, 499, 228],
      [4, 329, 289, 329, 312, 24, 141, 181],
      [161, 292, 450, 42, 349, 444, 292, 252],
      [131, 266, 488, 359, 110, 151, 110, 188],
      [386, 427, 237, 15, 59, 423, 111, 128],
      [367, 102, 358, 358, 358, 153, 236, 318],
      [249, 423, 15, 281, 365, 247, 161, 105],
      [150, 510, 366, 510, 146, 301, 478, 128],
      [355, 502, 260, 151, 151, 312, 284, 318],
      [155, 446, 488, 266, 298, 488, 110, 386],
      [453, 261, 146, 203, 430, 233, 146, 265],
      [412, 366, 153, 102, 219, 478, 415, 396],
      [243, 274, 455, 266, 65, 266, 136, 50],
      [49, 431, 319, 446, 43, 426, 229, 388],
      [220, 15, 446, 43, 8, 211, 229, 372],
      [189, 497, 283, 497, 179, 294, 266, 50],
      [454, 43, 111, 111, 367, 370, 43, 3],
      [290, 155, 65, 49, 115, 211, 355, 433],
      [385, 115, 175, 198, 78, 43, 251, 246],
      [121, 198, 154, 427, 326, 281, 115, 41],
      [140, 115, 59, 251, 155, 123, 189, 508],
      [140, 49, 49, 326, 415, 121, 251, 128],
      [138, 155, 326, 155, 49, 427, 121, 246],
      [157, 480, 326, 77, 472, 154, 251, 460],
      [472, 508, 454, 61, 350, 108, 492, 120],
    ],
  },
  conditioning: {
    top: new Map([
      [
        'instrument_family_str',
        [
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
          ['organ', 'organ', 'organ', 'organ'],
        ],
      ],
      [
        'pitch',
        [
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
          [48, 48, 48, 48],
        ],
      ],
    ]),
    bottom: new Map([
      [
        'instrument_family_str',
        [
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
          [
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
            'organ',
          ],
        ],
      ],
      [
        'pitch',
        [
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
          [48, 48, 48, 48, 48, 48, 48, 48],
        ],
      ],
    ]),
  },
}
