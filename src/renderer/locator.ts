import $ from 'jquery'
import 'nipplejs'
import log from 'loglevel'
import EventEmitter from 'events'

import {
  OpenSheetMusicDisplay,
  Fraction,
  IOSMDOptions,
} from 'opensheetmusicdisplay'
import { FermataBox } from './fermata'
import { ChordSelector } from './chord_selector'
import type { Chord } from './chord'

import Nexus, { NexusSelectWithShuffle } from './nexusColored'
import type { MatrixCell, NexusSelect } from 'nexusui'

import { PlaybackManager } from './playback'
import MidiSheetPlaybackManager from './sheetPlayback'
import * as Tone from 'tone'
import { SpectrogramPlaybackManager } from './spectrogramPlayback'
import { CycleSelect } from './cycleSelect'
import { NumberControl } from './numberControl'
import { DownloadButton } from './downloadCommand'
import { mapTouchEventsToMouseSimplebar } from './utils/simplebar'
import SimpleBar from 'simplebar'
import type { Options as SimpleBarOptions } from 'simplebar'

class ScrollLockSimpleBar extends SimpleBar {
  axis: {
    x: {
      track: { el: HTMLElement; rect: DOMRect }
      scrollbar: { el: HTMLElement; rect: DOMRect }
    }
    y: {
      track: { el: HTMLElement; rect: DOMRect }
      scrollbar: { el: HTMLElement; rect: DOMRect }
    }
  }

  static readonly scrollLockClass = 'scroll-lock'
  protected readonly scrollTracksClassNames: string = 'simplebar-track'
  protected readonly scrollHandlesClassNames: string = 'simplebar-scrollbar'

  constructor(element: HTMLElement, options?: SimpleBarOptions) {
    super(element, options)
    this.registerScrollLockCallback()
  }

  get scrollTracks(): Element[] {
    const scrollTracks = this.el.getElementsByClassName(
      this.scrollTracksClassNames
    )
    if (scrollTracks.length > 0) {
      return Array.from(scrollTracks)
    } else {
      throw new EvalError('No scroll-element not found')
    }
  }

  get scrollHandles(): Element[] {
    return this.scrollTracks.map((element) =>
      element.getElementsByClassName(this.scrollHandlesClassNames).item(0)
    )
  }

  get isScrollLocked(): boolean {
    return this.scrollTracks[0].classList.contains(
      ScrollLockSimpleBar.scrollLockClass
    )
  }

  registerScrollLockCallback(): void {
    // HACK(@tbazin, 2021/09/07): detects click events on the simplebar-track
    //   in order to detect clicks on the before pseudo-element and toggle
    //   scroll-lock, this breaks if clickOnTrack is enabled
    this.scrollTracks.forEach((element) =>
      element.addEventListener('click', function (this: HTMLElement): void {
        this.classList.toggle(ScrollLockSimpleBar.scrollLockClass)
      })
    )
  }

  toggleScrollLock(axis: 'x' | 'y', force?: boolean) {
    this.axis[axis].track.el.classList.toggle(
      ScrollLockSimpleBar.scrollLockClass,
      force
    )
  }

  onDragStart(e, axis: 'x' | 'y' = 'y') {
    this.toggleScrollLock(axis, true)
    // @ts-expect-error: super.onDragStart is private
    super.onDragStart(e, axis)
  }
}

const enum apiCommand {
  Analyze = 'analyze',
  Inpaint = 'timerange-change',
  Erase = 'erase',
  Sample = 'sample-from-dataset',
  Generate = 'generate',
}

export abstract class Locator<
  PlaybackManagerT extends PlaybackManager,
  EditToolT
> extends EventEmitter {
  readonly playbackManager: PlaybackManagerT
  readonly downloadButton: DownloadButton

  readonly container: HTMLElement
  abstract readonly interfaceContainer: HTMLElement

  // enable this if the scrollbars can be displayed over the content
  // to ensure visibility of the underlying content
  abstract readonly useTransparentScrollbars: boolean

  toggleTransparentScrollbars(): void {
    this.container.classList.toggle(
      'transparent-scrollbar',
      this.useTransparentScrollbars
    )
  }

  protected resizeTimeoutDuration = 0
  protected resizeTimeout = setTimeout(() => {
    return
  }, 0)
  readonly editToolSelect: CycleSelect<EditToolT>

  protected displayLoop: Tone.Loop = new Tone.Loop()
  protected scrollUpdateLoop: Tone.Loop = new Tone.Loop()

  abstract readonly dataType: 'sheet' | 'spectrogram'

  // render the interface on the DOM and bind callbacks
  public abstract render(...args): void

  // re-render with current parameters
  // also ensures the help-tour is not taken into account for the layout
  public refresh(): void {
    // HACK(theis)
    const isInHelpTour: boolean = document.body.classList.contains(
      'help-tour-on'
    )
    document.body.classList.remove('help-tour-on')

    this._refresh()

    document.body.classList.toggle('help-tour-on', isInHelpTour)
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

  constructor(
    playbackManager: PlaybackManagerT,
    container: HTMLElement,
    editToolSelect: CycleSelect<EditToolT>,
    downloadButton: DownloadButton,
    defaultApiAddress: URL,
    displayUpdateRate: Tone.Unit.Time,
    // toneDisplayUpdateInterval: Tone.Unit.Time = '4n',
    ...args
  ) {
    super()
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
    this.container = container
    // initialize locator with disabled changes
    this.container.classList.add('busy')

    this.editToolSelect = editToolSelect
    this.downloadButton = downloadButton
    this.defaultApiAddress = defaultApiAddress

    this.registerRefreshOnResizeListener()

    this.displayUpdateRate = displayUpdateRate
    this.scheduleDisplayLoop()

    this.toggleTransparentScrollbars()

    this.container.addEventListener('drop', (e) => void this.dropHandler(e))
  }

  readonly defaultApiAddress: URL

  protected abstract _apiRequest(
    httpMethod: 'GET' | 'POST',
    command: apiCommand,
    restParameters: string,
    apiAddress: URL,
    sendCodesWithRequest: boolean,
    data?,
    timeout?: number
  ): Promise<this>

  // retrieve new data without conditioning
  async generate(apiAddress: URL = this.defaultApiAddress): Promise<this> {
    return this._apiRequest(
      'GET',
      apiCommand.Generate,
      this.restParameters,
      apiAddress,
      false
    ).then((locator) => {
      locator.refreshNowPlayingDisplay()
      return locator
    })
  }

  // sample new codes from a remote dataset
  async sample(
    apiAddress: URL = this.defaultApiAddress,
    timeout?: number
  ): Promise<this> {
    return this._apiRequest(
      'GET',
      apiCommand.Sample,
      this.restParameters,
      apiAddress,
      false,
      null,
      timeout
    ).then((locator) => {
      locator.refreshNowPlayingDisplay()
      return locator
    })
  }

  // perform an inpainting operation on the current data
  async inpaint(mask, apiAddress: URL = this.defaultApiAddress): Promise<this> {
    return this._apiRequest(
      'POST',
      apiCommand.Inpaint,
      this.restParameters,
      apiAddress,
      true,
      mask
    ).then((locator) => {
      locator.refreshNowPlayingDisplay()
      return locator
    })
  }

  protected abstract get restParameters(): string

  // import and analyze a new user-supplied media
  // TODO(theis, 2021/07/26): rename this to encode to better reflect
  // encoder/decoder structure?
  async analyze(
    data: Blob,
    apiAddress: URL = this.defaultApiAddress
  ): Promise<this> {
    return this._apiRequest(
      'POST',
      apiCommand.Analyze,
      this.restParameters,
      apiAddress,
      false,
      data
    ).then((locator) => {
      locator.refreshNowPlayingDisplay()
      return locator
    })
  }

  protected toggleBusyClass(state: boolean): void {
    // TODO(theis, 2021_04_22): clean this up!
    // FIXME(theis, 2021/08/02): avoid applying classes to 'body', breaks encapsulation
    $('body').toggleClass('busy', state)
    $('.notebox').toggleClass('busy', state)
    $('.spectrogram-locator').toggleClass('busy', state)
    this.interfaceContainer.classList.toggle('busy', state)
  }

  protected static blockEventCallback: (e: Event) => void = (e: Event) => {
    // block propagation of events in bubbling/capturing
    e.stopPropagation()
    e.preventDefault()
  }

  protected disableChanges(): void {
    this.toggleBusyClass(true)
  }

  protected enableChanges(): void {
    this.toggleBusyClass(false)
  }

  protected registerRefreshOnResizeListener(): void {
    window.addEventListener('resize', () => {
      if (this.resizeTimeoutDuration > 0) {
        clearTimeout(this.resizeTimeout)
        this.resizeTimeout = setTimeout(() => {
          this.refresh()
        }, this.resizeTimeoutDuration)
      } else {
        this.refresh()
      }
    })
  }

  // set currently playing interface position by progress ratio
  protected abstract setCurrentlyPlayingPositionDisplay(progress: number): void

  protected scrollbar: ScrollLockSimpleBar
  protected readonly nowPlayingDisplayCallbacks: (() => void)[] = [
    // scroll display to current step if necessary
    // (): void => this.scrollTo(this.playbackManager.transport.progress),
    (): void => {
      const transport = this.playbackManager.transport
      this.setCurrentlyPlayingPositionDisplay(transport.progress)
    },
  ]

  refreshNowPlayingDisplay(): void {
    this.nowPlayingDisplayCallbacks.forEach((callback) => callback())
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
    if (this.scrollbar.isScrollLocked) {
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
    // stop or reaching the end of the loop) is super-fast
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

export class SheetLocator extends Locator<MidiSheetPlaybackManager, number> {
  readonly dataType = 'sheet'

  protected readonly serializer = new XMLSerializer()
  protected readonly parser = new DOMParser()
  currentXML: XMLDocument

  constructor(
    sheetPlaybackManager: MidiSheetPlaybackManager,
    container: HTMLElement,
    granularitiesSelect: CycleSelect<number>,
    downloadButton: DownloadButton,
    defaultApiAddress: URL,
    options: IOSMDOptions,
    annotationTypes: string[] = [],
    allowOnlyOneFermata = false
  ) {
    super(
      sheetPlaybackManager,
      container,
      granularitiesSelect,
      downloadButton,
      defaultApiAddress,
      SheetLocator.displayUpdateRate
    )
    /*
     * Create a container element for OpenSheetMusicDisplay...
     */
    this.container.classList.add('sheet-locator')

    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.classList.add('sheet-locator-overlays')
    this.container.appendChild(this.interfaceContainer)

    this.sheetContainer = document.createElement('div')
    this.sheetContainer.classList.add('sheet-locator-sheet')
    this.interfaceContainer.appendChild(this.sheetContainer)

    // initialize OSMD renderer
    this.sheet = new OpenSheetMusicDisplay(this.sheetContainer, options)
    this.sheet.EngravingRules.RenderMultipleRestMeasures = false
    this.sheet.EngravingRules.VoiceSpacingMultiplierVexflow = 1
    this.sheet.EngravingRules.VoiceSpacingAddendVexflow = 10.0

    this.annotationTypes = annotationTypes
    this.allowOnlyOneFermata = allowOnlyOneFermata

    this.boxDurations_quarters = this.editToolSelect.options

    this.scrollbar = new ScrollLockSimpleBar(this.container, {
      autoHide: false,
      clickOnTrack: false,
    })
    mapTouchEventsToMouseSimplebar()
  }
  protected resizeTimeoutDuration = 50

  readonly interfaceContainer: HTMLElement
  readonly sheetContainer: HTMLElement
  readonly useTransparentScrollbars = true

  protected readonly scrollTracksClassNames =
    'simplebar-track simplebar-horizontal'

  readonly sheet: OpenSheetMusicDisplay
  protected get graphicElement(): SVGElement | null {
    return this.sheetContainer.getElementsByTagName('svg').item(0)
  }

  readonly autoScrollIntervalDuration = '4n'
  readonly autoScrollUpdateInterval = '4n'
  static readonly displayUpdateRate = '16n'

  protected onClickTimestampBoxFactory(
    timeStart: Fraction,
    timeEnd: Fraction
  ): (event: PointerEvent) => void {
    // FIXME(theis) hardcoded 4/4 time-signature
    const [timeRangeStart_quarter, timeRangeEnd_quarter] = [
      timeStart,
      timeEnd,
    ].map((timeFrac) => Math.round(4 * timeFrac.RealValue))

    const argsGenerationUrl =
      'timerange-change' +
      `?time_range_start_quarter=${timeRangeStart_quarter}` +
      `&time_range_end_quarter=${timeRangeEnd_quarter}`

    return () => {
      // TODO(theis, 2021-08-10): use locator.inpaint method
      void this.loadMusicXMLandMidi(
        'POST',
        this.defaultApiAddress,
        argsGenerationUrl,
        true
      )
    }
  }

  protected copyTimecontainerContent(origin: HTMLElement, target: HTMLElement) {
    // retrieve quarter-note positions for origin and target
    function getContainedQuarters(timeContainer: HTMLElement): number[] {
      return timeContainer
        .getAttribute('containedQuarterNotes')
        .split(', ')
        .map((x) => parseInt(x, 10))
    }
    const originContainedQuarters: number[] = getContainedQuarters(origin)
    const targetContainedQuarters: number[] = getContainedQuarters(target)

    const originStart_quarter: number = originContainedQuarters[0]
    const targetStart_quarter: number = targetContainedQuarters[0]
    const originEnd_quarter: number = originContainedQuarters.pop()
    const targetEnd_quarter: number = targetContainedQuarters.pop()

    const generationCommand: string =
      '/copy' +
      `?origin_start_quarter=${originStart_quarter}` +
      `&origin_end_quarter=${originEnd_quarter}` +
      `&target_start_quarter=${targetStart_quarter}` +
      `&target_end_quarter=${targetEnd_quarter}`
    void this.loadMusicXMLandMidi(
      'POST',
      this.defaultApiAddress,
      generationCommand,
      true
    )
  }

  readonly boxDurations_quarters: number[]
  readonly annotationTypes: string[]
  readonly allowOnlyOneFermata: boolean

  protected _chordSelectors = new Map<string, ChordSelector>()
  public get chordSelectors(): ChordSelector[] {
    return Array.from(this._chordSelectors.values())
  }

  protected _fermatas = new Map<string, FermataBox>()
  public get fermatas(): FermataBox[] {
    return Array.from(this._fermatas.values())
  }

  public render(): void {
    this.updateContainerWidth(false)
    this.sheet.render()
    this.drawTimestampBoxes()
    this.sheetContainer.setAttribute(
      'sequenceDuration_quarters',
      this.sequenceDuration_quarters.toString()
    )
    this.updateContainerWidth(true)
  }

  renderZoomControls(containerElement: HTMLElement): void {
    const zoomOutButton = document.createElement('div')
    zoomOutButton.classList.add('zoom-out')
    containerElement.appendChild(zoomOutButton)
    const zoomOutButtonIcon = document.createElement('i')
    zoomOutButtonIcon.classList.add('fas', 'fa-search-minus')
    zoomOutButton.appendChild(zoomOutButtonIcon)

    const zoomInButton = document.createElement('div')
    zoomInButton.classList.add('zoom-in')
    containerElement.appendChild(zoomInButton)
    const zoomInButtonIcon = document.createElement('i')
    zoomInButtonIcon.classList.add('fas', 'fa-search-plus')
    zoomInButton.appendChild(zoomInButtonIcon)

    zoomOutButton.addEventListener('click', () => {
      this.sheet.Zoom /= 1.2
      this.render()
      log.info(`OSMD zoom level now: ${this.sheet.Zoom}`)
    })
    zoomInButton.addEventListener('click', () => {
      this.sheet.Zoom *= 1.2
      this.render()
      log.info(`OSMD zoom level now: ${this.sheet.Zoom}`)
    })
  }

  protected _refresh(): void {
    // nothing to do in the case of a sheet, since it does not get resized!
  }

  protected updateContainerWidth(toContentWidth = true): void {
    // HACK update width of container element to actual width of content
    //
    // this is necessary in order to have OSMD print the sheet with
    // maximum horizontal spread

    const superLarge_width_px = 10000000
    // must use a string to ensure no integer formatting is performed
    // which could lead to invalid values in the CSS
    const superLarge_width_px_str = '10000000'

    if (
      this.sheetContainer.children.length == 0 ||
      !this.graphicElement
        // FIXME(theis, 2021/06/01): upgrade to webpack^5 and to support
        // conditional chaining!
        .hasAttribute('viewBox')
    ) {
      // OSMD renderer hasn't been initialized yet, do nothing
      return
    }

    let newWidth_px: number
    let newWidth_px_str: string
    const previousWidth_px: number = parseInt(
      this.graphicElement.getAttribute('width')
    )
    // let x_px_str: string;
    if (toContentWidth) {
      const shift = 0
      const sheetAbsolutePosition_px: number = this.computePositionZoom(
        this.sheet.GraphicSheet.MusicPages[0].MusicSystems[0].PositionAndShape
          .AbsolutePosition.x,
        shift
      )
      // x_px_str = `${sheetAbsolutePosition_px}`

      const sheetWidth_px: number = this.computePositionZoom(
        this.sheet.GraphicSheet.MusicPages[0].MusicSystems[0].PositionAndShape
          .BorderRight,
        shift
      )
      const musicSystemRightBorderAbsolutePosition_px =
        sheetAbsolutePosition_px + sheetWidth_px
      // add a right margin for more pleasant display
      const sheetContainerWidthWithAddedBorder_px =
        musicSystemRightBorderAbsolutePosition_px + sheetAbsolutePosition_px

      newWidth_px = sheetContainerWidthWithAddedBorder_px
      newWidth_px_str = `${newWidth_px}`
    } else {
      newWidth_px = superLarge_width_px
      newWidth_px_str = superLarge_width_px_str
    }

    // update the width of the container so the scrollbar operates properly
    this.sheetContainer.style.width = `${newWidth_px_str}px`
    // update the width of the svg so the scrollbar operates properly
    this.graphicElement.setAttribute('width', `${newWidth_px_str}`)

    // update the viewBox width to reflect the updated width
    const viewBoxRatio_NewToOld = newWidth_px / previousWidth_px
    const viewBox = this.graphicElement.getAttribute('viewBox')
    const [x_px, y_px, previousWidth_px_str, height_px] = viewBox.split(' ')
    const newViewBoxWidth_px_str: string = (
      viewBoxRatio_NewToOld * parseInt(previousWidth_px_str)
    ).toString()
    this.graphicElement.setAttribute(
      'viewBox',
      `${x_px} ${y_px} ${newViewBoxWidth_px_str} ${height_px}`
    )
  }

  // compute a position accounting for <this>'s zoom level
  protected computePositionZoom(value: number, shift = 1): number {
    return (value - shift) * 10.0 * this.sheet.zoom
  }

  // CSS class depicting the duration of a timeContainer box
  static makeGranularityCSSClass(duration_quarters: number): string {
    return duration_quarters.toFixed() + '_quarterNote_duration'
  }

  // Unique ID for a timeContainer box
  static makeGranularityID(
    duration_quarters: number,
    measureIndex: number,
    positionInMeasure: number
  ): string {
    return [duration_quarters, measureIndex, positionInMeasure]
      .map((string) => string.toFixed())
      .join('-')
      .concat('-timeContainer')
  }

  /*
    Update sizing of the box with given ID
    */
  protected updateTimeContainerSize(
    divId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const commonDivId = divId + '-common'
    const commonDiv =
      document.getElementById(commonDivId) || document.createElement('div')

    commonDiv.style.top = `${this.computePositionZoom(y, 0)}px`
    commonDiv.style.height = `${this.computePositionZoom(height, 0)}px`
    commonDiv.style.left = `${this.computePositionZoom(x, 1)}px`
    commonDiv.style.width = `${this.computePositionZoom(width)}px`
  }

  /*
    Create an overlay box with given shape and assign it the given divClass
    */
  protected createTimeContainer(
    divId: string,
    duration_quarters: number,
    onclick: (PointerEvent?) => void,
    timestamps: [Fraction, Fraction]
  ): HTMLElement {
    // container for positioning the timestamp box and attached boxes
    // needed to properly filter click actions
    const commonDivId = divId + '-common'
    const maybeDiv = document.getElementById(divId)

    // FIXME(theis, 2021/05/25): these boxes actually get deleted on each\
    // call of OSMD.render()
    if (maybeDiv != null) {
      return maybeDiv
    } else {
      const div = document.createElement('div')
      const commonDiv = document.createElement('div')

      // the div has no ID set yet: was created in this call
      commonDiv.id = commonDivId
      commonDiv.classList.add(
        'timeContainer',
        SheetLocator.makeGranularityCSSClass(duration_quarters)
      )

      div.id = divId
      div.classList.add('notebox')
      // div.classList.add(divClass);

      // FIXME constrains granularity
      const containedQuarterNotes = []
      const quarterNoteStart = Math.floor(timestamps[0].RealValue * 4)
      const quarterNoteEnd = Math.floor(timestamps[1].RealValue * 4)
      for (let i = quarterNoteStart; i < quarterNoteEnd; i++) {
        containedQuarterNotes.push(i)
      }
      commonDiv.setAttribute(
        'containedQuarterNotes',
        containedQuarterNotes.toString().replace(/,/g, ' ')
      )
      // div.setAttribute('containedQuarterNotes',
      //     commonDiv.getAttribute('containedQuarterNotes'));

      if (this.editToolSelect.value == duration_quarters) {
        div.classList.add('active')
      }

      // // insert NipppleJS manager
      // var options = {
      //     zone: div,
      //     color: "blue"
      // };
      // var manager = nipplejs.create(options);
      // var joystick_data = {};
      // var last_click = [];
      div.addEventListener('click', onclick)
      // use bubbling and preventDefault to block window scrolling
      div.addEventListener(
        'wheel',
        (event: WheelEvent) => {
          event.preventDefault()
          const scrollUp = -event.deltaY >= 0
          this.editToolSelect.cycleOptions(scrollUp, false)
        },
        false
      )

      // add Drag'n'Drop support between timeContainers
      div.setAttribute('draggable', 'true')
      div.addEventListener('dragstart', ondragstartTimecontainer_handler, true)
      div.addEventListener('dragover', ondragoverTimecontainer_handler, true)
      div.addEventListener('dragenter', ondragenterTimecontainer_handler, true)
      div.addEventListener('dragleave', ondragleaveTimecontainer_handler, true)
      div.addEventListener(
        'drop',
        makeOndropTimecontainer_handler(
          this.copyTimecontainerContent.bind(this)
        ),
        true
      )

      // add div to the rendering backend's <HTMLElement> for positioning
      this.interfaceContainer.appendChild(commonDiv)
      commonDiv.appendChild(div)

      if (this.annotationTypes.includes('fermata') && duration_quarters == 1) {
        // FIXME hardcoded quarter-note duration
        // add fermata selection box
        this.fermatas.push(
          new FermataBox(
            commonDiv,
            this.sequenceDuration_quarters,
            this.allowOnlyOneFermata
          )
        )
      }

      if (
        this.annotationTypes.includes('chord_selector') &&
        duration_quarters == 2
      ) {
        // add chord selection boxes at the half-note level
        this._chordSelectors.set(
          commonDivId,
          new ChordSelector(commonDiv, onclick)
        )
      }

      return div
    }
  }

  public get sequenceDuration_quarters(): number {
    // FIXME hardcoded 4/4 time-signature
    return this.sheet.GraphicSheet.MeasureList.length * 4
  }

  public get pieceDuration(): Fraction {
    const pieceDuration = new Fraction(0, 1)
    const measureList = this.sheet.GraphicSheet.MeasureList
    const numMeasures = measureList.length
    for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
      const measure = measureList[measureIndex][0]
      const sourceMeasure = measure.parentSourceMeasure
      const measureDuration = sourceMeasure.Duration

      pieceDuration.Add(measureDuration)
    }
    return pieceDuration
  }

  public drawTimestampBoxes(): void {
    // FIXME this assumes a time signature of 4/4
    const measureList = this.sheet.GraphicSheet.MeasureList
    const numMeasures = measureList.length
    const pieceDuration = this.pieceDuration

    function makeDurationFraction(duration_quarters: number): Fraction {
      return new Fraction(duration_quarters, 4)
    }

    for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
      const measure = measureList[measureIndex][0]
      const beginInstructionsWidth = measure.beginInstructionsWidth

      const sourceMeasure = measure.parentSourceMeasure

      // compute time interval covered by the measure
      const measureStartTimestamp = sourceMeasure.AbsoluteTimestamp
      const measureEndTimestamp = Fraction.plus(
        measureStartTimestamp,
        sourceMeasure.Duration
      )

      const musicSystem = measure.ParentMusicSystem

      // cf. sizing the Cursor in OpenSheetMusicDisplay/Cursor.ts
      const y =
        musicSystem.PositionAndShape.AbsolutePosition.y +
        musicSystem.StaffLines[0].PositionAndShape.RelativePosition.y
      const endY =
        musicSystem.PositionAndShape.AbsolutePosition.y +
        musicSystem.StaffLines[musicSystem.StaffLines.length - 1]
          .PositionAndShape.RelativePosition.y +
        4.0
      const height = endY - y

      // for (const [timestampList, granularityName] of timestampsAndNames) {
      this.boxDurations_quarters.forEach((boxDuration_quarters) => {
        // for (const boxDuration_quarters of ) {
        const boxDuration = makeDurationFraction(boxDuration_quarters)

        // we start at the timestamp of the beginning of the current measure
        // and shift by `duration` until we reach the end of the measure
        // to generate all sub-intervals of `duration` in this measure
        // Will generate a single interval if duration is
        const currentBeginTimestamp = measureStartTimestamp.clone()
        const currentEndTimestamp = Fraction.plus(
          currentBeginTimestamp,
          boxDuration
        )

        // HACK breaks if boxDuration equal e.g. Fraction(3, 2)
        if (
          boxDuration.WholeValue > 1 &&
          !(measureIndex % boxDuration.WholeValue == 0)
        ) {
          return
        }

        // number of boxes generated for this boxDuration and this measure
        let boxIndex = 0
        while (
          currentBeginTimestamp.lt(measureEndTimestamp) &&
          currentEndTimestamp.lte(pieceDuration)
        ) {
          let xBeginBox = this.sheet.GraphicSheet.calculateXPositionFromTimestamp(
            currentBeginTimestamp
          )[0]

          let xEndBox: number
          if (currentEndTimestamp.lt(measureEndTimestamp)) {
            // x-coordinates for the bounding box
            xEndBox = this.sheet.GraphicSheet.calculateXPositionFromTimestamp(
              currentEndTimestamp
            )[0]
          } else {
            // index of the last measure contained in the current box
            // e.g. if durationBox is 2, we arrive in `measureIndex+1`
            const lastContainedMeasureIndex =
              measureIndex +
              boxDuration.WholeValue -
              1 * (boxDuration.RealValue == boxDuration.WholeValue ? 1 : 0)
            const lastMeasure = measureList[lastContainedMeasureIndex][0]
            // reached last segment of the measure
            // set xRight as the x-position of the next measure bar
            xEndBox =
              lastMeasure.PositionAndShape.AbsolutePosition.x +
              lastMeasure.PositionAndShape.Size.width +
              1
          }

          if (beginInstructionsWidth > 1) {
            // add x-offset to compensate for the presence of special
            // symbols (e.g. key symbols) at the beginning of the measure
            if (beginInstructionsWidth > 5) {
              xBeginBox -= 1 // HACK hardcoded
              xEndBox -= 1
            } else {
              xBeginBox -= 2
              xEndBox -= 2
            }
          }
          const width = xEndBox - xBeginBox

          const timeContainerID = SheetLocator.makeGranularityID(
            boxDuration_quarters,
            measureIndex,
            boxIndex
          )

          if (!document.getElementById(timeContainerID)) {
            // the time container does not yet exist, create it
            const onclick = this.onClickTimestampBoxFactory(
              currentBeginTimestamp,
              currentEndTimestamp
            )
            this.createTimeContainer(
              timeContainerID,
              boxDuration_quarters,
              onclick,
              [currentBeginTimestamp, currentEndTimestamp]
            )
          }

          this.updateTimeContainerSize(
            timeContainerID,
            xBeginBox,
            y,
            width,
            height
          )

          // continue to next time container
          currentBeginTimestamp.Add(boxDuration)
          currentEndTimestamp.Add(boxDuration)
          boxIndex++
        }
      })
    }
  }

  protected get activeElements(): HTMLCollectionOf<Element> {
    return this.interfaceContainer.getElementsByClassName('notebox active')
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.activeElements.item(index)
  }

  get numInteractiveElements(): number {
    return this.activeElements.length
  }

  protected setCurrentlyPlayingPositionDisplay(progress: number): void {
    const transport = this.playbackManager.transport
    const timePosition = Math.floor(
      (progress +
        transport.context.lookAhead / transport.toSeconds(transport.loopEnd)) *
        this.sequenceDuration_quarters
    )

    $('.notebox').removeClass('playing')
    $(
      `.timeContainer[containedQuarterNotes~='${timePosition}'] .notebox`
    ).addClass('playing')
  }

  // return the offset of the desired step
  protected getStepDisplayOffset(step: number): number | null {
    let positionTarget_px: number
    try {
      // try to retrieve the position of the (potentially non-existing) next
      // quarter-note
      const nextStepBoxDelimiters = this.getTimecontainerPosition(step)
      positionTarget_px = nextStepBoxDelimiters.right
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
      positionTarget_px = containerRight
    }
    return positionTarget_px
  }

  protected getTimecontainerPosition(
    step: number
  ): { left: number; right: number } {
    // TODO(@tbazin, 2021/08/31): remove use of JQuery
    // FIXME implement and use timeContainer method
    const containerElementSelector = $(
      `.timeContainer[containedQuarterNotes='${step}']`
    )

    if (containerElementSelector.length == 0) {
      throw new Error('Inaccessible step')
    }

    const containerElementStyle = containerElementSelector[0].style
    return {
      left: parseFloat(containerElementStyle.left),
      right:
        parseFloat(containerElementStyle.left) +
        parseFloat(containerElementStyle.width),
    }
  }

  protected get sequenceDurationQuarters(): number {
    return this.sheet.GraphicSheet.MeasureList.length * 4
  }

  protected progressToStep(progress: number): number {
    return Math.floor(progress * this.sequenceDurationQuarters)
  }

  protected getFermatas(): number[] {
    const activeFermataElements = $('.Fermata.active')
    const containedQuarterNotesList: number[] = []
    for (const activeFemataElement of activeFermataElements) {
      containedQuarterNotesList.push(
        // TODO(theis): store and retrieve containedQuarterNotes
        // to and from TypeScript Fermata objects
        parseInt(
          activeFemataElement.parentElement.getAttribute(
            'containedQuarterNotes'
          )
        )
      )
    }
    return containedQuarterNotesList
  }

  protected getChordLabels(): Chord[] {
    // return a stringified JSON object describing the current chords
    const chordLabels: Chord[] = []
    for (const chordSelector of this.chordSelectors) {
      chordLabels.push(chordSelector.currentChord)
    }
    return chordLabels
  }

  protected getMetadata(): { fermatas: number[]; chordLabels: Chord[] } {
    return {
      fermatas: this.getFermatas(),
      chordLabels: this.getChordLabels(),
    }
  }

  protected removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): void {
    // Strip MusicXML document of title/composer tags
    const titleNode = xmlDocument.getElementsByTagName('work-title')[0]
    const movementTitleNode = xmlDocument.getElementsByTagName(
      'movement-title'
    )[0]
    const composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent =
      ''
  }

  protected get restParameters(): string {
    return ''
  }

  protected _apiRequest(
    httpMethod: 'GET' | 'POST',
    command: apiCommand,
    restParameters: string,
    apiAddress: URL,
    sendSheetWithRequest: boolean,
    data?,
    timeout = 0
  ): Promise<this> {
    return this.loadMusicXMLandMidi(
      httpMethod,
      apiAddress,
      command + restParameters,
      sendSheetWithRequest
    )
  }

  /**
   * Load a MusicXml file via xhttp request, and display its contents.
   */
  async loadMusicXMLandMidi(
    httpMethod: 'GET' | 'POST',
    inpaintingApiUrl: URL,
    generationCommand: string,
    sendSheetWithRequest = true
  ): Promise<this> {
    this.disableChanges()

    let requestBody: BodyInit | null = null
    if (httpMethod == 'POST') {
      const payload_object = this.getMetadata()

      log.trace('Metadata:')
      log.trace(JSON.stringify(payload_object))

      if (sendSheetWithRequest) {
        payload_object['sheet'] = this.serializer.serializeToString(
          this.currentXML
        )
      }
      requestBody = JSON.stringify(payload_object)
    }

    const commandURL = new URL(generationCommand, inpaintingApiUrl)
    const jsonResponse = await fetch(commandURL.href, {
      method: httpMethod,
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const jsonContent = await jsonResponse.json()
    // update metadata
    // TODO: must check if json HAS the given metadata key first!
    // const new_fermatas = jsonResponse["fermatas"];
    if (!generationCommand.includes('generate')) {
      // TODO updateFermatas(newFermatas);
    }

    // load the received MusicXML
    const xml_sheet_string = jsonContent['sheet']
    const xmldata = this.parser.parseFromString(xml_sheet_string, 'text/xml')
    this.removeMusicXMLHeaderNodes(xmldata)
    this.currentXML = xmldata

    // save current zoom level to restore it after load
    const zoom = this.sheet.Zoom
    this.sheet.load(this.currentXML).then(
      async () => {
        // restore pre-load zoom level
        this.sheet.Zoom = zoom
        this.render()

        const sequenceDuration = Tone.Time(
          `0:${this.sequenceDuration_quarters}:0`
        )
        const midiConversionURL = new URL('/musicxml-to-midi', inpaintingApiUrl)
        const midiBlobURL = await this.playbackManager.loadMidi(
          midiConversionURL.href,
          this.currentXML,
          sequenceDuration.toBarsBeatsSixteenths()
        )
        this.downloadButton.revokeBlobURL()
        this.downloadButton.targetURL = midiBlobURL

        this.enableChanges()
      },
      (err) => {
        log.error(err)
        this.enableChanges()
      }
    )
    return this
  }

  protected dropHandler(e: DragEvent): void {
    // Prevent default behavior (Prevent file from being opened)
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer == null) {
      return
    }

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (e.dataTransfer.items[i].kind === 'file') {
          const sheetFile = e.dataTransfer.items[i].getAsFile()
          if (sheetFile == null) {
            return
          }
          void sheetFile.text().then((xmlSheetString) => {
            const xmldata = this.parser.parseFromString(
              xmlSheetString,
              'text/xml'
            )
            this.removeMusicXMLHeaderNodes(xmldata)
            this.currentXML = xmldata

            // save current zoom level to restore it after load
            const zoom = this.sheet.Zoom
            void this.sheet.load(this.currentXML).then(async () => {
              // restore pre-load zoom level
              this.sheet.Zoom = zoom
              this.render()

              const sequenceDuration = Tone.Time(
                `0:${this.sequenceDuration_quarters}:0`
              )
              const midiConversionURL = new URL(
                '/musicxml-to-midi',
                this.defaultApiAddress
              )
              const midiBlobURL = await this.playbackManager.loadMidi(
                midiConversionURL.href,
                this.currentXML,
                sequenceDuration.toBarsBeatsSixteenths()
              )
              this.downloadButton.revokeBlobURL()
              this.downloadButton.targetURL = midiBlobURL

              this.enableChanges()
            })
          })
        }
      }
    }
  }
}

type GridPosition = {
  row: number
  column: number
}

// monkey-patch Nexus.Sequencer to emit 'toggle' events
// these are triggered only on actual changes of the pattern,
// as opposed to the 'change' events which can be emitted even though the actual
// content of the matrix does not change (e.g. when touching the same cell twice
// in a single Touch action)
declare interface SequencerToggle {
  on(
    event: 'toggle',
    listener: (
      cellValue: {
        row: number
        column: number
        state: boolean
      },
      ...args: any[]
    ) => void
  ): this
  on(
    event: 'change',
    listener: (
      cellValue: { row: number; column: number; state: boolean },
      ...args: any[]
    ) => void
  ): this
  on(
    event: 'step',
    listener: (columnValues: number[], ...args: any[]) => void
  ): this
}

class SequencerToggle extends Nexus.Sequencer {
  inRectangularSelection = false
  firstCell?: GridPosition
  previousCell?: GridPosition
  rectangularSelections = true

  readonly columnsOverlay: HTMLElement
  static readonly nowPlayingCSSClass = 'sequencer-playing'

  constructor(container: string | HTMLElement, options) {
    super(container, options)

    if (this.rectangularSelections) {
      this.element.addEventListener('pointerdown', this.onInteractionStart)
    }

    this.columnsOverlay = document.createElement('div')
    this.columnsOverlay.classList.add('sequencer-grid-overlay')
    this.element.appendChild(this.columnsOverlay)
    Array(this.columns)
      .fill(0)
      .forEach(() => {
        this.columnsOverlay.appendChild(document.createElement('span'))
      })
  }

  protected get columnsOverlayColumns(): HTMLElement[] {
    return Array.from(this.columnsOverlay.getElementsByTagName('span'))
  }

  setPlayingColumn(columnIndex: number): void {
    this.columnsOverlayColumns.forEach((elem, index) =>
      elem.classList.toggle(
        SequencerToggle.nowPlayingCSSClass,
        index == columnIndex
      )
    )
  }

  clearNowPlayingDisplay(): void {
    this.columnsOverlayColumns.forEach((elem) =>
      elem.classList.remove(SequencerToggle.nowPlayingCSSClass)
    )
  }

  protected registerEventListeners(): void {
    document.addEventListener('pointerup', this.onInteractionEnd)
    document.addEventListener('pointercancel', this.onInteractionEnd)
  }

  protected removeEventListeners(): void {
    document.removeEventListener('pointerup', this.onInteractionEnd)
    document.removeEventListener('pointercancel', this.onInteractionEnd)
  }

  protected onInteractionEnd: () => void = () => {
    this.inRectangularSelection = false
    this.firstCell = null
    this.previousCell = null
    this.removeEventListeners()
    return
  }

  protected onInteractionStart: () => void = () => {
    this.registerEventListeners()
    this.inRectangularSelection = true
    return
  }

  protected getCell(cell: GridPosition): MatrixCell {
    return this.cells[this.getIndex(cell)]
  }

  protected getIndex(cell: GridPosition): number {
    return this.matrix.indexOf(cell.row, cell.column)
  }

  protected turnOn(cell: GridPosition, emitting: boolean): void {
    const matrixCell = this.getCell(cell)
    matrixCell.turnOn(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 1
    }
  }

  protected turnOff(cell: GridPosition, emitting: boolean): void {
    const matrixCell = this.cells[this.matrix.indexOf(cell.row, cell.column)]
    matrixCell.turnOff(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 0
    }
  }

  keyChange(note, on: boolean): void {
    const cell = this.matrix.locate(note)
    const previousState: boolean =
      this.matrix.pattern[cell.row][cell.column] == 1
    if (!this.rectangularSelections) {
      if (previousState !== on) {
        const data = {
          row: cell.row,
          column: cell.column,
          state: on,
        }
        this.emit('toggle', data)
      }
    }
    if (this.rectangularSelections && this.inRectangularSelection) {
      if (this.firstCell == null) {
        this.firstCell = cell
        this.previousCell = cell
        const data = {
          row: cell.row,
          column: cell.column,
          state: on,
        }
        this.emit('toggle', data)
      } else {
        // TODO(theis, 2021/05/21): could maybe be more efficient by just computing
        // the delta of cells to turn on and cells to turn off by using the
        // previous position of the pointer.
        //  This brute-force version probably has the advantage of being more robust
        // to very fast mouse movements though, which could lead to `this.previousCell`'s
        // value not being accurate, resulting in a mismatched update.

        // turn all cells off
        const numActiveBefore = this.matrix.pattern
          .map((row) => row.reduce((acc, value) => acc + value))
          .reduce((acc, columnValue) => acc + columnValue)
        for (let index = 0; index < this.matrix.length; index++) {
          const cell = this.matrix.locate(index)
          this.turnOff(cell, false)
        }

        // activate all cells in the rectangle between the first cell
        // of the interaction and the current cell
        const rectangleStart = {
          row: Math.min(this.firstCell.row, cell.row),
          column: Math.min(this.firstCell.column, cell.column),
        }
        const rectangleEnd = {
          row: Math.max(this.firstCell.row, cell.row),
          column: Math.max(this.firstCell.column, cell.column),
        }
        for (let row = rectangleStart.row; row <= rectangleEnd.row; row++) {
          for (
            let column = rectangleStart.column;
            column <= rectangleEnd.column;
            column++
          ) {
            const cell = { row: row, column: column }
            this.turnOn(cell, false)
          }
        }
        const numActiveAfter = this.matrix.pattern
          .map((row) => row.reduce((acc, value) => acc + value))
          .reduce((acc, columnValue) => acc + columnValue)

        // TODO(@tbazin, 2021/10/22): might make this more efficient
        if (numActiveAfter != numActiveBefore) {
          // the pattern changed, emit a `toggle` event
          const data = {
            row: cell.row,
            column: cell.column,
            state: on,
          }
          this.emit('toggle', data)
        }
      }
      this.previousCell = cell
    }
    super.keyChange(note, on)
  }
}

type Codemap = number[][]
type InpaintingMask = boolean[][]

type ConditioningMap = Map<string, (number | string)[][]>

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
  InpaintRandom = 'inpaint-random',
  Eraser = 'erase',
}

export type LayerAndTool = { layer: VqvaeLayer; tool: NotonoTool }

export class SpectrogramLocator extends Locator<
  SpectrogramPlaybackManager,
  LayerAndTool
> {
  protected getTimecontainerPosition(
    step: number
  ): { left: number; right: number } {
    const left = step * this.columnWidth
    return {
      left: left,
      right: left + this.columnWidth,
    }
  }

  protected progressToStep(progress: number): number {
    return Math.floor(progress * this.numColumnsTotal)
  }

  readonly dataType = 'spectrogram'
  readonly imageContainer: HTMLElement
  readonly imageElement: HTMLImageElement
  readonly shadowContainer: HTMLElement
  readonly interfaceContainer: HTMLElement
  readonly snapPoints: HTMLDivElement
  readonly addColumnIconsContainer: HTMLDivElement
  protected sequencer: SequencerToggle
  readonly useTransparentScrollbars = false

  readonly instrumentConstraintSelect: NexusSelectWithShuffle
  readonly pitchClassConstraintSelect?: NexusSelect
  readonly octaveConstraintControl: NumberControl

  // TODO(theis, 2021/08/26): retrieve this value from the API
  readonly autoScrollIntervalDuration = 0
  readonly autoScrollUpdateInterval = 0.1
  static readonly displayUpdateRate = 0.1

  // TODO(theis, 2021/07/13): add proper typing. Create a VQVAE class?
  protected _columnDuration?: Tone.Unit.Seconds
  get columnDuration(): Tone.Unit.Seconds {
    return this._columnDuration
  }
  set columnDuration(columnDuration: Tone.Unit.Seconds) {
    this._columnDuration = columnDuration
  }

  protected _codemap_top?: Codemap
  protected get codemap_top(): Codemap | undefined {
    return this._codemap_top
  }
  protected set codemap_top(codemap: Codemap | undefined) {
    this._codemap_top = codemap
  }

  protected codemap_bottom?: Codemap

  protected get activeCodemap(): Codemap | null {
    switch (this.editToolSelect.value.layer) {
      case VqvaeLayer.Top:
        return this.codemap_top
        break
      case VqvaeLayer.Bottom:
        return this.codemap_bottom
        break
    }
  }

  protected currentConditioning_top?: ConditioningMap
  protected currentConditioning_bottom?: ConditioningMap

  get interfaceElement(): HTMLElement {
    return this.sequencer.element
  }

  constructor(
    playbackManager: SpectrogramPlaybackManager,
    container: HTMLElement,
    inpaintingApiAddress: URL,
    vqvaeLayerSelect: CycleSelect<LayerAndTool>,
    downloadButton: DownloadButton,
    instrumentConstraintSelect: NexusSelectWithShuffle,
    octaveConstraintControl: NumberControl,
    pitchClassConstraintSelect?: NexusSelect,
    options: Record<string, unknown> = {}
  ) {
    super(
      playbackManager,
      container,
      vqvaeLayerSelect,
      downloadButton,
      inpaintingApiAddress,
      SpectrogramLocator.displayUpdateRate
    )

    this.container.classList.add('spectrogram-locator')

    this.imageContainer = document.createElement('div')
    this.imageContainer.classList.add('spectrogram-locator-image-container')
    this.container.appendChild(this.imageContainer)

    const spectrogramPictureElement = document.createElement('picture')
    this.imageContainer.appendChild(spectrogramPictureElement)
    this.imageElement = document.createElement('img')
    spectrogramPictureElement.appendChild(this.imageElement)

    this.snapPoints = document.createElement('div')
    this.snapPoints.classList.add('spectrogram-locator-snap-points')
    spectrogramPictureElement.appendChild(this.snapPoints)

    this.scrollbar = new ScrollLockSimpleBar(this.imageContainer, {
      clickOnTrack: false,
    })

    // necessary to handle 'busy' state cursor change and pointer events disabling
    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.classList.add(
      'spectrogram-locator-interface-container'
    )
    this.container.appendChild(this.interfaceContainer)

    this.shadowContainer = document.createElement('div')
    this.shadowContainer.classList.add('spectrogram-locator-shadow-container')
    this.shadowContainer.classList.add('glow-shadow')
    this.interfaceContainer.appendChild(this.shadowContainer)

    const initialWidth = this.interfaceContainer.clientWidth
    const initialHeight = this.interfaceContainer.clientHeight
    this.drawTimestampBoxes(32, 4, 4, initialWidth, initialHeight)

    this.instrumentConstraintSelect = instrumentConstraintSelect
    this.octaveConstraintControl = octaveConstraintControl

    // if no pitchClassConstraintSelect interface is passed, the pitchClass constraint
    // defaults to C
    this.pitchClassConstraintSelect = pitchClassConstraintSelect

    this.registerCallback(() => void this.regenerationCallback())
    this.scrollableElement.addEventListener('scroll', () => {
      this.setCurrentlyPlayingPositionDisplay()
    })
  }

  protected _apiRequest(
    httpMethod: 'GET' | 'POST',
    command: apiCommand,
    restParameters: string,
    apiAddress: URL,
    sendCodesWithRequest: boolean,
    data?,
    timeout = 0
  ): Promise<this> {
    return this.loadAudioAndSpectrogram(
      httpMethod,
      apiAddress,
      command + restParameters,
      sendCodesWithRequest,
      data,
      timeout
    )
  }

  public get midiPitchConstraint(): number {
    let pitchClass = 0 // Default to C
    if (this.pitchClassConstraintSelect != undefined) {
      pitchClass = this.pitchClassConstraintSelect.selectedIndex
    }
    return pitchClass + 12 * this.octaveConstraintControl.value
  }

  public get instrumentConstraint(): string {
    return this.instrumentConstraintSelect.value
  }

  public get mask(): InpaintingMask {
    return this.sequencer.matrix.pattern.map((row) =>
      row.map((value) => value == 1)
    )
  }

  readonly boxDurations_quarters: number[]

  protected async regenerationCallback(): Promise<this> {
    switch (this.editToolSelect.value.layer) {
      case VqvaeLayer.Top: {
        this.currentConditioning_top = this.updateConditioningMap(
          this.mask,
          this.currentConditioning_top
        )
        break
      }
      case VqvaeLayer.Bottom: {
        this.currentConditioning_bottom = this.updateConditioningMap(
          this.mask,
          this.currentConditioning_bottom
        )
        break
      }
    }

    const sendCodesWithRequest = true
    return this._apiRequest(
      'POST',
      this.generationCommand,
      this.restParameters,
      this.defaultApiAddress,
      sendCodesWithRequest,
      this.mask
    ).then((locator) => {
      this.refreshNowPlayingDisplay()
      return locator
    })
  }

  protected get generationCommand(): apiCommand {
    const tool = this.editToolSelect.value.tool
    let command: apiCommand
    switch (tool) {
      case NotonoTool.Eraser:
        command = apiCommand.Erase
        break
      case NotonoTool.Inpaint:
      case NotonoTool.InpaintRandom:
        command = apiCommand.Inpaint
    }
    return command
  }

  protected get restParameters(): string {
    const startIndexTop: number = this.getCurrentScrollPositionTopLayer()
    let generationParameters =
      '?pitch=' +
      this.midiPitchConstraint.toString() +
      '&pitch_class=' +
      (this.midiPitchConstraint % 12).toString() +
      '&instrument_family_str=' +
      this.instrumentConstraint +
      '&layer=' +
      this.editToolSelect.value.layer +
      '&temperature=1' +
      '&eraser_amplitude=0.1' +
      '&start_index_top=' +
      startIndexTop.toString() +
      '&duration_top=' +
      this.vqvaeTimestepsTop.toString()
    const tool = this.editToolSelect.value.tool
    generationParameters +=
      '&uniform_sampling=' + (tool == NotonoTool.InpaintRandom).toString()
    return generationParameters
  }

  public registerCallback(callback: () => void): void {
    const registerReleaseCallback = () => {
      // call the actual callback on pointer release to allow for click and drag
      document.addEventListener(
        'pointerup',
        () => {
          if (!this.hasEmptyMask) {
            callback.bind(this)()
          }
        },
        { once: true } // eventListener removed after being called
      )
    }

    this.interfaceContainer.addEventListener('pointerdown', () => {
      this.scrollbar.toggleScrollLock('x', true)
      registerReleaseCallback()
    })
  }

  protected getCurrentScrollPositionTopLayer(): number {
    const spectrogramImageContainerElement = this.imageContainer
    if (spectrogramImageContainerElement == null) {
      throw Error('Spectrogram container not initialized')
    }
    const scrollElement = this.scrollbar.getScrollElement()
    if (scrollElement == null) {
      return 0
    }
    // HACK(theis, 2021_04_21): check `isScrollable` test,
    // testing if scrollWidth - clientWidth > 1 avoids some edge cases
    // of very slightly different widths, but does not seem very robust
    const isScrollable: boolean =
      scrollElement.scrollWidth - scrollElement.clientWidth > 1
    if (!isScrollable) {
      return 0
    } else {
      const currentScrollRatio =
        scrollElement.scrollLeft /
        (scrollElement.scrollWidth - scrollElement.clientWidth)
      const numSnapElements: number = this.snapPoints.getElementsByTagName(
        'snap'
      ).length
      // snaps happen on <snap>'s left boundaries
      const numSnapLocations: number = numSnapElements - 1
      return Math.round(currentScrollRatio * numSnapLocations)
    }
  }

  // TODO(theis): could use a more strict type-hint (number[][]|string[][])
  // but this has the TS type-schecker fail, considering the map method (which
  // receives a union type itself) non-callable
  // see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
  updateConditioningMap(
    mask: boolean[][],
    currentConditioningMap: Map<string, (number | string)[][]>
  ): Map<string, (number | string)[][]> {
    // retrieve up-to-date user-selected conditioning
    const newConditioning_value = new Map<string, number | string>()
    newConditioning_value.set('pitch', this.midiPitchConstraint)
    newConditioning_value.set(
      'instrument_family_str',
      this.instrumentConstraintSelect.value
    )

    for (const [
      modality,
      conditioning_map,
    ] of currentConditioningMap.entries()) {
      currentConditioningMap.set(
        modality,
        conditioning_map.map((row: (number | string)[], row_index: number) => {
          return row.map(
            (
              currentConditioning_value: number | string,
              column_index: number
            ) => {
              if (mask[row_index][column_index]) {
                return newConditioning_value.get(modality)
              } else {
                return currentConditioning_value
              }
            }
          )
        })
      )
    }
    return currentConditioningMap
  }

  protected get numRows(): number {
    return this.sequencer.rows
  }

  protected get numColumns(): number {
    return this.sequencer.columns
  }

  protected get numColumnsTotal(): number {
    return this.activeCodemap[0].length
  }

  protected get columnWidth(): number {
    if (this.sequencer.cells.length > 0) {
      return (
        this.sequencer.cells[0].width +
        2 * this.sequencer.cells[0].paddingColumn
      )
    } else {
      return 0
    }
  }

  // Duration of the current sound in number of columns at the Top-layer scale
  public get vqvaeTimestepsTop(): number {
    if (this.codemap_top != null) {
      return this.codemap_top[0].length
    } else {
      return 4 // HACK(theis, 2021/07/30): default value hardcoded here
    }
  }

  protected _numColumnsTop = 4
  // Number of columns / time-range of the Top VQVAE-layer
  // Note: This is used to establish the scrolling behavior
  protected get numColumnsTop(): number {
    return this._numColumnsTop
  }
  protected set numColumnsTop(numColumnsTop: number) {
    this._numColumnsTop = numColumnsTop
  }

  public ontoggle(): void {
    // called every time the interface changes
    if (window.navigator.vibrate) {
      // Vibration API is available, perform haptic feedback
      window.navigator.vibrate(30)
    }
  }

  public render(
    numRows: number,
    numColumns: number,
    numColumnsTop: number
  ): void {
    if (this.sequencer !== null) {
      this.sequencer.destroy()
    }
    this.drawTimestampBoxes(numRows, numColumns, numColumnsTop)
    this.insertGridExpansionIcons()

    $(() => {
      this.sequencer.on('toggle', this.ontoggle.bind(this.sequencer))
    })

    this.refresh()
  }

  protected _refresh(): void {
    this.resize()
    this.scrollbar.recalculate()
  }

  // TODO(theis, 2021/08/02):
  // insert Plus/Minus-sign icons for adding and removing codemap columns
  // Allows to expand or shrink a sound in time
  protected insertGridExpansionIcons(): void {
    log.info('TODO: implement insertGridExpansionIcons')
    // throw new Error('Not implemented yet')
  }

  public resize(): void {
    // restore default height for spectrogram image
    this.imageElement.style.removeProperty('height')
    this.imageContainer.style.removeProperty('height')

    const width = this.interfaceContainer.clientWidth
    const height = this.imageContainer.clientHeight
    this.sequencer.resize(width, height)

    this.updateSnapPoints()

    // update image scaling to match snap points
    const timeStepWidth_px: number = width / this.numColumnsTop
    this.imageElement.width = Math.floor(
      timeStepWidth_px * this.vqvaeTimestepsTop
    )
    this.snapPoints.style.width =
      Math.round(timeStepWidth_px * this.numScrollSteps).toString() + 'px'

    const interfaceHeight =
      this.interfaceContainer.clientHeight.toString() + 'px'
    // adapt the spectrogram's image size to the resulting grid's size
    // since the grid size is rounded up to the number of rows and columns
    this.imageElement.style.height = this.imageContainer.style.height = interfaceHeight
  }

  public clear(): void {
    this.sequencer.matrix.populate.all(0)
  }

  public get hasEmptyMask(): boolean {
    // check if the mask contains at least one active cell to regenerate
    return !this.mask.reduce(
      (accumulator, row) =>
        accumulator ||
        row.reduce((accumulator, cellValue) => accumulator || cellValue, false),
      false
    )
  }

  protected get numScrollSteps(): number {
    return this.vqvaeTimestepsTop - this.numColumnsTop + 1
  }

  public drawTimestampBoxes(
    numRows: number,
    numColumns: number,
    numColumnsTop: number,
    gridWidth?: number,
    gridHeight?: number
  ): void {
    const width = gridWidth || this.interfaceContainer.clientWidth
    const height = gridHeight || this.imageContainer.clientHeight
    this.sequencer = new SequencerToggle(this.interfaceContainer, {
      size: [width, height],
      mode: 'toggle',
      rows: numRows,
      columns: numColumns,
    })
    // make the matrix overlay transparent
    this.sequencer.colorize('fill', 'rgba(255, 255, 255, 0.2)')
    this.sequencer.colorize('accent', 'rgba(0, 0, 0, 0.7)')

    this.numColumnsTop = numColumnsTop

    this.resize()
  }

  protected updateSnapPoints(): void {
    if (
      this.snapPoints.getElementsByTagName('snap').length == this.numScrollSteps
    ) {
      return
    }

    // clear existing snap points
    while (this.snapPoints.firstChild) {
      this.snapPoints.removeChild(this.snapPoints.lastChild)
    }
    // create new snap points
    Array(this.numScrollSteps)
      .fill(0)
      .forEach(() => {
        const snapElement = document.createElement('snap')
        this.snapPoints.appendChild(snapElement)
      })
  }

  protected updateNoScroll(): void {
    // when set, prevents the scroll-bar from appearing
    const disableScroll =
      Math.round(this.playbackManager.duration) ==
      Math.round(this.numColumns * this.columnDuration)
    this.container.classList.toggle('no-scroll', disableScroll)
    this.container.getElementsByClassName('simplebar-horizontal')
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.interfaceElement.children.item(index)
  }

  get numInteractiveElements(): number {
    return this.numRows * this.numColumns
  }

  protected setPlayingColumn(columnIndex: number): void {
    return this.sequencer.setPlayingColumn(columnIndex)
  }

  protected clearNowPlayingDisplay(): void {
    return this.sequencer.clearNowPlayingDisplay()
  }

  protected setCurrentlyPlayingPositionDisplay(): void {
    const scaleRatio = this.numColumns / this.numColumnsTop
    const currentlyPlayingColumn: number =
      Math.floor(
        this.playbackManager.transport.progress * this.activeCodemap[0].length
      ) -
      this.getCurrentScrollPositionTopLayer() * scaleRatio

    if (
      currentlyPlayingColumn < 0 ||
      currentlyPlayingColumn > this.numColumns
    ) {
      // desired column is outside the visible range, can happen e.g. before
      // the scroll is updated to the appropriate value
      // clean-up the display
      if (
        this.interfaceContainer.getElementsByClassName('sequencer-playing')
          .length > 0
      ) {
        this.clearNowPlayingDisplay()
      }
      return
    }

    this.setPlayingColumn(currentlyPlayingColumn)
  }

  protected async getAudio(
    inpaintingApiUrl: URL,
    top?: Codemap,
    bottom?: Codemap,
    generationCommand = '/get-audio',
    httpMethod: 'POST' | 'GET' = 'POST'
  ): Promise<Blob> {
    let requestData = ''
    if (httpMethod == 'POST') {
      const payload_object = {
        top_code: top != null ? top : this.codemap_top,
        bottom_code: bottom != null ? bottom : this.codemap_bottom,
      }
      requestData = JSON.stringify(payload_object)
    }

    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    return $.ajax({
      url: generationUrl.href,
      method: httpMethod,
      data: requestData,
      xhrFields: {
        responseType: 'blob',
      },
      contentType: 'application/json',
    })
  }

  protected async getSpectrogramImage(
    inpaintingApiUrl: URL,
    top?: Codemap,
    bottom?: Codemap
  ): Promise<Blob> {
    const payload_object = {
      top_code: top != null ? top : this.codemap_top,
      bottom_code: bottom != null ? bottom : this.codemap_bottom,
    }

    const generationCommand = '/get-spectrogram-image'
    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    return $.post({
      url: generationUrl.href,
      data: JSON.stringify(payload_object),
      xhrFields: {
        responseType: 'blob',
      },
      contentType: 'application/json',
    })
  }

  protected async updateAudio(audioBlob: Blob): Promise<void> {
    // clear previous blob URL
    this.downloadButton.revokeBlobURL()

    // allocate new local blobURL for the received audio
    const blobUrl = URL.createObjectURL(audioBlob)
    this.downloadButton.content = audioBlob

    return this.playbackManager.loadAudio(blobUrl).then(() => {
      this.downloadButton.targetURL = blobUrl
      this.updateNoScroll()
    })
  }

  protected async updateSpectrogramImage(imageBlob: Blob): Promise<void> {
    return new Promise((resolve, _) => {
      const blobUrl = URL.createObjectURL(imageBlob)
      // HACK(theis, 2021_04_25): update the thumbnail stored in the Download button
      // for drag-and-drop, could try and generate the thumbnail only on drag-start
      // to avoid requiring this call here which one could easily forget to perform...
      this.downloadButton.imageContent = imageBlob
      this.imageElement.src = blobUrl
      $(() => {
        URL.revokeObjectURL(blobUrl)
        resolve()
      })
    })
  }

  protected async updateAudioAndImage(
    audioPromise: Promise<Blob>,
    spectrogramImagePromise: Promise<Blob>
  ): Promise<[void, void]> {
    return await Promise.all([audioPromise, spectrogramImagePromise]).then(
      // unpack the received results and update the interface
      ([audioBlob, spectrogramImageBlob]: [Blob, Blob]) => {
        return Promise.all([
          this.updateAudio(audioBlob),
          this.updateSpectrogramImage(spectrogramImageBlob),
        ])
      }
    )
  }

  protected async sendAudio(
    audioBlob: Blob,
    generationCommand: string,
    inpaintingApiUrl = this.defaultApiAddress
  ): Promise<void> {
    this.disableChanges()

    const form = new FormData()
    form.append('audio', audioBlob)

    let newCodes_top: number[][]
    let newCodes_bottom: number[][]
    let newConditioning_top: Map<string, (string | number)[][]>
    let newConditioning_bottom: Map<string, (string | number)[][]>

    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    try {
      const jsonResponse = await $.post({
        url: generationUrl.href,
        data: form,
        contentType: false,
        dataType: 'json',
        processData: false,
      })

      newCodes_top = jsonResponse['top_code']
      newCodes_bottom = jsonResponse['bottom_code']
      newConditioning_top = parseConditioningMap(
        jsonResponse['top_conditioning']
      )
      newConditioning_bottom = parseConditioningMap(
        jsonResponse['bottom_conditioning']
      )

      const audioPromise = this.getAudio(
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )
      const spectrogramImagePromise = this.getSpectrogramImage(
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )

      await this.updateAudioAndImage(audioPromise, spectrogramImagePromise)
    } catch (e) {
      console.log(e)
      this.clear()
      this.enableChanges()
      return
    }

    this.codemap_top = newCodes_top
    this.codemap_bottom = newCodes_bottom
    this.currentConditioning_top = newConditioning_top
    this.currentConditioning_bottom = newConditioning_bottom

    this.clear()
    this.enableChanges()
  }

  /**
   *
   */
  protected async loadAudioAndSpectrogram(
    httpMethod: 'GET' | 'POST',
    inpaintingApiUrl: URL,
    generationCommand: string,
    sendCodesWithRequest: boolean,
    mask?: number[][],
    timeout = 0
  ): Promise<this> {
    this.disableChanges()

    let requestBody: BodyInit | null = null
    if (httpMethod == 'POST') {
      let payload_object = {}
      if (sendCodesWithRequest) {
        payload_object = {
          top_code: this.codemap_top,
          bottom_code: this.codemap_bottom,
          top_conditioning: formatConditioningMap(this.currentConditioning_top),
          bottom_conditioning: formatConditioningMap(
            this.currentConditioning_bottom
          ),
        }
      }
      if (mask != null) {
        // send the mask with low-frequencies first
        payload_object['mask'] = mask.reverse()
      }

      requestBody = JSON.stringify(payload_object)
    }

    let newCodes_top: number[][]
    let newCodes_bottom: number[][]
    let newConditioning_top: Map<string, (string | number)[][]>
    let newConditioning_bottom: Map<string, (string | number)[][]>

    try {
      const generationUrl = new URL(generationCommand, inpaintingApiUrl)
      const abortController = new AbortController()
      const abortTimeout =
        timeout > 0 ? setTimeout(() => abortController.abort(), timeout) : null
      const jsonResponse = await fetch(generationUrl.href, {
        method: httpMethod,
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      })
      clearTimeout(abortTimeout)
      const jsonContent = await jsonResponse.json()

      newCodes_top = jsonContent['top_code']
      newCodes_bottom = jsonContent['bottom_code']
      newConditioning_top = parseConditioningMap(
        jsonContent['top_conditioning']
      )
      newConditioning_bottom = parseConditioningMap(
        jsonContent['bottom_conditioning']
      )

      const audioPromise = this.getAudio(
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )
      const spectrogramImagePromise = this.getSpectrogramImage(
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )

      await this.updateAudioAndImage(audioPromise, spectrogramImagePromise)
    } catch (e) {
      console.log(e)
      this.enableChanges()
      throw e
    }

    this.codemap_top = newCodes_top
    this.codemap_bottom = newCodes_bottom
    this.currentConditioning_top = newConditioning_top
    this.currentConditioning_bottom = newConditioning_bottom

    this.refresh()
    this.clear()
    this.enableChanges()
    return this
  }

  // sample(
  //   inpaintingApiUrl = this.defaultApiAddress,
  //   timeout = 10000
  // ): Promise<this> {
  //   return super.sample(inpaintingApiUrl, timeout).then(
  //     () => {
  //       this.enableChanges()
  //       mapTouchEventsToMouseSimplebar()
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
  async sample(
    inpaintingApiUrl = this.defaultApiAddress,
    timeout = 10000
  ): Promise<this> {
    const audioBlob = await this.getAudio(
      inpaintingApiUrl,
      null,
      null,
      'sample-from-dataset-audio' + this.restParameters,
      'GET'
    )
    await this.sendAudio(
      audioBlob,
      'analyze-audio' + this.restParameters,
      inpaintingApiUrl
    )
    return this
  }

  protected dropHandler(e: DragEvent): Promise<void> {
    // Prevent default behavior (Prevent file from being opened)
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile()
          console.log(`... file[${i}].name = ` + file.name)
          const generationParameters =
            '?pitch=' +
            this.midiPitchConstraint.toString() +
            '&instrument_family_str=' +
            this.instrumentConstraint
          return this.sendAudio(file, 'analyze-audio' + generationParameters)
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        console.log(`... file[${i}].name = ` + e.dataTransfer.files[i].name)
      }
    }
    return new Promise<void>((resolve) => resolve())
  }
}

// TODO(@tbazin, 2021/08/05): move this inside SheetLocator
// Drag and Drop
// Allow drag and drop of one timeContainer's content onto another
function ondragstartTimecontainer_handler(event: DragEvent) {
  // perform a copy operation of the data in the time container
  event.dataTransfer.dropEffect = 'copy'
  // Store the dragged container's ID to allow retrieving it from the drop
  // target
  const targetID: string = (<HTMLElement>event.target).id
  event.dataTransfer.setData('text/plain', targetID)
}

function ondragoverTimecontainer_handler(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function ondragenterTimecontainer_handler(event: DragEvent) {
  ;(<HTMLElement>event.target).classList.add('dragover')
}

function ondragleaveTimecontainer_handler(event: DragEvent) {
  ;(<HTMLElement>event.target).classList.remove('dragover')
}

function makeOndropTimecontainer_handler(
  copyTimecontainerContent: (origin: HTMLElement, target: HTMLElement) => void
) {
  return function (event: DragEvent) {
    // only allow drop if the source of the drag was a time-container
    const sourceID: string = event.dataTransfer.getData('text/plain')
    const sourceElement: HTMLElement = document.getElementById(sourceID)
    const isValidID: boolean = sourceElement != null
    if (isValidID && sourceElement.classList.contains('notebox')) {
      event.preventDefault()
      const targetElement: HTMLElement = <HTMLElement>event.target
      copyTimecontainerContent(
        sourceElement.parentElement,
        targetElement.parentElement
      )

      // clean-up after drag
      targetElement.classList.remove('dragover')
    }
  }
}
