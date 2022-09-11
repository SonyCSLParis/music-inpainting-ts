import log from 'loglevel'

import { ListenerSignature, TypedEmitter } from 'tiny-typed-emitter'
import { UndoManager, UndoableEdit } from 'typed-undo'

export const enum apiCommand {
  Analyze = 'analyze',
  Inpaint = 'timerange-change',
  Erase = 'erase',
  Sample = 'sample-from-dataset',
  Generate = 'generate',
}

// via https://github.com/whatwg/fetch/issues/905#issuecomment-491970649
// Creates an AbortSignal that aborts if any of the provided AbortSignals is triggered
function anySignal(...abortSignals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  function onAbort() {
    controller.abort()

    // Cleanup
    for (const signal of abortSignals) {
      signal.removeEventListener('abort', onAbort)
    }
  }

  for (const signal of abortSignals) {
    if (signal.aborted) {
      onAbort()
      break
    }
    signal.addEventListener('abort', onAbort)
  }

  return controller.signal
}

export interface CanChangeListeners<T, AtomicAddT = unknown> {
  change: (value: T, previousValue?: T) => void
  silentChange: (value: T, previousValue?: T) => void
  busy: () => void
  ready: () => void
  atomicAdd: (value: AtomicAddT, ...args: any) => void
}

class CanChange<T, AtomicAddT = unknown> extends TypedEmitter<
  CanChangeListeners<T, AtomicAddT>
> {
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
  AdditionalAPICommands extends string = never,
  AtomicAddT = unknown
> extends CanChange<DataT, AtomicAddT> {
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
    error: unknown,
    attempted_action = 'perform network request'
  ): never {
    throw new Error(
      'Failed to ' +
        attempted_action +
        // ` with error ${response.status} (${response.statusText})`
        ` with error ${error}`
    )
  }

  protected async timeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  protected defaultTimeout: number = 5000
  protected defaultExponentialBackoffDelay: number = 60
  protected maxExponentialBackoffDelay: number = 1024

  protected async fetch(
    input: RequestInfo,
    init?: RequestInit,
    additionalAbortSignals: AbortSignal[] = [],
    timeout: number = this.defaultTimeout,
    attemptedAction?: string,
    exponentialBackoffDelay: number = this.defaultExponentialBackoffDelay
  ): Promise<Response | undefined> {
    if (init == undefined) {
      init = {}
    }
    let abortTimeout: ReturnType<typeof setTimeout> | null = null
    let timeoutAbortController: AbortController | null = null

    if (timeout != null && timeout > 0) {
      timeoutAbortController = new AbortController()
      abortTimeout = setTimeout(() => {
        log.debug('Timeout exceeded, aborting request')
        timeoutAbortController?.abort()
      }, timeout)

      init.signal = anySignal(
        timeoutAbortController.signal,
        ...additionalAbortSignals
      )
    }

    try {
      const response = await fetch(input, init)
      if (abortTimeout != null) {
        clearTimeout(abortTimeout)
      }
      if (response.ok) {
        return response
      }
    } catch (error: unknown) {
      if (additionalAbortSignals.find((signal) => signal.aborted)) {
        clearTimeout(abortTimeout)
        log.error(error)
        return
      }

      if (exponentialBackoffDelay <= this.maxExponentialBackoffDelay) {
        log.error(error)
        log.error(
          'Fetch error, retrying with exponential timeout ' +
            exponentialBackoffDelay
        )
        await this.timeout(exponentialBackoffDelay)
        return this.fetch(
          input,
          init,
          additionalAbortSignals,
          timeout,
          attemptedAction,
          2 * exponentialBackoffDelay
        )
      } else {
        this.handleFetchError(error, attemptedAction)
      }
    }
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

  // TODO(@tbazin, 2022/05): this is to set values in response to
  //   interactive API commands, to maintain a coherent state for undoableEdits
  //   but this feels hackish, could this be cleaned-up?
  protected setValueInteractive(newValue: DataT): void {
    this._value = newValue
  }

  // triggers API request only if the interface is not disabled
  async apiRequestHelper(
    httpMethod: 'GET' | 'POST',
    command: apiCommand | AdditionalAPICommands,
    queryParameters: string[],
    apiAddress?: URL,
    sendCurrentDataWithRequest = false,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string | null },
    jsonData?: Record<string, any>
  ): Promise<this> {
    apiAddress = apiAddress || this.defaultApiAddress

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
      this.setValueInteractive(newValue, false)
    } catch (e) {
      log.error(e)
    } finally {
      this.emit('ready')
    }
    return this
  }

  dummyGenerate(
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    throw new Error('Not implemented.')
  }

  // retrieve new data without conditioning
  async generate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout: number = 30000,
    apiAddress?: URL
  ): Promise<this> {
    return this.apiRequestHelper(
      'GET',
      apiCommand.Generate,
      queryParameters,
      apiAddress,
      false,
      timeout,
      undefined,
      jsonData
    )
  }

  // sample new codes from a remote dataset
  async sampleFromDataset(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout?: number,
    apiAddress?: URL
  ): Promise<this> {
    return this.apiRequestHelper(
      'GET',
      apiCommand.Sample,
      queryParameters,
      apiAddress,
      false,
      timeout,
      undefined,
      jsonData
    )
  }

  async sampleOrGenerate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout?: number,
    inpaintingApiUrl?: URL
  ): Promise<this> {
    try {
      return await this.sampleFromDataset(
        queryParameters,
        jsonData,
        timeout,
        inpaintingApiUrl
      )
    } catch (error) {
      log.error(error)
      return await this.generate(
        queryParameters,
        jsonData,
        timeout,
        inpaintingApiUrl
      )
    }
  }

  // perform an inpainting operation on the current data
  async inpaint(
    queryParameters: string[] = [],
    requestBody?: { data: BodyInit; dataType: string | null },
    jsonData?: Record<string, any>,
    timeout?: number,
    apiAddress: URL = this.defaultApiAddress
  ): Promise<this> {
    return this.apiRequestHelper(
      'POST',
      apiCommand.Inpaint,
      queryParameters,
      apiAddress,
      true,
      timeout,
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
    timeout?: number,
    apiAddress: URL = this.defaultApiAddress
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

  abstract loadFile(
    file: File,
    queryParameters: string[],
    silent: boolean
  ): Promise<this>
}

export class UndoableInpainterEdit<DataT> extends UndoableEdit {
  protected oldValue: DataT
  protected newValue: DataT
  protected readonly applyValue: (value: DataT) => void
  protected readonly canBeMerged: boolean
  readonly type: string | undefined

  public constructor(
    oldValue: DataT,
    newValue: DataT,
    applyValue: (value: DataT) => void,
    canBeMerged: boolean,
    type?: string
  ) {
    super()
    this.oldValue = oldValue
    this.newValue = newValue
    this.applyValue = applyValue
    this.canBeMerged = canBeMerged
    this.type = type
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

  public merge(newEdit: UndoableInpainterEdit<DataT>): boolean {
    if (newEdit.canBeMerged) {
      this.newValue = newEdit.newValue
      return true
    }
    return false
  }

  replace(edit: this): boolean {
    return false
  }
}

export class PopUndoManager<DataT> extends UndoManager {
  add(edit: UndoableInpainterEdit<DataT>) {
    super.add(edit)
    if (edit.type != null && edit.type == 'clear' && this.position == 1) {
      this.position = 0
      this.pop()
    }
  }

  pop() {
    // if (this.edits.length > 0) {
    this.edits.length = this.position
    // this.position = Math.max(this.position - 1, 0)
    this.listener()
    // }
  }
}

export abstract class UndoableInpainter<
  DataT extends { type?: string | null } = { type?: string | null },
  AdditionalAPICommands extends string = never,
  AtomicAddT = unknown,
  UndoableInpainterEditT extends UndoableInpainterEdit<DataT> = UndoableInpainterEdit<DataT>
> extends Inpainter<DataT, AdditionalAPICommands, AtomicAddT> {
  readonly undoManager: UndoManager
  protected readonly undoableEditFactory: {
    new (
      oldValue: DataT,
      newValue: DataT,
      applyValue: (value: DataT) => void,
      canBeMerged: boolean,
      type?: string
    ): UndoableInpainterEditT
  }

  protected createUndoableEdit(
    previousValue: DataT,
    newValue: DataT,
    canBeMerged: boolean,
    type?: string
  ): UndoableInpainterEditT {
    return new this.undoableEditFactory(
      previousValue,
      newValue,
      (data: DataT) => {
        this.value = data
        this.onUndo()
      },
      canBeMerged,
      type
    )
  }

  constructor(
    defaultApiAddress: URL,
    undoManager: UndoManager,
    undoableEditFactory: {
      new (
        oldValue: DataT,
        newValue: DataT,
        applyValue: (value: DataT) => void,
        canBeMerged: boolean,
        type?: string
      ): UndoableInpainterEditT
    }
  ) {
    super(defaultApiAddress)
    this.undoManager = undoManager
    this.undoableEditFactory = undoableEditFactory
  }

  protected onUndo(): void {
    return
  }

  protected setValueInteractive(
    newValue: DataT,
    silent: boolean = true,
    canBeMergedEdits: boolean = false,
    type?: string | null
  ): void {
    newValue.type = type
    const previousValue = this._value
    if (!silent) {
      this.value = newValue
    } else {
      super.setValueInteractive(newValue)
    }
    if (type !== null) {
      if (previousValue != newValue) {
        if (previousValue != undefined && newValue != undefined) {
          this.undoManager.add(
            this.createUndoableEdit(
              previousValue,
              newValue,
              canBeMergedEdits,
              type
            )
          )
        }
      }
    }
  }
}
