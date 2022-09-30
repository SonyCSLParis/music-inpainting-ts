import log from 'loglevel'
import $ from 'jquery'
import { Canvg } from 'canvg'

import {
  InpainterGraphicalView,
  LoadingDisplay,
} from '../inpainter/inpainterGraphicalView'
import { SheetData, SheetInpainter } from './sheetInpainter'
import MidiSheetPlaybackManager from '../sheetPlayback'

import {
  OpenSheetMusicDisplay,
  Fraction,
  IOSMDOptions,
} from 'opensheetmusicdisplay'
import { FermataBox } from '../fermata'
import { ChordSelector } from '../chord_selector'
import type { Chord } from '../chord'
import { VariableValue } from '../cycleSelect'
import { ScrollLockSimpleBar } from '../utils/simplebar'

class SheetInpainterGraphicalViewBase extends InpainterGraphicalView<
  SheetData,
  SheetInpainter,
  MidiSheetPlaybackManager<SheetInpainter>,
  number
> {
  get isRendered(): boolean {
    return this.sheet.GraphicSheet.MusicPages.length > 0
  }
  readonly dataType = 'sheet'

  constructor(
    sheetInpainter: SheetInpainter,
    sheetPlaybackManager: MidiSheetPlaybackManager,
    container: HTMLElement,
    granularitiesSelect: VariableValue<number>,
    options: IOSMDOptions,
    annotationTypes: string[] = [],
    allowOnlyOneFermata = false
  ) {
    super(
      sheetInpainter,
      sheetPlaybackManager,
      container,
      granularitiesSelect,
      SheetInpainterGraphicalViewBase.displayUpdateRate
    )
    this.container.classList.add('sheet-inpainter')
    this.interfaceContainer.classList.add('sheet-inpainter-stacking-container')
    this.overlaysContainer = document.createElement('div')
    this.overlaysContainer.classList.add('sheet-inpainter-overlays')
    this.interfaceContainer.appendChild(this.overlaysContainer)

    this.sheetContainer = document.createElement('div')
    this.sheetContainer.classList.add('sheet-inpainter-sheet')
    this.interfaceContainer.appendChild(this.sheetContainer)

    // initialize OSMD renderer
    this.sheet = new OpenSheetMusicDisplay(this.sheetContainer, options)
    this.sheet.EngravingRules.RenderMultipleRestMeasures = false
    this.sheet.EngravingRules.VoiceSpacingMultiplierVexflow = 1
    this.sheet.EngravingRules.VoiceSpacingAddendVexflow = 10.0

    this.annotationTypes = annotationTypes
    this.allowOnlyOneFermata = allowOnlyOneFermata

    this.boxDurations_quarters = this.granularitySelect.options

    this.scrollbar = new ScrollLockSimpleBar(this.container, {
      autoHide: false,
      clickOnTrack: false,
    })
  }

  protected async onInpainterChange(data: SheetData): Promise<void> {
    // save current zoom level to restore it after load
    const zoom = this.sheet.Zoom
    await this.sheet.load(data.sheet)
    this.sheet.Zoom = zoom
    this.render()
    super.onInpainterChange(data)
  }

  get queryParameters(): string[] {
    return super.queryParameters
  }

  protected onchangeGranularity(): void {
    const durationCSSClass: string =
      SheetInpainterGraphicalView.makeGranularityCSSClass(this.granularity)
    Array.from(
      this.interfaceContainer.getElementsByClassName('notebox')
    ).forEach((notebox) =>
      notebox.classList.toggle(
        'active',
        notebox.parentElement.classList.contains(durationCSSClass)
      )
    )
  }

  protected resizeTimeoutDuration = 50

  readonly overlaysContainer: HTMLElement
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

    const timerangeQueryParameters = [
      `time_range_start_quarter=${timeRangeStart_quarter}`,
      `time_range_end_quarter=${timeRangeEnd_quarter}`,
    ]

    return () => {
      const metadata = this.getMetadata()
      // TODO(theis, 2021-08-10): use inpainter.inpaint method
      void this.inpainter.inpaint(
        [...this.queryParameters, ...timerangeQueryParameters],
        undefined,
        metadata
      )
    }
  }

  protected async copyTimecontainerContent(
    origin: HTMLElement,
    target: HTMLElement
  ): Promise<SheetInpainter> {
    // retrieve quarter-note positions for origin and target
    function getContainedQuarters(timeContainer: HTMLElement): number[] {
      return timeContainer
        .getAttribute('containedQuarterNotes')
        .split(', ')
        .map((x) => parseInt(x, 10))
    }
    const originContainedQuarters = getContainedQuarters(origin)
    const targetContainedQuarters = getContainedQuarters(target)

    const originStart_quarter = originContainedQuarters[0]
    const targetStart_quarter = targetContainedQuarters[0]
    const originEnd_quarter = originContainedQuarters.pop()
    const targetEnd_quarter = targetContainedQuarters.pop()

    const copyQueryParameters = [
      `origin_start_quarter=${originStart_quarter}`,
      `origin_end_quarter=${originEnd_quarter}`,
      `target_start_quarter=${targetStart_quarter}`,
      `target_end_quarter=${targetEnd_quarter}`,
    ]
    return this.inpainter.apiRequestHelper(
      'POST',
      'copy',
      [...this.queryParameters, ...copyQueryParameters],
      this.inpainter.defaultApiAddress,
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

  protected _render(): void {
    this.updateContainerWidth(false)
    this.sheet.render()
    this.drawTimestampBoxes()
    this.sheetContainer.setAttribute(
      'sequenceDuration_quarters',
      this.sequenceDuration_quarters.toString()
    )
    this.updateContainerWidth(true)
  }

  protected zoomCallback(zoomIn: boolean): void {
    if (zoomIn) {
      this.sheet.Zoom *= 1.1
    } else {
      this.sheet.Zoom /= 1.1
    }
    this.render()
    log.info(`OSMD zoom level now: ${this.sheet.Zoom}`)
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
      !this.graphicElement?.hasAttribute('viewBox')
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
    onclick: (event?: PointerEvent) => void,
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
        SheetInpainterGraphicalViewBase.makeGranularityCSSClass(
          duration_quarters
        )
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

      if (this.granularitySelect.value == duration_quarters) {
        div.classList.add('active')
      }

      div.addEventListener('click', onclick)
      // use bubbling and preventDefault to block window scrolling
      div.addEventListener(
        'wheel',
        (event: WheelEvent) => {
          event.preventDefault()
          const scrollUp = -event.deltaY >= 0
          const looping = false
          if (scrollUp) {
            this.granularitySelect.next(looping)
          } else {
            this.granularitySelect.previous(looping)
          }
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
      this.overlaysContainer.appendChild(commonDiv)
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
          let xBeginBox =
            this.sheet.GraphicSheet.calculateXPositionFromTimestamp(
              currentBeginTimestamp
            )[0]

          let xEndBox: number
          if (currentEndTimestamp.lt(measureEndTimestamp)) {
            // x-coordinates for the bounding box
            xEndBox =
              this.sheet.GraphicSheet.calculateXPositionFromTimestamp(
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

          const timeContainerID =
            SheetInpainterGraphicalViewBase.makeGranularityID(
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
    // const transport = this.playbackManager.transport
    // const startOffset = transport.toSeconds(transport.loopStart)
    // const loopDuration =
    //   transport.toSeconds(transport.loopEnd) -
    //   transport.toSeconds(transport.loopStart)
    // const timePosition = Math.floor(
    //   startOffset +
    //     (progress + transport.context.lookAhead / loopDuration) * loopDuration
    // )
    const timePosition = this.totalProgressToStep(progress)

    Array.from(
      this.overlaysContainer.getElementsByClassName('notebox playing')
    ).forEach((notebox) => notebox.classList.remove('playing'))
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
      const lastStepIndex = this.totalProgressToStep(1) - 1
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

  protected getTimecontainerPosition(step: number): {
    left: number
    right: number
  } {
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

  protected totalProgressToStep(progress: number): number {
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

  async getSheetAsPNG(): Promise<Blob | null> {
    if (this.graphicElement == null || typeof OffscreenCanvas == 'undefined') {
      return null
    }
    const canvas = new OffscreenCanvas(
      this.graphicElement.clientWidth,
      this.graphicElement.clientHeight
    )
    const context = canvas.getContext('2d')
    if (context == null) {
      return null
    }

    const serializer = new XMLSerializer()
    const canvg = await Canvg.from(
      context,
      serializer.serializeToString(this.graphicElement)
    )
    await canvg.render()
    const blob = await canvas.convertToBlob()
    return blob
  }
}

// TODO(@tbazin, 2021/08/05): move this inside SheetInpainter
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
    const targetElement: HTMLElement = <HTMLElement>event.target
    const isValidID: boolean = sourceElement != null
    if (isValidID && sourceElement.classList.contains('notebox')) {
      event.preventDefault()
      copyTimecontainerContent(
        sourceElement.parentElement,
        targetElement.parentElement
      )
    }
    // clean-up after drag
    targetElement.classList.remove('dragover')
  }
}

export class SheetInpainterGraphicalView extends LoadingDisplay(
  SheetInpainterGraphicalViewBase
) {}
