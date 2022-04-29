import EventEmitter from 'events'
import * as Tone from 'tone'
import log from 'loglevel'
import { debounce } from 'chart.js/helpers'

import { PlaybackManager } from '../playback'
import { Inpainter } from './inpainter'

import { VariableValue } from '../cycleSelect'
import { ScrollLockSimpleBar } from '../utils/simplebar'

export abstract class InpainterGraphicalView<
  DataT = unknown,
  InpainterT extends Inpainter<DataT, never> = Inpainter<DataT, never>,
  PlaybackManagerT extends PlaybackManager<InpainterT> = PlaybackManager<InpainterT>,
  GranularityT = unknown
> extends EventEmitter {
  readonly inpainter: InpainterT
  protected onInpainterBusy(): void {
    this.disableChanges()
  }
  protected onInpainterReady(): void {
    this.enableChanges()
  }
  protected onInpainterChange(data: DataT): void {
    this.refresh()
    this.refreshNowPlayingDisplay()
  }

  // additional parameters to pass to the API requests based on the interface's state
  get queryParameters(): string[] {
    return []
  }

  readonly playbackManager: PlaybackManagerT

  readonly container: HTMLElement
  readonly interfaceContainer: HTMLElement

  // enable this if the scrollbars can be displayed over the content
  // to ensure visibility of the underlying content
  abstract readonly useTransparentScrollbars: boolean

  toggleTransparentScrollbars(): void {
    this.container.classList.toggle(
      'transparent-scrollbar',
      this.useTransparentScrollbars
    )
  }

  protected resizeTimeoutDuration = 16
  // default, dummy timeout
  protected resizeTimeout = setTimeout(() => {
    return
  }, 0)

  readonly granularitySelect: VariableValue<GranularityT>
  get granularity(): GranularityT {
    return this.granularitySelect.value
  }
  protected abstract onchangeGranularity(): void

  protected displayLoop: Tone.Loop = new Tone.Loop()
  protected scrollUpdateLoop: Tone.Loop = new Tone.Loop()

  abstract readonly dataType: 'sheet' | 'spectrogram'

  // render the interface on the DOM and bind callbacks
  public abstract render(...args): void

  // re-render with current parameters
  public refresh(): void {
    this._refresh()
  }

  // subclass this
  protected abstract _refresh(): void

  callToActionHighlightedCellsNumber = 16

  // triggers an animation to catch the user's eye
  public callToAction(
    highlightedCellsNumber = this.callToActionHighlightedCellsNumber
  ): void {
    function delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    let promise = Promise.resolve()
    const interval = 100

    const randomIndexes: number[] = Array(highlightedCellsNumber)
      .fill(0)
      .map(() => {
        return Math.floor(Math.random() * this.numInteractiveElements)
      })

    randomIndexes.forEach((index) => {
      const element = this.getInterfaceElementByIndex(index)

      promise = promise.then(() => {
        if (element != null) {
          element.classList.add('highlight')
        }
        return delay(interval)
      })
    })

    void promise.then(() => {
      setTimeout(() => {
        randomIndexes.forEach((index) => {
          const element = this.getInterfaceElementByIndex(index)

          if (element != null) {
            element.classList.remove('highlight')
          }
        })
      }, 4 * interval * highlightedCellsNumber)
    })
  }

  // retrieve interactive elements of the interface by index
  abstract getInterfaceElementByIndex(index: number): Element | null

  abstract get numInteractiveElements(): number

  protected _disabled = false
  get disabled(): boolean {
    return this._disabled
  }
  set disabled(state: boolean) {
    this._disabled = state
    this.toggleBusyClass(this.disabled)
  }

  protected disableChanges(): void {
    this.disabled = true
  }
  protected enableChanges(): void {
    this.disabled = false
  }

  constructor(
    inpainter: InpainterT,
    playbackManager: PlaybackManagerT,
    container: HTMLElement,
    granularitySelect: VariableValue<GranularityT>, // CycleSelect<EditToolT>,
    defaultApiAddress: URL,
    displayUpdateRate: Tone.Unit.Time,
    // toneDisplayUpdateInterval: Tone.Unit.Time = '4n',
    ...args
  ) {
    super()
    this.inpainter = inpainter
    this.inpainter.on('busy', () => this.onInpainterBusy())
    this.inpainter.on('ready', () => this.onInpainterReady())
    this.inpainter.on('change', (data) => this.onInpainterChange(data))

    this.container = container
    this.container.classList.add('inpainter')
    this.container.classList.add('initializing')

    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.classList.add('inpainter-interface-container')
    this.container.appendChild(this.interfaceContainer)

    this.granularitySelect = granularitySelect
    this.granularitySelect.on('change', () => this.onchangeGranularity())

    this.registerRefreshOnResizeListener()

    this.displayUpdateRate = displayUpdateRate
    this.scheduleDisplayLoop()

    this.toggleTransparentScrollbars()

    this.container.addEventListener('drop', (e) => {
      e.preventDefault()
      this.container.classList.remove('in-dragdrop-operation')
      void this.dropHandler(e)
    })
    this.container.addEventListener('dragenter', (e) => {
      e.preventDefault()
      this.container.classList.add('in-dragdrop-operation')
    })
    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault()
      this.container.classList.remove('in-dragdrop-operation')
    })

    this.playbackManager = playbackManager
    this.playbackManager.transport.on('start', () => {
      this.container.classList.add('playing')
    })
    this.playbackManager.transport.on('stop', () => {
      this.container.classList.remove('playing')
    })
    this.playbackManager.context.on('statechange', () => {
      // reschedule the display loop if the context changed,
      // this can happen when the value of context.lookAhead is changed
      // e.g. when toggling between built-in playback with a safety latency
      // and low-latency MIDI-based playback
      this.scheduleDisplayLoop()
    })

    this.once('ready', () => {
      this.disabled = false
      this.container.classList.remove('initializing')
    })
  }

  protected toggleBusyClass(state: boolean): void {
    this.container.classList.toggle('busy', state)
  }

  protected static blockEventCallback: (e: Event) => void = (e: Event) => {
    // block propagation of events in bubbling/capturing
    e.stopPropagation()
    e.preventDefault()
  }

  protected registerRefreshOnResizeListener(): void {
    window.addEventListener(
      'resize',
      debounce(() => this.refresh(), this.resizeTimeoutDuration)
    )
  }

  // set currently playing interface position by progress ratio
  protected abstract setCurrentlyPlayingPositionDisplay(progress: number): void

  protected scrollbar?: ScrollLockSimpleBar | null = null
  protected readonly nowPlayingDisplayCallbacks: (() => void)[] = [
    // scroll display to current step if necessary
    // (): void => this.scrollTo(this.playbackManager.transport.progress),
    (): void => {
      const transport = this.playbackManager.transport
      this.setCurrentlyPlayingPositionDisplay(transport.progress)
    },
  ]

  refreshNowPlayingDisplay(): this {
    this.nowPlayingDisplayCallbacks.forEach((callback) => callback())
    return this
  }

  protected shortScroll: JQuery.Duration = 50

  protected get scrollableElement(): Element {
    return this.container.getElementsByClassName('simplebar-content-wrapper')[0]
  }

  protected getDisplayCenterPosition_px(): number {
    // return the current position within the sheet display
    const visibleWidth: number = this.scrollableElement.clientWidth
    const centerPosition: number =
      this.scrollableElement.scrollLeft + visibleWidth / 2

    return centerPosition
  }

  protected resetScrollPosition(): void {
    this.scrollTo(0)
  }

  protected scrollTo(progress: number): void {
    this.scrollToStep(this.progressToStep(progress))
  }

  protected abstract progressToStep(progress: number): number
  get currentlyPlayingStep(): number {
    return this.progressToStep(this.playbackManager.transport.progress)
  }

  protected scrollToPosition(targetPosition_px: number): void {
    if (this.scrollbar == null || this.scrollbar.isScrollLocked) {
      return
    }
    const currentDisplayWidth_px: number = this.scrollableElement.clientWidth
    const newScrollLeft_px = targetPosition_px - currentDisplayWidth_px / 2

    const currentCenterPosition_px: number = this.getDisplayCenterPosition_px()
    if (currentCenterPosition_px > targetPosition_px) {
      // scrolling to a previous position: instant scroll
      $(this.scrollableElement).stop(true, false)
      this.scrollableElement.scrollLeft = newScrollLeft_px
    } else {
      // synchronize scrolling with the tempo for smooth scrolling
      const scrollDuration_ms = this.scrollIntervalDuration_seconds * 1000
      $(this.scrollableElement).stop(true, false).animate(
        {
          scrollLeft: newScrollLeft_px,
        },
        scrollDuration_ms,
        'linear'
      )
    }
  }

  // Duration between two scroll snap points,
  //  e.g. 1 beat for a sheet in NONOTO
  //  or 1 second for sounds in NOTONO using a 1-seconds-resolution VQ-VAE
  abstract readonly autoScrollIntervalDuration: Tone.Unit.Time
  abstract readonly autoScrollUpdateInterval: Tone.Unit.Time
  readonly displayUpdateRate: Tone.Unit.Time

  // Return the time in seconds between beats
  get scrollIntervalDuration_seconds(): number {
    return this.playbackManager.transport.toSeconds(
      this.autoScrollIntervalDuration
    )
  }

  protected scrollToStep(step: number): void {
    // scroll display to keep the center of the currently playing
    // quarter note container in the center of the sheet window
    //
    // We do this by scheduling a scroll to the next step with duration
    // equal to one quarter-note time (dependent on the current BPM)
    // Inversely, scrolling to a position earlier in time (e.g. when pressing
    // stop or reaching the end of the loop) is super-fa-solidt
    let targetPosition_px: number
    try {
      // try to retrieve the position of the (potentially non-existing) next
      // quarter-note
      const nextStepBoxDelimiters = this.getTimecontainerPosition(step)
      targetPosition_px = nextStepBoxDelimiters.right
    } catch (e) {
      // reached last container box
      // FIXME make and catch specific error
      const lastStepIndex = this.progressToStep(1) - 1
      const lastStepPosition = this.getTimecontainerPosition(lastStepIndex)
      log.debug(
        `Moving to end, lastStepPosition: [${lastStepPosition.left}, ${lastStepPosition.right}]`
      )

      // right-side delimiter of the last quarter note box
      const containerRight = lastStepPosition.right
      targetPosition_px = containerRight
    }
    this.scrollToPosition(targetPosition_px)
  }

  protected abstract getTimecontainerPosition(
    step: number
  ): { left: number; right: number }

  protected scheduleDisplayLoop(): void {
    this.displayLoop.dispose()
    this.scrollUpdateLoop.dispose()

    const scrollCallback = (time: Tone.Unit.Time) => {
      const draw = this.playbackManager.transport.context.draw
      draw.schedule(
        (): void => this.scrollTo(this.playbackManager.transport.progress),
        this.playbackManager.transport.toSeconds(time)
      )
    }
    this.scrollUpdateLoop = new Tone.Loop(
      scrollCallback,
      this.autoScrollUpdateInterval
    ).start(0)

    const drawCallback = (time: Tone.Unit.Time) => {
      const draw = this.playbackManager.transport.context.draw
      this.nowPlayingDisplayCallbacks.forEach((callback) =>
        draw.schedule(() => {
          callback()
        }, this.playbackManager.transport.toSeconds(time))
      )
    }
    this.displayLoop = new Tone.Loop(
      drawCallback,
      this.displayUpdateRate
    ).start(0)
  }

  protected abstract dropHandler(e: DragEvent): void

  toggleScrollLock(axis: 'x' | 'y', force?: boolean): void {
    this.scrollbar.toggleScrollLock(axis, force)
  }
}

// Mixins

type GConstructor<T> = new (...args: any[]) => T
type InterfaceConstructor = GConstructor<{
  readonly container: HTMLElement
}>

export interface ILoadingDisplay {
  readonly displayClasses: string[]
  readonly containerCssClass: string
  readonly cssClass: string
}

// inserts a loading spinner visible when the app is disabled
export function LoadingDisplay<TBase extends InterfaceConstructor>(
  Base: TBase,
  displayClasses = ['fa-solid', 'fa-7x', 'fa-spin', 'fa-cog']
): ILoadingDisplay & TBase {
  return class LoadingDisplay extends Base {
    readonly spinnerContainer: HTMLElement
    readonly spinner: HTMLElement

    static readonly displayClasses = displayClasses
    static readonly containerCssClass = 'loading-spinner-container'
    static readonly cssClass = 'loading-spinner'

    constructor(...args: any[]) {
      super(...args)
      this.spinnerContainer = document.createElement('div')
      this.spinnerContainer.classList.add(
        LoadingDisplay.containerCssClass,
        'fa-solid',
        'fa-7x',
        'fa-cog',
        'centeredXY'
      )
      this.container.appendChild(this.spinnerContainer)
      this.spinner = document.createElement('div')
      this.spinner.classList.add(
        LoadingDisplay.cssClass,
        'fa-solid',
        'fa-cog',
        'fa-spin'
      )
      this.spinnerContainer.appendChild(this.spinner)
    }
  }
}
