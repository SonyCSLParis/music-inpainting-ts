import log from 'loglevel'

import { TypedEmitter } from 'tiny-typed-emitter'
import { UndoManager, UndoableEdit } from 'typed-undo'

export const enum apiCommand {
  Analyze = 'analyze',
  Inpaint = 'timerange-change',
  Erase = 'erase',
  Sample = 'sample-from-dataset',
  Generate = 'generate',
}

interface CanChangeListeners<T> {
  change: (value: T, previousValue?: T) => void
  busy: () => void
  ready: () => void
}

class CanChange<T> extends TypedEmitter<CanChangeListeners<T>> {
  protected _value: T | undefined = undefined
  get value(): T | never {
    if (this._value == undefined) {
      throw new EvalError('Value not initialized')
    }
    return this._value
  }
  set value(newValue: T) {
    if (newValue != this._value) {
      const previousValue = this._value
      this._value = newValue
      this.emit('change', this.value, previousValue)
    }
  }
}

export abstract class Inpainter<
  DataT = unknown,
  AdditionalAPICommands extends string = never
  > extends CanChange<DataT> {
  constructor(defaultApiAddress: URL) {
    super()
    this.defaultApiAddress = defaultApiAddress
  }

  protected abstract apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string | null }
  ): Promise<DataT>

  readonly defaultApiAddress: URL

  protected handleFetchError(
    response: Response,
    attempted_action = 'perform network request'
  ): Response | never {
    if (!response.ok) {
      throw new Error(
        'Failed to ' +
          attempted_action +
          ` with error code ${response.status} (${response.statusText})`
      )
    }
    return response
  }

  protected async fetch(
    input: RequestInfo,
    init?: RequestInit,
    attemptedAction?: string
  ): Promise<Response> {
    const response = await fetch(input, init)
    return this.handleFetchError(response, attemptedAction)
  }

  protected makeRequestBody(
    jsonData: Record<string, any> = {},
    sendCurrentDataWithRequest = false
  ): { data: BodyInit; dataType: string } | undefined {
    if (Object.keys(jsonData).length == 0 && !sendCurrentDataWithRequest) {
      return undefined
    } else if (sendCurrentDataWithRequest) {
      jsonData = { ...this.valueAsJSONData, ...jsonData }
    }
    return {
      data: JSON.stringify(jsonData),
      dataType: 'application/json',
    }
  }

  protected abstract get valueAsJSONData(): Record<string, any>

  protected formatQueryParameters(queryParameters: string[]): string {
    if (queryParameters.length == 0) {
      return ''
    } else {
      return '?' + queryParameters.join('&')
    }
  }

  // TODO(@tbazin, 2022/045/28): this is to set values in response to
  //   interactive API commands, to maintain a coherent state for undoableEdits
  //   but this feels hackish, could this be cleaned-up?
  protected setValueInteractive(newValue: DataT): void {
    this.value = newValue
  }

  // triggers API request only if the interface is not disabled
  async apiRequestHelper(
    httpMethod: 'GET' | 'POST',
    command: apiCommand | AdditionalAPICommands,
    queryParameters: string[],
    apiAddress: URL,
    sendCurrentDataWithRequest = false,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string | null },
    jsonData?: Record<string, any>
  ): Promise<this> {
    // if (this.disabled) {
    //   return this
    // }
    if (httpMethod == 'POST' && requestBody == null) {
      requestBody = this.makeRequestBody(jsonData, sendCurrentDataWithRequest)
    }
    const query = command + this.formatQueryParameters(queryParameters)
    const href = new URL(query, apiAddress).href

    this.emit('busy')
    try {
      const newValue = await this.apiRequest(
        httpMethod,
        href,
        timeout,
        requestBody
      )
      this.setValueInteractive(newValue)
    } catch (e) {
      log.error(e)
    } finally {
      this.emit('ready')
    }
    return this
  }

  // retrieve new data without conditioning
  async generate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    apiAddress: URL = this.defaultApiAddress,
    timeout = 0
  ): Promise<this> {
    return this.apiRequestHelper(
      'GET',
      apiCommand.Generate,
      queryParameters,
      apiAddress,
      false,
      timeout,
      null,
      jsonData
    )
  }

  // sample new codes from a remote dataset
  async sampleFromDataset(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    apiAddress: URL = this.defaultApiAddress,
    timeout?: number
  ): Promise<this> {
    return this.apiRequestHelper(
      'GET',
      apiCommand.Sample,
      queryParameters,
      apiAddress,
      false,
      timeout,
      null,
      jsonData
    )
  }

  async sampleOrGenerate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    inpaintingApiUrl = this.defaultApiAddress,
    timeout = 10000
  ): Promise<this> {
    try {
      return await this.sampleFromDataset(
        queryParameters,
        jsonData,
        inpaintingApiUrl,
        timeout
      )
    } catch (error) {
      log.error(error)
      return await this.generate(queryParameters, jsonData, inpaintingApiUrl)
    }
  }

  // perform an inpainting operation on the current data
  async inpaint(
    queryParameters: string[] = [],
    apiAddress: URL = this.defaultApiAddress,
    requestBody?: { data: BodyInit; dataType: string | null },
    jsonData?: Record<string, any>
  ): Promise<this> {
    return this.apiRequestHelper(
      'POST',
      apiCommand.Inpaint,
      queryParameters,
      apiAddress,
      true,
      0,
      requestBody,
      jsonData
    )
  }

  // import and analyze a new user-supplied media
  // TODO(theis, 2021/07/26): rename this to encode to better reflect
  // encoder/decoder structure?
  async analyze(
    requestBody?: { data: BodyInit; dataType: string | null },
    jsonData?: Record<string, any>,
    queryParameters: string[] = [],
    apiAddress: URL = this.defaultApiAddress,
    timeout = 0
  ): Promise<this> {
    if (requestBody == null && jsonData == null) {
      throw new Error('Must provide at least one of requestBody or jsonData')
    }
    return this.apiRequestHelper(
      'POST',
      apiCommand.Analyze,
      queryParameters,
      apiAddress,
      false,
      timeout,
      requestBody,
      jsonData
    )
  }
}

class UndoableInpainterEdit<DataT> extends UndoableEdit {
  private readonly oldValue: DataT
  private newValue: DataT
  private readonly applyValue: (value: DataT) => void

  public constructor(
    oldValue: DataT,
    newValue: DataT,
    applyValue: (value: DataT) => void
  ) {
    super()
    this.oldValue = oldValue
    this.newValue = newValue
    this.applyValue = applyValue
  }

  public undo(): void {
    this.applyValue(this.oldValue)
  }

  public redo(): void {
    this.applyValue(this.newValue)
  }

  public isSignificant(): boolean {
    return this.oldValue !== this.newValue
  }

  public merge(edit: this): boolean {
    // TODO(@tbazin, 2022/04/29): should maybe enable merging
    //   for value updates relating to the additional views
    //   e.g., for a sheet, if separately updating first the sheet,
    //   then the associated MIDI. The MIDI-related update should
    //   then be considered non-significant
    return false
  }

  replace(edit: this): boolean {
    return false
  }
}

export abstract class UndoableInpainter<
  DataT = unknown,
  AdditionalAPICommands extends string = never
  > extends Inpainter<DataT, AdditionalAPICommands> {
  readonly undoManager: UndoManager

  constructor(defaultApiAddress: URL, undoManager: UndoManager) {
    super(defaultApiAddress)
    this.undoManager = undoManager
  }

  protected setValueInteractive(newValue: DataT): void {
    const previousValue = this._value
    super.setValueInteractive(newValue)
    if (previousValue != newValue) {
      if (previousValue != undefined && newValue != undefined) {
        this.undoManager.add(
          new UndoableInpainterEdit(previousValue, newValue, (data: DataT) => {
            this.value = data
          })
        )
      }
    }
  }
}
