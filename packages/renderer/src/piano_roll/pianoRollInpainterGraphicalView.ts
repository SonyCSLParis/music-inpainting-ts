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
import { PlayerElement } from 'html-midi-player'
import {
  ClickableVisualizerElement,
  extractSelectedRegion,
  MonoVoicePlayerElement,
} from './interactivePianoRollVisualizer'
import { MidiInpainter } from '../sheet/sheetInpainter'
import { element } from 'nexusui/dist/types/util/transform'
import type { NoteSequence } from '@magenta/music'
import { EventEmitter } from 'events'
import screenfull from 'screenfull'

class PianoRollInpainterGraphicalViewBase extends InpainterGraphicalView<
  PianoRollData,
  PiaInpainter,
  MidiSheetPlaybackManager<MidiInpainter<PianoRollData, never>>,
  number
> {
  protected player: MonoVoicePlayerElement | null = null
  protected visualizer: ClickableVisualizerElement | null = null

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
    this.container.classList.add('piano-roll-inpainter')
    this.interfaceContainer.classList.add(
      'piano-roll-inpainter-stacking-container'
    )
    this.visualizerEmitter.on('ready', () => this.emit('ready'))
  }

  protected get canTriggerInpaint(): boolean {
    return (
      this.visualizer != null &&
      this.visualizer.timestamps[0] != null &&
      this.visualizer.timestamps[1] != null &&
      this.visualizer.timestamps[1] - this.visualizer.timestamps[0] > 0
    )
  }

  protected async regenerationCallback(): Promise<void> {
    if (
      this.visualizer == null ||
      !this.visualizer.timestamps.every((timestamp) => timestamp != null)
    ) {
      return
    }
    const inpaintingRegion = this.visualizer.timestamps.map(
      (timestampSeconds) =>
        timestampSeconds / this.inpainter.value.noteSequence.totalTime
    )
    this.inpainter._apiRequest(
      ...this.visualizer.timestamps,
      this.visualizer.timestamps_ticks
    )
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
    this._pixelsPerTimeStep = Math.max(10, pixelsPerTimeStep)
    if (this.visualizer != null) {
      this.visualizer.config = {
        ...this.visualizer.config,
        pixelsPerTimeStep: this.pixelsPerTimeStep,
      }
    }
  }

  renderZoomControls(containerElement: HTMLElement): void {
    const zoomOutButton = document.createElement('div')
    zoomOutButton.classList.add('zoom-out')
    containerElement.appendChild(zoomOutButton)
    const zoomOutButtonIcon = document.createElement('i')
    zoomOutButtonIcon.classList.add('fa-solid', 'fa-search-minus')
    zoomOutButton.appendChild(zoomOutButtonIcon)

    const zoomInButton = document.createElement('div')
    zoomInButton.classList.add('zoom-in')
    containerElement.appendChild(zoomInButton)
    const zoomInButtonIcon = document.createElement('i')
    zoomInButtonIcon.classList.add('fa-solid', 'fa-search-plus')
    zoomInButton.appendChild(zoomInButtonIcon)

    zoomOutButton.addEventListener('click', () => {
      this.pixelsPerTimeStep -= 2
      this.render()
      log.info(`OSMD zoom level now: ${this.pixelsPerTimeStep}`)
    })
    zoomInButton.addEventListener('click', () => {
      this.pixelsPerTimeStep += 2
      this.render()
      log.info(`OSMD zoom level now: ${this.pixelsPerTimeStep}`)
    })
  }

  renderFullscreenControl(containerElement: HTMLElement): void {
    const fullscreenButton = document.createElement('div')
    fullscreenButton.classList.add('fullscreen-toggle')
    containerElement.appendChild(fullscreenButton)
    const zoomOutButtonIcon = document.createElement('i')
    zoomOutButtonIcon.classList.add(
      'fa-solid',
      screenfull.isFullscreen ? 'fa-minimize' : 'fa-maximize'
    )
    fullscreenButton.appendChild(zoomOutButtonIcon)
    const toggleClass = () => {
      zoomOutButtonIcon.classList.remove('fa-minimize', 'fa-maximize')
      zoomOutButtonIcon.classList.add(
        screenfull.isFullscreen ? 'fa-minimize' : 'fa-maximize'
      )
    }

    document.addEventListener('fullscreenchange', (e) => {
      // containerElement.classList.toggle('hidden', screenfull.isFullscreen)
      toggleClass()
    })
    document.body.addEventListener('fullscreenerror', (e) => {
      // containerElement.classList.toggle('hidden', screenfull.isFullscreen)
      toggleClass()
    })
    fullscreenButton.addEventListener('click', () => {
      if (screenfull.isEnabled) {
        screenfull.toggle(undefined, { navigationUI: 'hide' }).then(toggleClass)
      }
    })
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

  protected targetScrollRatio: number = 1 / 4

  protected onInpainterChange(data: PianoRollData): void {
    if (data.newNotes != null) {
      // intermediary update with new batch of notes from the API,
      // do not perform a full update
      this.drawNewNotes(data.newNotes.notes).then(() => {
        if (!data.partialUpdate) {
          this.inpainter.emit('ready')
        }
      })
    } else {
      if (data.removeNotes != null) {
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

  protected setCurrentlyPlayingPositionDisplay(progress: number): void {
    this.visualizer?.setPlaybackDisplayProgress(progress)
  }

  protected triggerReflow(): void {
    const _ = document.body.clientWidth
    return
  }

  protected scrollTo(progress: number): void {
    this.scrollToPosition(this.visualizer?.progressToClientX(progress) ?? 0)
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
    if (this.graphicElement == null) {
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

export class PianoRollInpainterGraphicalView extends LoadingDisplay(
  PianoRollInpainterGraphicalViewBase
) {}
