import $ from 'jquery'
import 'nipplejs'
import log from 'loglevel'

import {
  OpenSheetMusicDisplay,
  Fraction,
  IOSMDOptions,
} from 'opensheetmusicdisplay'
import { FermataBox } from './fermata'
import { ChordSelector } from './chord_selector'

import '../common/styles/overlays.scss'

import Nexus from './nexusColored'

export abstract class Locator {
  readonly container: HTMLElement
  protected resizeTimeoutDuration = 0
  protected resizeTimeout: NodeJS.Timeout

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

  callToActionHighlightedCells = 16

  // triggers an animation to catch the user's eye
  public callToAction(
    hightlightedCellsNumber = this.callToActionHighlightedCells
  ): void {
    function delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    let promise = Promise.resolve()
    const interval = 100

    const randomIndexes: number[] = Array(hightlightedCellsNumber)
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

    promise.then(() => {
      setTimeout(() => {
        randomIndexes.forEach((index) => {
          const element = this.getInterfaceElementByIndex(index)

          if (element != null) {
            element.classList.remove('highlight')
          }
        })
      }, 4 * interval * hightlightedCellsNumber)
    })
  }

  // retrieve interactive elements of the interface by index
  abstract getInterfaceElementByIndex(index: number): Element | null

  abstract get numInteractiveElements(): number

  public constructor(container: HTMLElement, ...args) {
    this.container = container
    this.registerRefreshOnResizeListener()
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

  // set currently playing interface position by time index
  abstract setCurrentlyPlayingPositionDisplay(timePosition: number): void

  static readonly scrollLockClass = 'scroll-lock'
  protected readonly scrollElementsClassNames: string = 'simplebar-track'

  get scrollElements(): Element[] {
    const scrollbars = this.container.getElementsByClassName(
      this.scrollElementsClassNames
    )
    if (scrollbars.length > 0) {
      return Array.from(scrollbars)
    } else {
      throw new EvalError('No scroll-element not found')
    }
  }

  get isScrollLocked(): boolean {
    return this.scrollElements[0].classList.contains(Locator.scrollLockClass)
  }

  registerScrollLockCallback(): void {
    this.scrollElements.forEach((element) =>
      element.addEventListener('click', function (this: HTMLElement): void {
        this.classList.toggle(Locator.scrollLockClass)
      })
    )
  }
}

export class SheetLocator extends Locator {
  constructor(
    container: HTMLElement,
    options: IOSMDOptions,
    boxDurations_quarters: number[],
    annotationTypes: string[] = [],
    allowOnlyOneFermata = false,
    onClickTimestampBoxFactory?: (
      timeStart: Fraction,
      timeEnd: Fraction
    ) => (event: PointerEvent) => void,
    copyTimecontainerContent?: (
      origin: HTMLElement,
      target: HTMLElement
    ) => void
  ) {
    super(container)
    /*
     * Create a container element for OpenSheetMusicDisplay...
     */
    this.container.classList.add('sheet-locator')
    this.container.setAttribute('data-simplebar', '')
    this.container.setAttribute('data-simplebar-auto-hide', 'false')
    this.container.setAttribute('data-simplebar-click-on-track', 'false')

    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.id = this.container.id + '-overlays'
    this.interfaceContainer.classList.add('sheet-locator-overlays')
    this.container.appendChild(this.interfaceContainer)

    this.sheetContainer = document.createElement('div')
    this.sheetContainer.id = this.container.id + '-interface'
    this.sheetContainer.classList.add('sheet-locator-sheet')
    this.interfaceContainer.appendChild(this.sheetContainer)

    // initialize OSMD renderer
    this.sheet = new OpenSheetMusicDisplay(this.sheetContainer, options)
    this.sheet.EngravingRules.RenderMultipleRestMeasures = false
    this.sheet.EngravingRules.VoiceSpacingMultiplierVexflow = 1
    this.sheet.EngravingRules.VoiceSpacingAddendVexflow = 10.0

    this._annotationTypes = annotationTypes
    this._boxDurations_quarters = boxDurations_quarters
    this._allowOnlyOneFermata = allowOnlyOneFermata
    this.onClickTimestampBoxFactory = onClickTimestampBoxFactory
    this.copyTimecontainerContent = copyTimecontainerContent

    $(() => this.registerScrollLockCallback())
  }
  protected resizeTimeoutDuration = 50

  readonly interfaceContainer: HTMLElement
  readonly sheetContainer: HTMLElement

  protected readonly scrollElementsClassNames =
    'simplebar-track simplebar-horizontal'

  readonly sheet: OpenSheetMusicDisplay
  protected get graphicElement(): SVGElement | null {
    return this.sheetContainer.getElementsByTagName('svg').item(0)
  }

  protected onClickTimestampBoxFactory?: (
    timeStart: Fraction,
    timeEnd: Fraction
  ) => (event: PointerEvent) => void

  private _boxDurations_quarters: number[]

  private _annotationTypes: string[]
  private _allowOnlyOneFermata: boolean

  private copyTimecontainerContent: (
    origin: HTMLElement,
    target: HTMLElement
  ) => void

  public get annotationTypes(): string[] {
    return this._annotationTypes
  }

  public get allowOnlyOneFermata(): boolean {
    return this._allowOnlyOneFermata
  }

  public get boxDurations_quarters(): number[] {
    return this._boxDurations_quarters
  }

  private _chordSelectors = new Map<string, ChordSelector>()

  public get chordSelectors(): ChordSelector[] {
    return Array.from(this._chordSelectors.values())
  }

  private _fermatas = new Map<string, FermataBox>()

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
  private computePositionZoom(value: number, shift = 1): number {
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
  private updateTimeContainerSize(
    divId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const commonDivId = divId + '-common'
    const commonDiv =
      document.getElementById(commonDivId) || document.createElement('div')

    commonDiv.style.top = this.computePositionZoom(y, 0) + 'px'
    commonDiv.style.height = this.computePositionZoom(height, 0) + 'px'
    commonDiv.style.left = this.computePositionZoom(x, 1) + 'px'
    commonDiv.style.width = this.computePositionZoom(width) + 'px'
  }

  /*
    Create an overlay box with given shape and assign it the given divClass
    */
  private createTimeContainer(
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
      div.classList.add('available')
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

      const granularitySelect: HTMLSelectElement = <HTMLSelectElement>(
        $('#granularity-select-container select')[0]
      )
      const currentGranularity: number = parseInt(
        granularitySelect.options[parseInt(granularitySelect.value)].innerText
      )
      if (currentGranularity == duration_quarters) {
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
        function (event: WheelEvent) {
          event.preventDefault()
          const scrollUp = -event.deltaY >= 0
          cycleGranularity(scrollUp)
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
        makeOndropTimecontainer_handler(this.copyTimecontainerContent),
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
    const onclickFactory = this.onClickTimestampBoxFactory
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
          let onclick: (event: PointerEvent) => void = () => {
            return
          }
          if (onclickFactory) {
            onclick = onclickFactory(currentBeginTimestamp, currentEndTimestamp)
          }

          const timeContainerID = SheetLocator.makeGranularityID(
            boxDuration_quarters,
            measureIndex,
            boxIndex
          )

          if (!document.getElementById(timeContainerID)) {
            // the time container does not yet exist, create it
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

  protected get activeElements() {
    return this.interfaceContainer.getElementsByClassName('notebox active')
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.activeElements.item(index)
  }

  get numInteractiveElements(): number {
    return this.activeElements.length
  }

  setCurrentlyPlayingPositionDisplay(progress: number): void {
    const timePosition = Math.round(progress * this.sequenceDuration_quarters)

    $('.notebox').removeClass('playing')
    $(
      `.timeContainer[containedQuarterNotes~='${timePosition}'] .notebox`
    ).addClass('playing')
  }
}

type Cell = {
  row: number
  column: number
}

// monkey-patch Nexus.Sequencer to emit 'toggle' events
// these are triggered only on actual changes of the pattern,
// as opposed to the 'change' events which can be emitted even though the actual
// content of the matrix does not change (e.g. when touching the same cell twice
// in a single Touch action)
class SequencerToggle extends Nexus.Sequencer {
  // TODO(theis): add proper types (create typing for Nexus.\)
  matrix: any
  emit: any
  element: HTMLDivElement
  stepper: any
  rows: any
  columns: any
  destroy: any
  resize: any
  colorize: any
  on: any
  cells: any

  inRectangularSelection = false
  firstCell?: Cell
  previousCell?: Cell
  rectangularSelections = true

  constructor(container, options) {
    super(container, options)

    if (this.rectangularSelections) {
      this.element.addEventListener(
        'pointerup',
        this.onInteractionEnd.bind(this)
      )
      this.element.addEventListener(
        'pointercancel',
        this.onInteractionEnd.bind(this)
      )

      this.element.addEventListener(
        'pointerdown',
        this.onInteractionStart.bind(this)
      )
    }
  }

  protected onInteractionEnd(): void {
    log.debug('Finished interaction')
    this.inRectangularSelection = false
    this.firstCell = null
    this.previousCell = null
    return
  }

  protected onInteractionStart(cell: Cell): void {
    log.debug('Starting interaction')
    this.inRectangularSelection = true
    return
  }

  protected getIndex(cell: Cell): number {
    return this.matrix.indexOf(cell.row, cell.column)
  }

  protected turnOn(cell: Cell, emitting: boolean) {
    this.cells[this.matrix.indexOf(cell.row, cell.column)].turnOn(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 1
    }
  }

  protected turnOff(cell: Cell, emitting: boolean) {
    this.cells[this.matrix.indexOf(cell.row, cell.column)].turnOff(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 0
    }
  }

  protected keyChange(note, on: boolean) {
    const cell = <Cell>this.matrix.locate(note)
    const previousState = this.matrix.pattern[cell.row][cell.column]

    if (previousState !== on) {
      const data = {
        row: cell.row,
        column: cell.column,
        state: on,
      }
      this.emit('toggle', data)
    }

    if (this.rectangularSelections && this.inRectangularSelection) {
      if (this.firstCell == null) {
        this.firstCell = cell
        this.previousCell = cell
      } else {
        // TODO(theis, 2021/05/21): could maybe be more efficient by just computing
        // the delta of cells to turn on and cells to turn off by using the
        // previous position of the pointer.
        //  This brute-force version probably has the advantage of being more robust
        // to very fast mouse movements though, which could lead to `this.previousCell`'s
        // value not being accurate, resulting in a mismatched update.

        // turn all cells off
        for (let index = 0; index < this.matrix.length; index++) {
          const cell = <Cell>this.matrix.locate(index)
          this.turnOff(cell, false)
        }

        // activate all cells in the rectangle between the first cell
        // of the interaction and the current cell
        const rectangleStart: Cell = {
          row: Math.min(this.firstCell.row, cell.row),
          column: Math.min(this.firstCell.column, cell.column),
        }
        const rectangleEnd: Cell = {
          row: Math.max(this.firstCell.row, cell.row),
          column: Math.max(this.firstCell.column, cell.column),
        }
        for (let row = rectangleStart.row; row <= rectangleEnd.row; row++) {
          for (
            let column = rectangleStart.column;
            column <= rectangleEnd.column;
            column++
          ) {
            const cell: Cell = { row: row, column: column }
            this.turnOn(cell, false)
          }
        }
      }
      this.previousCell = cell
    }
    super.keyChange(note, on)
  }
}

export class SpectrogramLocator extends Locator {
  readonly shadowContainer: HTMLElement
  readonly interfaceContainer: HTMLElement
  readonly snapPoints: HTMLDivElement
  protected sequencer: SequencerToggle

  get interfaceElement(): HTMLDivElement {
    return this.sequencer.element
  }

  // TODO(theis): should provide initial values for numRows and numColumns,
  // so that the instance can be properly rendered/refreshed on initialization
  constructor(container: HTMLElement, options: Record<string, unknown> = {}) {
    super(container)

    const spectrogramImageContainerElement = document.createElement('div')
    // TODO(theis, 2021/06/02): switch to class-based styling instead of referring
    // to the interface elements via their ID in the CSS, and switch
    // to this.container.id + '...'-style IDs for the different blocks
    spectrogramImageContainerElement.id = 'spectrogram-image-container'
    spectrogramImageContainerElement.toggleAttribute('data-simplebar', true)
    spectrogramImageContainerElement.setAttribute(
      'data-simplebar-click-on-track',
      'false'
    )
    this.container.appendChild(spectrogramImageContainerElement)

    const spectrogramPictureElement = document.createElement('picture')
    spectrogramPictureElement.id = 'spectrogram-picture'
    spectrogramImageContainerElement.appendChild(spectrogramPictureElement)
    const spectrogramImageElement = document.createElement('img')
    spectrogramImageElement.id = 'spectrogram-image'
    spectrogramPictureElement.appendChild(spectrogramImageElement)

    this.snapPoints = document.createElement('div')
    this.snapPoints.id = 'snap-points'
    spectrogramPictureElement.appendChild(this.snapPoints)

    // necessary to handle 'busy' state cursor change and pointer events disabling
    this.interfaceContainer = document.createElement('div')
    this.interfaceContainer.id = this.container.id + '-interface-container'
    this.container.appendChild(this.interfaceContainer)

    this.shadowContainer = document.createElement('div')
    this.shadowContainer.id = this.container.id + '-shadow-container'
    this.shadowContainer.classList.add('glow-shadow')
    this.interfaceContainer.appendChild(this.shadowContainer)

    const initialWidth = this.interfaceContainer.clientWidth
    const initialHeight = this.interfaceContainer.clientHeight

    this.sequencer = new SequencerToggle(this.interfaceContainer.id, {
      size: [initialWidth, initialHeight],
      mode: 'toggle',
      rows: 32,
      columns: 4,
    })
    this.sequencer.colorize('accent', 'rgba(255, 255, 255, 1)')
    this.sequencer.colorize('fill', 'rgba(255, 255, 255, 0.25)')
  }

  public get mask(): number[][] {
    return this.sequencer.matrix.pattern
  }

  private _boxDurations_quarters: number[]

  public get boxDurations_quarters(): number[] {
    return this._boxDurations_quarters
  }

  public registerCallback(callback: () => void): void {
    const registerReleaseCallback = () => {
      // call the actual callback on pointer release to allow for click and drag
      document.addEventListener(
        'pointerup',
        () => {
          if (!this.isEmpty()) {
            callback.bind(this)()
          }
        },
        { once: true } // eventListener removed after being called
      )
    }

    this.interfaceContainer.addEventListener(
      'pointerdown',
      registerReleaseCallback
    )
  }

  setPosition(timePosition: number): void {
    this.sequencer.stepper.value = timePosition
  }

  protected get numRows(): number {
    return this.sequencer.rows
  }

  protected get numColumns(): number {
    return this.sequencer.columns
  }

  protected _vqvaeTimestepsTop = 4
  public get vqvaeTimestepsTop(): number {
    return this._vqvaeTimestepsTop
  }
  public set vqvaeTimestepsTop(vqvaeTimestepsTop: number) {
    this._vqvaeTimestepsTop = vqvaeTimestepsTop
    this.toggleNoscroll(this.numScrollSteps == 1)
  }

  protected _numColumnsTop = 4
  protected get numColumnsTop(): number {
    return this._numColumnsTop
  }
  protected set numColumnsTop(numColumnsTop: number) {
    this._numColumnsTop = numColumnsTop
    this.toggleNoscroll(this.numColumnsTop == 1)
  }

  public ontoggle(data: number[][]): void {
    // called every time the interface changes
    if (window.navigator.vibrate) {
      // Vibration API is available, perform haptic feedback
      window.navigator.vibrate(10)
    }
  }

  public render(
    numRows: number,
    numColumns: number,
    numColumnsTop: number,
    onclickFactory = undefined
  ): void {
    if (this.sequencer !== null) {
      this.sequencer.destroy()
    }
    this.drawTimestampBoxes(onclickFactory, numRows, numColumns, numColumnsTop)

    $(() => {
      // wait for all 'change' events to have been emitted
      this.sequencer.on('toggle', this.ontoggle)
    })
  }

  protected _refresh(): void {
    this.resize()
  }

  public resize(): void {
    const spectrogramImageContainerElement = document.getElementById(
      'spectrogram-image-container'
    )
    const spectrogramImageElement = this.container.getElementsByTagName(
      'img'
    )[0]

    // restore default height for spectrogram image
    spectrogramImageElement.style.removeProperty('height')
    spectrogramImageContainerElement.style.removeProperty('height')

    const width = this.interfaceContainer.clientWidth
    const height = spectrogramImageContainerElement.clientHeight

    this.sequencer.resize(width, height)

    // update image scaling to match snap points
    const timeStepWidth_px: number = width / this.numColumnsTop
    spectrogramImageElement.width = Math.floor(
      timeStepWidth_px * this.vqvaeTimestepsTop
    )
    this.snapPoints.style.width =
      Math.round(timeStepWidth_px * this.numScrollSteps).toString() + 'px'

    // adapt the spectrogram's image size to the resulting grid's size
    // since the grid size is rounded up to the number of rows and columns
    spectrogramImageElement.style.height =
      this.interfaceContainer.clientHeight.toString() + 'px'
    spectrogramImageContainerElement.style.height =
      this.interfaceContainer.clientHeight.toString() + 'px'
  }

  public clear(): void {
    this.sequencer.matrix.populate.all(0)
  }

  public isEmpty(): boolean {
    // check if the mask contains at least one active cell to regenerate
    return (
      this.mask.reduce(
        (acc, val) => acc + val.reduce((acc, val) => acc + val, 0),
        0
      ) == 0
    )
  }

  protected get numScrollSteps(): number {
    return this.vqvaeTimestepsTop - this.numColumnsTop + 1
  }

  public drawTimestampBoxes(
    onclickFactory: undefined,
    numRows: number,
    numColumns: number,
    numColumnsTop: number
  ): void {
    const spectrogramImageContainerElement = document.getElementById(
      'spectrogram-image-container'
    )
    const spectrogramImageElement = this.container.getElementsByTagName(
      'img'
    )[0]

    // restore default height for spectrogram image
    spectrogramImageElement.style.removeProperty('height')
    spectrogramImageContainerElement.style.removeProperty('height')

    const width = this.interfaceContainer.clientWidth
    const height = spectrogramImageContainerElement.clientHeight

    this.sequencer = new SequencerToggle(this.interfaceContainer.id, {
      size: [width, height],
      mode: 'toggle',
      rows: numRows,
      columns: numColumns,
    })

    this.numColumnsTop = numColumnsTop
    // make the matrix overlay transparent
    this.sequencer.colorize('accent', 'rgba(255, 255, 255, 1)')
    this.sequencer.colorize('fill', 'rgba(255, 255, 255, 0.4)')

    this.updateSnapPoints()

    // update image scaling to match snap points
    const timeStepWidth_px: number = width / numColumnsTop
    spectrogramImageElement.width = Math.floor(
      timeStepWidth_px * this.vqvaeTimestepsTop
    )
    this.snapPoints.style.width =
      Math.round(timeStepWidth_px * this.numScrollSteps).toString() + 'px'

    // adapt the spectrogram's image size to the resulting grid's size
    // since the grid size is rounded up to the number of rows and columns
    spectrogramImageElement.style.height =
      this.interfaceContainer.clientHeight.toString() + 'px'
    spectrogramImageContainerElement.style.height =
      this.interfaceContainer.clientHeight.toString() + 'px'
  }

  protected updateSnapPoints(): void {
    // clear existing snap points
    while (this.snapPoints.firstChild) {
      this.snapPoints.removeChild(this.snapPoints.lastChild)
    }

    this.toggleNoscroll(this.numScrollSteps == 1)
    Array(this.numScrollSteps)
      .fill(0)
      .forEach(() => {
        const snapElement = document.createElement('snap')
        this.snapPoints.appendChild(snapElement)
      })
  }

  protected toggleNoscroll(force?: boolean): void {
    // when set, prevents the scroll-bar from appearing
    this.container.classList.toggle('no-scroll', force)
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.interfaceElement.children.item(index)
  }

  get numInteractiveElements(): number {
    return this.numRows * this.numColumns
  }

  protected highlightColumn(columnIndex: number): void {
    throw new Error('Not implemented')
  }

  setCurrentlyPlayingPositionDisplay(progress: number) {
    const currentlyPlayingColumn: number = Math.round(
      progress * this.numColumns
    )
    this.highlightColumn(currentlyPlayingColumn)
  }
}

function cycleGranularity(increase: boolean) {
  const granularitySelect = $('#granularity-select-container select')
  // if (granularitySelect.length > 0) {
  const granularitySelectElement = <HTMLSelectElement>granularitySelect[0]
  // let granularitySelectElement: HTMLSelectElement = <HTMLSelectElement>document.getElementById('select-granularity').children[0]
  const selectedGranularity = parseInt(granularitySelect.val().toString())
  const numOptions = granularitySelectElement.children.length

  if (increase) {
    granularitySelectElement.value = Math.min(
      selectedGranularity + 1,
      numOptions - 1
    ).toString()
  } else {
    granularitySelectElement.value = Math.max(
      selectedGranularity - 1,
      0
    ).toString()
  }

  // trigger `onchange` callback
  granularitySelectElement.dispatchEvent(new Event('change'))
  // }
}

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

// TODO replace this with using a Promise<eOSMD> in the renderZoomControl function
let zoomTargetOSMD
export function registerZoomTarget(sheetLocator: SheetLocator): void {
  zoomTargetOSMD = sheetLocator
}

export async function renderZoomControls(
  containerElement: HTMLElement
): Promise<void> {
  // let osmd_target = await osmd_target_promise;
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

  zoomOutButton.addEventListener('click', function () {
    zoomTargetOSMD.sheet.Zoom /= 1.2
    zoomTargetOSMD.render()
    log.info(`OSMD zoom level now: ${zoomTargetOSMD.sheet.Zoom}`)
  })
  zoomInButton.addEventListener('click', function () {
    zoomTargetOSMD.sheet.Zoom *= 1.2
    zoomTargetOSMD.render()
    log.info(`OSMD zoom level now: ${zoomTargetOSMD.sheet.Zoom}`)
  })
}
