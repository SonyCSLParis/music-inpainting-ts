import { NexusSelectWithShuffle } from '../nexusColored'
import type { NexusSelect } from 'nexusui'
import { ScrollLockSimpleBar } from '../utils/simplebar'
import { Unit as ToneUnit } from 'tone'

import { apiCommand } from '../inpainter/inpainter'
import {
  InpainterGraphicalView,
  LoadingDisplay,
} from '../inpainter/inpainterGraphicalView'
import {
  Codemap,
  ConditioningMap,
  InpaintingMask,
  NotonoData,
  NotonoTool,
  SpectrogramInpainter,
  VqvaeLayer,
} from './spectrogramInpainter'
import { SpectrogramPlaybackManager } from '../spectrogramPlayback'

import { Tick, Ticks, ScriptableScaleContext } from 'chart.js'
import Chart from 'chart.js/auto'
import { Hertz, MelFrequencyScale } from './frequencyScale'

import globalColors from '../../common/styles/mixins/_colors.module.scss'
import { VariableValue } from '../cycleSelect'
import { InteractiveGrid } from './interactiveGrid'
import log from 'loglevel'

const chartsFontFamily = "'Fira-Sans'"
Chart.defaults.font.family = chartsFontFamily
Chart.registry.scales.register(MelFrequencyScale)

class SpectrogramInpainterGraphicalViewBase extends InpainterGraphicalView<
  NotonoData<VqvaeLayer>,
  SpectrogramInpainter,
  SpectrogramPlaybackManager,
  VqvaeLayer
> {
  readonly inpainter: SpectrogramInpainter
  protected async onInpainterChange(
    data: NotonoData<VqvaeLayer>
  ): Promise<void> {
    await this.updateSpectrogramImage(data.spectrogramImage)
    this.clear()
    super.onInpainterChange(data)
  }

  protected async updateSpectrogramImage(imageBlob: Blob): Promise<void> {
    return new Promise((resolve, _) => {
      const blobUrl = URL.createObjectURL(imageBlob)
      // HACK(theis, 2021_04_25): update the thumbnail stored in the Download button
      // for drag-and-drop, could try and generate the thumbnail only on drag-start
      // to avoid requiring this call here which one could easily forget to perform...
      // TODO(@tbazin, 2022/04/22): separate DownloadButton management
      // this.downloadButton.imageContent = imageBlob
      this.imageElement.src = blobUrl
      $(() => {
        URL.revokeObjectURL(blobUrl)
        resolve()
      })
    })
  }

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
  readonly snapPoints: HTMLDivElement
  readonly addColumnIconsContainer: HTMLDivElement

  protected interactiveGridPerLayer: Map<VqvaeLayer, InteractiveGrid>

  protected readonly timeScaleContainer: HTMLDivElement
  protected readonly timeScaleCanvas: HTMLCanvasElement
  protected timeScale: Chart
  protected readonly frequencyScaleContainer: HTMLDivElement
  protected readonly frequencyScaleCanvas: HTMLCanvasElement
  protected frequencyScale: Chart

  readonly useTransparentScrollbars = false

  readonly instrumentConstraintSelect: NexusSelectWithShuffle
  readonly pitchClassConstraintSelect?: NexusSelect
  readonly octaveConstraintControl: NexusSelect

  readonly autoScrollIntervalDuration = 0
  readonly autoScrollUpdateInterval = 0.1
  static readonly displayUpdateRate = 0.1

  get columnDuration(): ToneUnit.Seconds {
    return this.inpainter.layerDimensions.get(this.granularity).timeResolution
  }

  protected get codemapTop(): Codemap | undefined {
    // TODO(@tbazin, 2022/04/22): refactor to use `?.` syntax
    //   once when webpack/typescript properly updated
    // Also, should this check be necessary? Should we just wait
    //   for the value to be ready to start rendering the GraphicalView?`
    if (this.inpainter.value != undefined) {
      return this.inpainter.value.codemap.top
    } else {
      return undefined
    }
  }
  protected get codemapBottom(): Codemap | undefined {
    // TODO(@tbazin, 2022/04/22): refactor to use `?.` syntax
    //   once when webpack/typescript properly updated
    // Also, should this check be necessary? Should we just wait
    //   for the value to be ready to start rendering the GraphicalView?`
    if (this.inpainter.value != undefined) {
      return this.inpainter.value.codemap.bottom
    } else {
      return undefined
    }
  }

  protected get interactiveGrid(): InteractiveGrid | undefined {
    return this.interactiveGridPerLayer.get(this.granularity)
  }

  get interacting(): boolean {
    return this.interactiveGrid.interacting
  }

  protected get activeCodemap(): Codemap {
    switch (this.granularity) {
      case VqvaeLayer.Top:
        return this.codemapTop
      case VqvaeLayer.Bottom:
        return this.codemapBottom
    }
  }

  protected get currentConditioning_top(): ConditioningMap {
    return this.inpainter.value.conditioning.top
  }
  protected get currentConditioning_bottom(): ConditioningMap {
    return this.inpainter.value.conditioning.bottom
  }

  get interfaceElement(): HTMLElement {
    return this.interactiveGrid.element
  }

  readonly toolSelect: VariableValue<NotonoTool>
  get tool(): NotonoTool {
    return this.toolSelect.value
  }

  constructor(
    inpainter: SpectrogramInpainter,
    playbackManager: SpectrogramPlaybackManager,
    container: HTMLElement,
    vqvaeLayerSelect: VariableValue<VqvaeLayer>,
    inpaintingApiAddress: URL,
    toolSelect: VariableValue<NotonoTool>,
    instrumentConstraintSelect: NexusSelectWithShuffle,
    octaveConstraintControl: NexusSelect,
    pitchClassConstraintSelect?: NexusSelect
  ) {
    super(
      inpainter,
      playbackManager,
      container,
      vqvaeLayerSelect,
      inpaintingApiAddress,
      SpectrogramInpainterGraphicalViewBase.displayUpdateRate
    )
    this.container.classList.add('spectrogram-inpainter', 'no-scroll')

    this.imageContainer = document.createElement('div')
    this.imageContainer.classList.add('spectrogram-inpainter-image-container')
    this.container.insertBefore(this.imageContainer, this.interfaceContainer)

    const spectrogramPictureElement = document.createElement('picture')
    this.imageContainer.appendChild(spectrogramPictureElement)

    this.imageElement = document.createElement('img')
    spectrogramPictureElement.appendChild(this.imageElement)
    const imageElementShadowElement = document.createElement('div')
    this.imageElement.appendChild(imageElementShadowElement)

    this.snapPoints = document.createElement('div')
    this.snapPoints.classList.add('spectrogram-inpainter-snap-points')
    spectrogramPictureElement.appendChild(this.snapPoints)

    this.scrollbar = new ScrollLockSimpleBar(this.imageContainer, {
      clickOnTrack: false,
    })

    this.timeScaleContainer = document.createElement('div')
    this.timeScaleContainer.classList.add(
      'spectrogram-inpainter-scale-container',
      'spectrogram-inpainter-time-scale-container'
    )
    this.container.appendChild(this.timeScaleContainer)
    this.timeScaleCanvas = document.createElement('canvas')
    this.timeScaleContainer.appendChild(this.timeScaleCanvas)

    this.frequencyScaleContainer = document.createElement('div')
    this.frequencyScaleContainer.classList.add(
      'spectrogram-inpainter-scale-container',
      'spectrogram-inpainter-frequency-scale-container'
    )
    this.container.appendChild(this.frequencyScaleContainer)
    this.frequencyScaleCanvas = document.createElement('canvas')
    this.frequencyScaleContainer.appendChild(this.frequencyScaleCanvas)

    this.drawTimeScale()
    this.drawFrequencyScale()

    this.numColumnsTop = this.inpainter.layerDimensions.get(
      VqvaeLayer.Top
    ).timeColumns

    const initialWidth = this.interfaceContainer.clientWidth
    const initialHeight = this.interfaceContainer.clientHeight
    this.interactiveGridPerLayer = new Map<VqvaeLayer, InteractiveGrid>()
    this.inpainter.layerDimensions.forEach((dimensions, layer) => {
      this.interactiveGridPerLayer.set(
        layer,
        this.drawTimestampBoxes(
          dimensions.frequencyRows,
          dimensions.timeColumns,
          this.numColumnsTop,
          initialWidth,
          initialHeight,
          layer
        )
      )
    })
    this.refresh()

    this.toolSelect = toolSelect

    this.toolSelect.on('change', (tool) => {
      this.interfaceContainer.classList.toggle(
        'eraser',
        tool == NotonoTool.Eraser
      )
      this.interfaceContainer.classList.toggle(
        'randomize',
        tool == NotonoTool.Randomize
      )
    })

    this.instrumentConstraintSelect = instrumentConstraintSelect
    this.octaveConstraintControl = octaveConstraintControl

    // if no pitchClassConstraintSelect interface is passed, the pitchClass constraint
    // defaults to C
    this.pitchClassConstraintSelect = pitchClassConstraintSelect

    this.registerCallback(() => void this.regenerationCallback())
    if (this.scrollbar != null) {
      this.scrollableElement.addEventListener('scroll', () => {
        this.setCurrentlyPlayingPositionDisplay()
      })
    }
  }

  protected onchangeGranularity(): void {
    if (this.interactiveGrid.interacting) {
      return
    }
    Array.from(
      this.interfaceContainer.getElementsByClassName(
        'spectrogram-inpainter-interface'
      )
    ).forEach((element) =>
      element.classList.toggle(
        'disabled-layer',
        element.getAttribute('layer') != this.granularity
      )
    )
  }

  public get midiPitchConstraint(): number {
    let pitchClass = 0 // Default to C
    if (this.pitchClassConstraintSelect != undefined) {
      pitchClass = this.pitchClassConstraintSelect.selectedIndex
    }
    return pitchClass + 12 * parseInt(this.octaveConstraintControl.value)
  }

  public get instrumentConstraint(): string {
    return this.instrumentConstraintSelect.value
  }

  public get mask(): InpaintingMask {
    return this.interactiveGrid.matrix.pattern.map((row) =>
      row.map((value) => value == 1)
    )
  }

  readonly boxDurations_quarters: number[]

  protected async regenerationCallback(): Promise<void> {
    switch (this.granularitySelect.value) {
      case VqvaeLayer.Top: {
        // TODO(@tbazin, 2022/04/22): check this!
        this.inpainter.value.conditioning.top = this.updateConditioningMap(
          this.mask,
          this.currentConditioning_top
        )
        break
      }
      case VqvaeLayer.Bottom: {
        // TODO(@tbazin, 2022/04/22): check this!
        this.inpainter.value.conditioning.bottom = this.updateConditioningMap(
          this.mask,
          this.currentConditioning_bottom
        )
        break
      }
    }

    const sendCurrentDataWithRequest = true
    const jsonData = {
      // send the mask with low-frequencies first
      mask: this.mask.reverse(),
    }
    await this.inpainter.apiRequestHelper(
      'POST',
      this.generationCommand,
      this.queryParameters,
      this.inpainter.defaultApiAddress,
      sendCurrentDataWithRequest,
      0,
      null,
      jsonData
    )
  }

  protected get generationCommand(): apiCommand {
    let command: apiCommand
    switch (this.tool) {
      case NotonoTool.Eraser:
        command = apiCommand.Erase
        break
      case NotonoTool.Inpaint:
      case NotonoTool.Randomize:
        command = apiCommand.Inpaint
    }
    return command
  }

  get queryParameters(): string[] {
    const generationParameters = [
      'pitch=' + this.midiPitchConstraint.toString(),
      'pitch_class=' + (this.midiPitchConstraint % 12).toString(),
      'instrument_family_str=' + this.instrumentConstraint,
      'layer=' + this.granularity,
      'temperature=1',
      'eraser_amplitude=0.1',
      'start_index_top=' + this.getCurrentScrollPositionTopLayer().toString(),
      'duration_top=' + this.vqvaeTimestepsTop.toString(),
      'spectrogram_image_colormap=Greys_alpha',
      'uniform_sampling=' + (this.tool == NotonoTool.Randomize).toString(),
    ]
    return [...super.queryParameters, ...generationParameters]
  }

  protected registerCallback(callback: () => void): void {
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
      if (!this.disabled) {
        if (this.scrollbar != null) {
          this.scrollbar.toggleScrollLock('x', true)
        }
        registerReleaseCallback()
      }
    })
  }

  protected getCurrentScrollPositionTopLayer(): number {
    const spectrogramImageContainerElement = this.imageContainer
    if (spectrogramImageContainerElement == null) {
      throw Error('Spectrogram container not initialized')
    }
    if (this.scrollbar == null) {
      return 0
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
  // but this has the TS type-checker fail, considering the map method (which
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
    return this.interactiveGrid.rows
  }

  protected get numColumns(): number {
    return this.interactiveGrid.columns
  }

  protected get numColumnsTotal(): number {
    return this.activeCodemap[0].length
  }

  protected get columnWidth(): number {
    if (this.interactiveGrid.cells.length > 0) {
      return (
        this.interactiveGrid.cells[0].width +
        2 * this.interactiveGrid.cells[0].paddingColumn
      )
    } else {
      return 0
    }
  }

  // Duration of the current sound in number of columns at the Top-layer scale
  public get vqvaeTimestepsTop(): number {
    if (this.codemapTop != null) {
      return this.codemapTop[0].length
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
    if (this.interactiveGrid !== null) {
      this.interactiveGrid.destroy()
    }
    this.drawTimestampBoxes(numRows, numColumns, numColumnsTop)
    this.insertGridExpansionIcons()

    $(() => {
      this.interactiveGrid.on(
        'toggle',
        this.ontoggle.bind(this.interactiveGrid)
      )
    })

    this.refresh()
  }

  protected _refresh(): void {
    this.resize()
    this.onchangeGranularity()
    this.timeScale.draw()
    this.frequencyScale.draw()
    if (this.scrollbar != null) {
      this.scrollbar.recalculate()
    }
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
    this.interactiveGridPerLayer.forEach((interactiveGrid) =>
      interactiveGrid.resize(width, height)
    )
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
    this.interactiveGrid.matrix.populate.all(0)
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

  static maxTicksLimit: number = MelFrequencyScale.maxTicksLimit

  static readonly commonAxesOptions = {
    grid: {
      drawBorder: false,
      display: false,
    },
  }

  readonly commonTicksOptions = {
    color: 'rgba(255, 255, 255, 0.6)',
    font: (ctx: ScriptableScaleContext) => {
      return {
        family: chartsFontFamily,
        size: Math.min(this.frequencyScaleContainer.clientWidth / 15, 12),
        style: undefined,
        lineHeight: undefined,
        weight: undefined,
      }
    },
    // maxTicksLimit: (ctx) => 30,
    showLabelBackdrop: true,
    backdropColor: 'rgba(0, 0, 0, 0.6)',
    backdropPadding: 2,
  }

  drawTimeScale(): Chart {
    if (this.timeScale != null) {
      this.timeScale.destroy()
    }

    const chart = new Chart(this.timeScaleCanvas, {
      type: 'line',
      data: {
        datasets: [],
      },
      options: {
        // ensures the canvas fills the entire container
        maintainAspectRatio: false,
        scales: {
          y: {
            display: false,
            ...SpectrogramInpainterGraphicalViewBase.commonAxesOptions,
          },
          x: {
            ...SpectrogramInpainterGraphicalViewBase.commonAxesOptions,

            axis: 'x',
            type: 'linear',
            display: true,

            min: this.getCurrentScrollPositionTopLayer(),
            max:
              this.getCurrentScrollPositionTopLayer() + this.vqvaeTimestepsTop,

            offset: false,

            ticks: {
              stepSize: 1,
              align: 'start',
              callback: function (
                this,
                tickValue: number,
                index: number,
                ticks: Tick[]
              ): string {
                return (
                  Ticks.formatters.numeric.bind(this)(tickValue, index, ticks) +
                  's'
                )
              },
              ...this.commonTicksOptions,
            },
          },
        },
      },
    })
    this.timeScale = chart
    return this.timeScale
  }

  drawFrequencyScale(
    maxTicksLimit: number = SpectrogramInpainterGraphicalViewBase.maxTicksLimit
  ): Chart {
    if (this.frequencyScale != null) {
      this.frequencyScale.destroy()
    }

    const minFrequency: Hertz = 20
    const maxFrequency: Hertz = 8000
    const melBreakFrequency: Hertz = 240

    const chart = new Chart(this.frequencyScaleCanvas, {
      type: 'line',
      data: {
        datasets: [],
      },
      options: {
        // ensures the canvas fills the entire container
        maintainAspectRatio: false,
        scales: {
          x: {
            display: false,
            ...SpectrogramInpainterGraphicalViewBase.commonAxesOptions,
          },
          y: {
            ...SpectrogramInpainterGraphicalViewBase.commonAxesOptions,

            axis: 'y',
            display: true,
            type: 'mel',
            offset: false,

            min: minFrequency,
            max: maxFrequency,
            melBreakFrequency: melBreakFrequency,

            ticks: {
              align: 'start',
              crossAlign: 'center',
              ...this.commonTicksOptions,
            },
          },
        },
      },
    })
    this.frequencyScale = chart
    return this.frequencyScale
  }

  public drawTimestampBoxes(
    numRows: number,
    numColumns: number,
    numColumnsTop: number,
    gridWidth?: number,
    gridHeight?: number,
    layer?: VqvaeLayer
  ): InteractiveGrid {
    const width = gridWidth || this.interfaceContainer.clientWidth
    const height = gridHeight || this.imageContainer.clientHeight
    const interactiveGrid = new InteractiveGrid(this.interfaceContainer, {
      size: [width, height],
      mode: 'toggle',
      rows: numRows,
      columns: numColumns,
      // make the matrix overlay transparent
      fill: 'rgba(255, 255, 255, 0)',
      accent: globalColors.arabian_sand,
    })
    interactiveGrid.element.classList.add('spectrogram-inpainter-interface')
    interactiveGrid.element.classList.add(layer)
    interactiveGrid.element.setAttribute('layer', layer)

    this.numColumnsTop = numColumnsTop

    return interactiveGrid
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
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.interfaceElement.children.item(index)
  }

  colorize(type: string, color: string): void {
    this.interactiveGridPerLayer.forEach((interactiveGrid) => {
      interactiveGrid.colorize(type, color)
    })
  }

  get numInteractiveElements(): number {
    return this.numRows * this.numColumns
  }

  protected setPlayingColumn(columnIndex: number): void {
    return this.interactiveGrid.setPlayingColumn(columnIndex)
  }

  protected clearNowPlayingDisplay(): void {
    return this.interactiveGrid.clearNowPlayingDisplay()
  }

  protected setCurrentlyPlayingPositionDisplay(): void {
    this.interactiveGridPerLayer.forEach((interactiveGrid) => {
      const scaleRatio = interactiveGrid.columns / this.numColumnsTop
      const currentlyPlayingColumn: number =
        Math.floor(
          this.playbackManager.transport.progress * interactiveGrid.columns
        ) -
        this.getCurrentScrollPositionTopLayer() * scaleRatio

      if (
        currentlyPlayingColumn < 0 ||
        currentlyPlayingColumn > interactiveGrid.columns
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

      interactiveGrid.setPlayingColumn(currentlyPlayingColumn)
    })
  }

  protected async dropHandler(e: DragEvent): Promise<void> {
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
          // const generationParameters =
          //   '?pitch=' +
          //   this.midiPitchConstraint.toString() +
          //   '&instrument_family_str=' +
          //   this.instrumentConstraint
          await this.inpainter.sendAudio(file, this.queryParameters)
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        console.log(`... file[${i}].name = ` + e.dataTransfer.files[i].name)
      }
    }
  }
}

export class SpectrogramInpainterGraphicalView extends LoadingDisplay(
  SpectrogramInpainterGraphicalViewBase
) {}
