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
    timeout = 0,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<NotonoData<VqvaeLayer>> {
    return this.loadAudioAndSpectrogram(httpMethod, href, timeout, requestBody)
  }

  protected async getAudioSampleFromDataset(
    queryParameters: string[],
    jsonData?: Record<string, any>,
    inpaintingApiUrl: URL = this.defaultApiAddress
  ): Promise<Blob> {
    const generationUrl = new URL(
      'sample-from-dataset-audio' + this.formatQueryParameters(queryParameters),
      inpaintingApiUrl
    )
    const response = await this.fetch(
      generationUrl.href,
      {
        method: 'GET',
      },
      'get audio sample'
    )
    return response.blob()
  }

  protected async getAudio(
    queryParameters: string[],
    inpaintingApiUrl: URL = this.defaultApiAddress,
    top?: Codemap,
    bottom?: Codemap
  ): Promise<Blob> {
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
        headers: {
          ContentType: 'application/json',
        },
      },
      'convert codemaps to audio'
    )
    return this.base64ResponseToBlob(response)
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
    inpaintingApiUrl: URL = this.defaultApiAddress,
    top?: Codemap,
    bottom?: Codemap
  ): Promise<Blob> {
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
        headers: {
          ContentType: 'application/json',
        },
      },
      'convert codemaps to spectrogram image'
    )
    return this.base64ResponseToBlob(response)
  }

  async sendAudio(
    audioBlob: Blob,
    queryParameters: string[],
    inpaintingApiUrl = this.defaultApiAddress
  ): Promise<this> {
    const audioForm = new FormData()
    audioForm.append('audio', audioBlob)
    const audioRequestBody = {
      data: audioForm,
      dataType: 'multipart/form-data',
    }
    return this.apiRequestHelper(
      'POST',
      'analyze-audio',
      queryParameters,
      inpaintingApiUrl,
      false,
      0,
      null,
      audioRequestBody
    )
  }

  protected get valueAsJSONData(): Record<string, any> {
    return {
      top_code: this.value.codemap.top,
      bottom_code: this.value.codemap.bottom,
      top_conditioning: formatConditioningMap(this.value.conditioning.top),
      bottom_conditioning: formatConditioningMap(
        this.value.conditioning.bottom
      ),
    }
  }

  protected async loadAudioAndSpectrogram(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout = 0,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<NotonoData<VqvaeLayer>> {
    let newCodes_top: Codemap
    let newCodes_bottom: Codemap
    let newConditioning_top: ConditioningMap
    let newConditioning_bottom: ConditioningMap
    let audio: Blob
    let spectrogramImage: Blob

    try {
      const abortController = new AbortController()
      const abortTimeout =
        timeout > 0 ? setTimeout(() => abortController.abort(), timeout) : null

      const response = await this.fetch(
        href,
        {
          method: httpMethod,
          body: requestBody != null ? requestBody.data : null,
          headers:
            requestBody != null
              ? {
                  'Content-Type': requestBody.dataType,
                }
              : {},
          signal: abortController.signal,
        },
        'perform inpainting operation'
      )
      clearTimeout(abortTimeout)
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
    inpaintingApiUrl = this.defaultApiAddress,
    timeout = 10000
  ): Promise<this> {
    const audioBlob = await this.getAudioSampleFromDataset(
      queryParameters,
      jsonData,
      inpaintingApiUrl
    )
    await this.sendAudio(audioBlob, queryParameters, inpaintingApiUrl)
    return this
  }
}
