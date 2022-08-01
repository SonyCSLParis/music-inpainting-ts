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
  MonoVoicePlayerElement,
} from './interactivePianoRollVisualizer'
import { MidiInpainter } from '../sheet/sheetInpainter'
import { element } from 'nexusui/dist/types/util/transform'
import type { NoteSequence } from '@magenta/music'

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
    this.disableChanges()
    await Promise.all(this.drawNewNotesPromises)
    this.inpainter._apiRequest(...this.visualizer.timestamps)
    this.enableChanges()
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
    } finally {
      this.emit('ready')
    }
  }

  protected _render(...args: any[]): void {
    if (this.visualizer == null) {
      this.visualizer = new ClickableVisualizerElement(
        () => this.regenerationCallback(),
        this.playbackManager
      )
      this.visualizer.classList.add('midi-visualizer')
      this.interfaceContainer.appendChild(this.visualizer)
    }
    this.visualizer.noteSequence = this.inpainter.noteSequence

    const wrapperList = this.visualizer.getElementsByClassName(
      'piano-roll-visualizer'
    )
    console.log(wrapperList)
    console.log(wrapperList.length)
    if (wrapperList.length > 0) {
      console.log('hello !')
      const wrapper = wrapperList.item(0)
      ;(wrapper as HTMLElement).addEventListener(
        'pointerup',
        (ev: PointerEvent) => {
          console.log('registering seekHandler')
          log.debug('registering seekHandler')
          this.playbackManager.transport.seconds =
            this.inpainter.value.midi.duration *
            (ev.offsetX / wrapper.scrollWidth)
        }
      )
    }

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
  }
  protected noteByNoteDrawingAbortController = new AbortController()
  protected drawNewNotesPromises: Promise<void>[] = []

  protected drawNewNotes(newNotes: NoteSequence.Note[]): void {
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
          console.log('hello')
          rejected = true
          reject()
        }
      )
      try {
        const noteSequence = this.inpainter.noteSequence
        await Promise.all(this.drawNewNotesPromises.slice(0, numPromises))
        this.visualizer.setNoteSequenceSilent(noteSequence)
        for (let index = 0; index < newNotes.length; index++) {
          if (rejected) {
            reject()
            return
          }
          await PianoRollInpainterGraphicalView.delay(130)
          const note = newNotes[index]
          this.visualizer.drawNote(note)
        }
        await PianoRollInpainterGraphicalView.delay(20)
        resolve()
      } catch {
        console.log('Rejected')
        reject()
      }
    })
    this.drawNewNotesPromises.push(displayNotes)
  }

  protected targetScrollRatio: number = 1 / 4

  protected onInpainterChange(data: PianoRollData): void {
    if (data.newNotes != null) {
      // intermediary update with new batch of notes from the API,
      // do not perform a full update
      this.drawNewNotes(data.newNotes)
      this.enableChanges()
    } else {
      this.abortDrawing()
      if (this.visualizer != null) {
        this.visualizer.noteSequence = data.noteSequence
      }
      super.onInpainterChange(data)
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

  autoScrollIntervalDuration: Time = 0
  autoScrollUpdateInterval: Time = 0.5
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
