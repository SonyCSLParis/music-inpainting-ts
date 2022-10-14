import log from 'loglevel'
import { Canvg } from 'canvg'
import * as Tone from 'tone'

import {
  InpainterGraphicalView,
  LoadingDisplay,
} from '../inpainter/inpainterGraphicalView'
import MidiSheetPlaybackManager from '../sheetPlayback'

import { VariableValue } from '../cycleSelect'
import { ScrollLockSimpleBar } from '../utils/simplebar'
import { PiaInpainter, PianoRollData } from './pianoRollInpainter'
import { Time } from 'tone/build/esm/core/type/Units'
import {
  ClickableVisualizerElement,
  MonoVoicePlayerElement,
} from './interactivePianoRollVisualizer'
import { MidiInpainter } from '../sheet/sheetInpainter'
import { EventEmitter } from 'events'
import { CartesianScaleOptions, TickOptions } from 'chart.js'

import { NoteSequence } from '@magenta/music/esm/protobuf'

import { path as cursorPath } from 'ghost-cursor'

class PianoRollInpainterGraphicalViewBase extends InpainterGraphicalView<
  PianoRollData,
  PiaInpainter,
  MidiSheetPlaybackManager<MidiInpainter<PianoRollData, never>>,
  number
> {
  protected player: MonoVoicePlayerElement | null = null
  protected visualizer: ClickableVisualizerElement | null = null
  protected targetScrollRatio: number = 1 / 4

  constructor(
    inpainter: PiaInpainter,
    playbackManager: MidiSheetPlaybackManager<PiaInpainter>,
    container: HTMLElement,
    granularitySelect: VariableValue<never> = new VariableValue(), // CycleSelect<EditToolT>,
    displayUpdateRate: Tone.Unit.Time
  ) {
    super(
      inpainter,
      playbackManager,
      container,
      granularitySelect,
      displayUpdateRate
    )
    this.inpainter.on(
      'busy',
      (
        regionStartQuarters?: number,
        regionEndQuarters?: number,
        displayRegionEndQuarter?: number
      ) => {
        if (
          this.visualizer != null &&
          regionStartQuarters != null &&
          regionEndQuarters != null
        ) {
          this.visualizer.currentGenerationTimestamp_A = regionStartQuarters
          this.visualizer.currentGenerationTimestamp_B =
            displayRegionEndQuarter ?? regionEndQuarters
        }
      }
    )
    this.container.classList.add('piano-roll-inpainter')
    this.interfaceContainer.classList.add(
      'piano-roll-inpainter-stacking-container'
    )
    this.visualizerEmitter.on('ready', () => {
      // TODO(@tbazin, 2022/10/13): should properly detect when simplebar is ready
      this.emit('ready')
    })

    this.inpainter.on(
      'atomicAdd',
      (
        note: NoteSequence.Note,
        midiNote,
        midiChannel,
        PPQ,
        scrollIntoView: boolean = false,
        reveal: boolean = true
      ) => {
        this.eraseGrowingNote(note)
        this.drawNewNote(note, scrollIntoView, reveal)
      }
    )

    this.inpainter.on('grow-note', (note: NoteSequence.Note) =>
      this.startGrowingNote(note)
    )
    this.inpainter.on('clear-grow-note', (note: NoteSequence.Note) =>
      this.eraseGrowingNote(note)
    )

    this.inpainter.on(
      'move',
      (selection: NoteSequence.Note[], offsetQuarters: number) => {
        if (this.visualizer == undefined) {
          return
        }
        const noMargin = true
        const offsetX = this.visualizer?.timeToClientX(offsetQuarters, noMargin)
        if (offsetX == undefined) {
          return
        }
        for (const note of selection) {
          const maybeNoteElementID =
            this.visualizer?.visualizer.noteToRectID(note)
          if (maybeNoteElementID == undefined) {
            continue
          }
          const maybeNoteElement = document.getElementById(maybeNoteElementID)
          if (maybeNoteElement == undefined) {
            continue
          }
          const maybeX = maybeNoteElement.getAttribute('x')
          if (maybeX == undefined) {
            continue
          }
          const currentX = parseInt(maybeX)
          maybeNoteElement.setAttribute(
            'x',
            `${Math.round(currentX + offsetX)}`
          )
        }
      }
    )
  }

  protected startGrowingNote(note: NoteSequence.Note): void {
    note.endTime = note.startTime
    let rect = this.drawNewNote(note, true, false)
    if (rect != null) {
      rect.classList.add('growing')
    }
  }
  protected eraseGrowingNote(note: NoteSequence.Note): boolean | undefined {
    const copy = new NoteSequence.Note(note)
    copy.endTime = copy.startTime
    return this.visualizer?.visualizer?.removeNote(copy)
  }

  protected drawNewNote(
    note: NoteSequence.Note,
    scrollIntoView = false,
    reveal = true
  ): SVGRectElement | null | undefined {
    // HACK(@tbazin, 2022/09/08): remove this manual, inline update
    let hasOverflown = false
    hasOverflown =
      note.pitch < (this.visualizer?.config?.minPitch ?? 127) ||
      note.pitch > (this.visualizer?.config?.maxPitch ?? 0)

    if (reveal) {
      this.visualizer?.addNoteToNoteSequenceSilent(note)
    }
    let rect = this.visualizer?.drawNote(note)
    if (reveal) {
      rect?.classList.add('hideNote')
      this.triggerReflow()
      rect?.classList.remove('hideNote')
    }
    rect?.classList.add('new-note')

    if (
      !hasOverflown &&
      rect != undefined &&
      this.visualizer?.svgElement != null
    ) {
      const top = rect.y.animVal.value
      const bottom = rect.y.animVal.value + rect.height.animVal.value
      const right = rect.x.animVal.value + rect.width.animVal.value
      if (
        top <= 0 ||
        bottom > this.visualizer.svgElement.height.baseVal.value ||
        right > this.visualizer.Size.width
      ) {
        hasOverflown = true
      }
    }

    if (hasOverflown) {
      this.visualizer?.reload()
    }
    // if (rect != null && rect.id != null) {
    //   rect = document.getElementById(rect.id)
    // }

    if (scrollIntoView) {
      rect?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
    return rect
  }

  protected get canTriggerInpaint(): boolean {
    return (
      this.visualizer != null &&
      this.visualizer.selectionTimestamps[0] != null &&
      this.visualizer.selectionTimestamps[1] != null &&
      this.visualizer.selectionTimestamps[1] -
        this.visualizer.selectionTimestamps[0] >
        0
    )
  }

  clearSelection(): void {
    this.visualizer?.clearSelection()
  }

  public async callToAction(
    interval?: number,
    highlightedCellsNumber?: number
  ): Promise<void> {
    // TODO(@tbazin, 2022/10/13): insert cursor image and move it + trigger events to simulate action on piano roll
    const currentX = this.visualizer.scrollLeft
    const currentWidth = this.scrollableElement.clientWidth
    const middleHeight =
      this.interfaceContainer.clientTop +
      this.interfaceContainer.clientHeight / 2
    const start = { x: currentX + currentWidth / 5, y: middleHeight }
    const end = { x: currentX + (2 * currentWidth) / 5, y: middleHeight }
    const route = cursorPath(start, end)
  }

  protected async regenerationCallback(): Promise<void> {
    if (
      this.visualizer == null ||
      !this.visualizer.selectionTimestamps.every(
        (timestamp) => timestamp != null
      ) ||
      // TODO(@tbazin, 2022/08/10): setup a looser way of handling concurrent requests?
      // \-- for now this at least ensures a coherent state
      this.container.classList.contains('busy')
    ) {
      return
    }
    const inpaintingRegion = this.visualizer.selectionTimestamps.map(
      (timestampSeconds) =>
        timestampSeconds / this.inpainter.value.noteSequence.totalTime
    )
    this.inpainter.inpaintRegion(...this.visualizer.selectionTimestamps)
  }

  useTransparentScrollbars: boolean = false
  dataType: 'sheet' = 'sheet'

  get isRendered(): boolean {
    return this.visualizer != null && this.visualizer.svgElement != null
  }

  // no granularities in Piano Roll inpainter
  protected onchangeGranularity(): void {
    return
  }

  render() {
    // HACK(@tbazin, 2022/09/01)
    try {
      this._render()
    } catch {
      this._render()
    }
  }

  protected _pixelsPerTimeStep: number = 30
  get pixelsPerTimeStep(): number {
    return this._pixelsPerTimeStep
  }
  set pixelsPerTimeStep(pixelsPerTimeStep: number) {
    const currentTimestepCenter =
      (this.scrollableElement.scrollLeft +
        this.scrollableElement.clientWidth / 2) /
      this.pixelsPerTimeStep
    this._pixelsPerTimeStep = Math.max(10, pixelsPerTimeStep)
    if (this.visualizer != null) {
      this.visualizer.updateZoom(this.pixelsPerTimeStep).then(() => {
        this.scrollbar?.recalculate()
        const newScrollLeft = Math.max(
          0,
          currentTimestepCenter * this.pixelsPerTimeStep -
            this.scrollableElement.clientWidth / 2
        )
        this.scrollableElement.scroll({
          left: newScrollLeft,
          // behavior: 'smooth',
        })
        // this.refreshRecordingNoteGrowthRate()
      })
    }
  }

  // protected refreshRecordingNoteGrowthRate() {
  //   const pixelsPerSecond = this.scrollableElement.clientWidth / this.inpainter.noteSequence.totalTime
  //   this.style.
  // }

  protected zoomCallback(zoomIn: boolean): void {
    this.pixelsPerTimeStep += (zoomIn ? 1 : -1) * 3
    this.render()
    log.info(`Zoom level now: ${this.pixelsPerTimeStep} pixelsPerTimeStep`)
  }

  protected visualizerEmitter: EventEmitter = new EventEmitter()

  protected _render(...args: any[]): void {
    if (this.visualizer == null) {
      this.visualizer = new ClickableVisualizerElement(
        () => this.regenerationCallback(),
        this.playbackManager,
        this.visualizerEmitter
      )
      this.visualizer.classList.add('midi-visualizer')
      this.interfaceContainer.appendChild(this.visualizer)
      this.visualizer.emitter.on('ready', () => {
        if (this.visualizer != null && this.visualizer.topMargin != null) {
          if (this.visualizer.topMargin.contains(this.timeScaleContainer)) {
            return
          }
          // this.visualizer.topMargin.appendChild(this.timeScaleContainer)
        }
      })
    }
    this.visualizer.noteSequence = this.inpainter.noteSequence

    if (this.scrollbar == null && this.visualizer?.wrapper != null) {
      this.scrollbar = new ScrollLockSimpleBar(this.visualizer, {
        autoHide: false,
        clickOnTrack: false,
      })
    }
  }

  protected _refresh(): void {
    if (this.visualizer == null) {
      return
    }
    this.abortDrawing()
    // HACK(@tbazin, 2022/08/10): this seems hackish to need to do this,
    // should probably improve the (silent) update mechanism in PiaInpainter
    // but, for now, it at least ensures that the displayed state is coherent
    this.visualizer.setNoteSequenceSilent(this.inpainter.noteSequence)
    this.visualizer.reload()
  }

  protected static async delay(delay: number): Promise<void> {
    return new Promise((vars) => setTimeout(vars, delay))
  }

  protected abortDrawing() {
    this.noteByNoteDrawingAbortController.abort()
    this.noteByNoteDrawingAbortController = new AbortController()
    this.drawNewNotesPromises = []
    this.emit('ready')
  }
  protected noteByNoteDrawingAbortController = new AbortController()
  protected drawNewNotesPromises: Promise<void>[] = []

  protected async drawNewNotes(newNotes: NoteSequence.INote[]): Promise<void> {
    const numPromises = this.drawNewNotesPromises.length
    const displayNotes = new Promise<void>(async (resolve, reject) => {
      if (this.visualizer == null) {
        return
      }
      // TODO: Move this to PianoRollInpainterGraphicalView
      // // wait for previous notes to have been displayed
      let rejected = false
      this.noteByNoteDrawingAbortController.signal.addEventListener(
        'abort',
        () => {
          rejected = true
          reject()
        }
      )
      try {
        const noteSequence = this.inpainter.noteSequence
        await Promise.all(this.drawNewNotesPromises.slice(0, numPromises))
        this.visualizer.setNoteSequenceSilent(noteSequence)
        let hasOverflown = false
        for (let index = 0; index < newNotes.length; index++) {
          if (rejected) {
            reject()
            return
          }
          await PianoRollInpainterGraphicalView.delay(100)
          const note = newNotes[index]
          const rect = this.visualizer.drawNote(note)
          rect?.classList.add('new-note')

          if (
            !hasOverflown &&
            rect != undefined &&
            this.visualizer.svgElement != null
          ) {
            const top = rect.y.animVal.value
            const bottom = rect.y.animVal.value + rect.height.animVal.value
            const right = rect.x.animVal.value + rect.width.animVal.value
            if (
              top <= 0 ||
              bottom > this.visualizer.svgElement.height.baseVal.value ||
              right > this.visualizer.Size.widthWithoutMargins
            ) {
              hasOverflown = true
            }
          }
        }
        if (hasOverflown) {
          this.visualizer.reload()
        }
        resolve()
      } catch {
        console.log('Rejected')
        reject()
      }
    })
    this.drawNewNotesPromises.push(displayNotes)
    return displayNotes
  }

  protected onInpainterChange(data: PianoRollData): void {
    if (data.type != null && data.type == 'validate') {
      return
    }
    if (data.newNotes != null) {
      // intermediary update with new batch of notes from the API,
      // do not perform a full update
      this.drawNewNotes(data.newNotes.notes).finally(() => {
        if (!data.partialUpdate) {
          this.emit('ready')
          // HACK(@tbazin, 2022/08/10): feels hackish to trigger 'ready' manually here
          this.inpainter.emit('ready')
        }
      })
    } else {
      if (data.removeNotes != null) {
        this.visualizer?.setNoteSequenceSilent(data.noteSequence)
        data.removeNotes.forEach((note) =>
          this.visualizer?.visualizer.removeNote(note)
        )
      } else {
        this.abortDrawing()
        if (this.visualizer != null) {
          this.visualizer.noteSequence = data.noteSequence
        }
        super.onInpainterChange(data)
      }
    }
  }

  getInterfaceElementByIndex(index: number): Element | null {
    return this.graphicElement?.children?.item(index) ?? null
  }

  get interactionTarget(): HTMLElement {
    return this.visualizer?.svgElement
  }

  get numInteractiveElements(): number {
    return 1
    throw new Error('Method not implemented.')
  }

  protected setCurrentlyPlayingPositionDisplay(totalProgress: number): void {
    this.visualizer?.setPlaybackDisplayProgress(totalProgress)
  }
  protected scrollTo(progress: number): void {
    this.scrollToPosition(
      this.visualizer?.totalProgressToClientX(progress) ?? 0
    )
    if (this.visualizer?.lastPointermoveClientX != null) {
      this.visualizer?.setCursorHoverPosition(
        this.scrollableElement.scrollLeft +
          this.visualizer.lastPointermoveClientX
      )
    }
  }

  autoScrollIntervalDuration: Time = '4n'
  autoScrollUpdateInterval: Time = '4n'
  protected getTimecontainerPosition(step: number): {
    left: number
    right: number
  } {
    throw new Error('Method not implemented.')
    return { left: 0, right: 0 }
  }

  get graphicElement(): SVGElement | null {
    return this.visualizer?.svgElement ?? null
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

  get ticksOptions(): Partial<TickOptions> {
    return {
      ...super.ticksOptions,
      showLabelBackdrop: false,
      color: 'black',
      padding: -4,
      stepSize: 4,
    }
  }

  get timeScaleOptions(): Partial<CartesianScaleOptions> {
    return {
      ...super.timeScaleOptions,
    }
  }

  protected get scalesFontSize(): number {
    return this.visualizer?.Size.height / 30 ?? 12
  }
}

export class PianoRollInpainterGraphicalView extends LoadingDisplay(
  PianoRollInpainterGraphicalViewBase
) {}
