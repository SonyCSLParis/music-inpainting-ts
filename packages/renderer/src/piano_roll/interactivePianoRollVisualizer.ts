import { NoteSequence, INoteSequence } from '@magenta/music/esm/protobuf'
import {
  PianoRollSVGVisualizer,
  VisualizerConfig,
} from '@magenta/music/esm/core/visualizer'
import { urlToNoteSequence } from '@magenta/music/esm/core/midi_io'
import * as mm_sequences from '@magenta/music/esm/core/sequences'

import { PlayerElement, VisualizerElement } from 'html-midi-player'
import Color from 'color'

// import './Player.scss'
import * as Tone from 'tone'
import EventEmitter from 'events'
import MidiSheetPlaybackManager from '../sheetPlayback'

const VITE_SCREENSHOT_MODE = import.meta.env.VITE_SCREENSHOT_MODE != undefined

const svgNamespace = 'http://www.w3.org/2000/svg'

/**
 * HTML/CSS key-value pairs.
 */
type DataAttribute = [string, any] // tslint:disable-line:no-any
type CSSProperty = [string, string | null]

function trimStartSilence(noteSequence: NoteSequence): NoteSequence {
  if (noteSequence.notes == null || noteSequence.totalTime == null) {
    return noteSequence
  }

  const minStartTime = Math.min(
    ...(noteSequence.notes
      .map((note) => note.startTime)
      .filter((startTime) => startTime != null) as Array<number>)
  )
  return mm_sequences.trim(noteSequence, minStartTime, noteSequence.totalTime)
}

function extractFirstVoice(noteSequence: NoteSequence) {
  const firstVoice = noteSequence.notes.filter((note) => note.instrument == 0)
  return new NoteSequence({
    ...noteSequence.toJSON(),
    notes: firstVoice,
  })
}
function removeDrums(noteSequence: NoteSequence) {
  const noDrums = noteSequence.notes.filter((note) => note.isDrum == false)
  return new NoteSequence({
    ...noteSequence.toJSON(),
    notes: noDrums,
  })
}
function mapAllInstrumentsToFirstVoice(noteSequence: NoteSequence) {
  const firstVoice = mm_sequences
    .mergeInstruments(noteSequence)
    .notes.map((note) => {
      note.instrument = 0
      // HACK(@tbazin, 2022/09/13): *not* overriding the loaded `program` value
      //    allows to maintain the generated notes displays in loaded files
      note.program = note.program == 1 ? 1 : 0
      return note
    })

  noteSequence.notes = firstVoice
  return new NoteSequence({ ...noteSequence.toJSON() })
}

export function pianorollify(
  noteSequence: NoteSequence,
  cropDuration: number = 60,
  targetMeanVelocity: number = 80
): NoteSequence {
  noteSequence = removeDrums(noteSequence)
  noteSequence = mapAllInstrumentsToFirstVoice(noteSequence)
  noteSequence = trimStartSilence(noteSequence)
  // clip MIDI range since PIA does not support the whole MIDI pitch-range
  // TODO(@tbazin, 2022/09/30): move this to the PIA api,
  // this is a limitation of PIA
  noteSequence = clipMidiPitchesRanges(noteSequence)
  return mm_sequences.trim(noteSequence, 0, cropDuration, true)
}

function clipMidiPitchesRanges(
  noteSequence: NoteSequence,
  minPitch = 21,
  maxPitch = 108
) {
  const notesInValidMIDIPitchRange = noteSequence.notes.filter(
    (note) => note.pitch >= minPitch && note.pitch <= maxPitch
  )

  noteSequence.notes = notesInValidMIDIPitchRange
  return new NoteSequence({ ...noteSequence.toJSON() })
}

export class MonoVoicePlayerElement extends PlayerElement {
  set src(value: string | null) {
    this.ns = null
    if (value != null) {
      urlToNoteSequence(value).then((noteSequence) => {
        noteSequence = pianorollify(noteSequence)
        this.noteSequence = noteSequence
        this.removeAttribute('src')
        this.ns = noteSequence
        this.initPlayer(false)
      })
    }
  }
}

class MonoVoiceVisualizerElement extends VisualizerElement {
  setNoteSequenceSilent(noteSequence: NoteSequence) {
    this.ns = noteSequence
  }
  addNoteToNoteSequenceSilent(note: NoteSequence.INote) {
    this.ns.notes?.push(note)
  }

  set src(value: string | null) {
    this.ns = null
    if (value != null) {
      urlToNoteSequence(value).then((noteSequence) => {
        noteSequence = pianorollify(noteSequence)
        this.noteSequence = noteSequence
        this.removeAttribute('src')
        this.ns = noteSequence
        this.initVisualizer()
      })
    }
  }
}

window.customElements.define('monovoice-midi-player', MonoVoicePlayerElement)
window.customElements.define(
  'monovoice-midi-visualizer',
  MonoVoiceVisualizerElement
)

class NoteByNotePianoRollSVGVisualizer extends PianoRollSVGVisualizer {
  static readonly clickableMarginWidth: number = 30
  protected offsetY: number = 0

  constructor(
    sequence: INoteSequence,
    svg: SVGSVGElement,
    config?: VisualizerConfig
  ) {
    super(sequence, svg, config)
  }

  protected getSize(): {
    width: number
    height: number
    widthWithoutMargins: number
  } {
    const size = super.getSize()
    const sizeUpdated = {
      ...size,
      widthWithoutMargins: size.width,
      width:
        size.width + 2 * NoteByNotePianoRollSVGVisualizer.clickableMarginWidth,
    }

    if (this.svg != undefined) {
      this.offsetY = Math.max(
        0,
        (this.svg.clientHeight - sizeUpdated.height) / 2
      )
      sizeUpdated.height = this.svg.clientHeight
    }

    return sizeUpdated
  }

  get Size(): {
    width: number
    height: number
    widthWithoutMargins: number
  } {
    return this.getSize()
  }

  removeNote(note: NoteSequence.Note): boolean {
    const element = this.svg.getElementById(this.noteToRectID(note))
    const wasPresent = element != undefined
    element?.remove()
    return wasPresent
  }

  drawNote(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    dataAttributes: DataAttribute[],
    cssProperties: CSSProperty[]
  ): SVGRectElement | null {
    if (!this.svg) {
      return null
    }
    const rect: SVGRectElement = document.createElementNS(svgNamespace, 'rect')
    rect.classList.add('note')
    // rect.setAttribute('fill', fill)
    x = x + NoteByNotePianoRollSVGVisualizer.clickableMarginWidth

    // Round values to the nearest integer to avoid partially filled pixels.
    rect.setAttribute('x', `${Math.round(x)}`)
    rect.setAttribute('y', `${Math.round(y)}`)
    rect.setAttribute('width', `${Math.max(Math.round(w), 3)}`)
    rect.setAttribute('height', `${Math.round(h)}`)
    dataAttributes.forEach(([key, value]: DataAttribute) => {
      if (value !== undefined) {
        rect.dataset[key] = `${value}`
      }
    })
    cssProperties.forEach(([key, value]: CSSProperty) => {
      rect.style.setProperty(key, value)
    })
    // const noteElements = Array.from(this.svg.getElementsByTagName('note'))
    // const indexFirstNoteAfter = noteElements
    //   .reverse()
    //   .map((element) => {
    //     try {
    //       return ClickableVisualizerElement.locateElement(element)[0]
    //     } catch {
    //       return x + 1
    //     }
    //   })
    //   .findIndex((value) => x < value)
    this.svg.appendChild(rect)

    const isGeneratedNoteIndex = dataAttributes.findIndex(
      ([key, value]) => key == 'program'
    )
    const isGeneratedNote =
      isGeneratedNoteIndex >= 0
        ? dataAttributes[isGeneratedNoteIndex][1] == 1
        : false
    const baseColor = isGeneratedNote
      ? NoteByNotePianoRollSVGVisualizer.baseGeneratedNoteColor
      : NoteByNotePianoRollSVGVisualizer.baseLoadedNoteColor

    const velocityString = rect.style.getPropertyValue('--midi-velocity')
    const velocity = parseInt(velocityString != '' ? velocityString : '127')
    // const velocity = Math.round(Math.random() * 127)
    const colorRotateAmount = 50
    const colorHueRotate = colorRotateAmount * (velocity / 127)
    rect?.setAttribute(
      'fill',
      baseColor
        .hsl()
        .rotate(-1 * colorRotateAmount + colorHueRotate)
        .desaturate(0.7 * (1 - velocity / 127))
        .rgb()
        .string()
    )

    return rect
  }

  static readonly baseGeneratedNoteColor: Color = Color.rgb(255, 110, 0)
    .hsv()
    .desaturate(0.05)
  static readonly baseLoadedNoteColor: Color = Color.rgb(0, 110, 255)
    .hsv()
    .desaturate(0.6)

  protected getNotePosition(
    note: NoteSequence.INote,
    noteIndex: number
  ): { x: number; y: number; w: number; h: number } {
    const size = super.getNotePosition(note, noteIndex)
    size.y -= this.offsetY
    return size
  }

  protected draw() {
    if (this.noteSequence == null || this.noteSequence.notes == null) {
      return
    }
    for (let i = 0; i < this.noteSequence.notes.length; i++) {
      const note = this.noteSequence.notes[i]
      const size = this.getNotePosition(note, i)
      const fill = this.getNoteFillColor(note, false)
      const dataAttributes: DataAttribute[] = [
        ['index', i],
        ['instrument', note.instrument],
        ['program', note.program],
        ['isDrum', note.isDrum === true],
        ['pitch', note.pitch],
      ]
      const cssProperties: CSSProperty[] = [
        [
          '--midi-velocity',
          String(note.velocity !== undefined ? note.velocity : 127),
        ],
      ]

      if (this.svg != null) {
        // HACK(@tbazin, 2022/09/11): should rather ensure there are no duplicates in
        // inpainter.noteSequence!
        const maybeRect = this.svg.getElementById(this.noteToRectID(note))
        if (maybeRect != null) {
          continue
        }
      }
      const rect = this.drawNote(
        size.x,
        size.y,
        size.w,
        size.h,
        fill,
        dataAttributes,
        cssProperties
      )
      if (rect != null) {
        rect.id = this.noteToRectID(note)
      }
    }
    this.drawn = true
  }

  noteToRectID(note: NoteSequence.Note): string {
    return `${note.startTime.toFixed(3)}-${note.endTime.toFixed(3)}-${
      note.pitch
    }`
  }

  getNotePositionPublic(
    note: NoteSequence.INote,
    noteIndex: number
  ): { x: number; y: number; w: number; h: number } {
    return this.getNotePosition(note, noteIndex)
  }
}

export function extractSelectedRegion(
  noteSequence: INoteSequence,
  start: number,
  end: number
) {
  if (noteSequence.notes == null) {
    return [[], [], []]
  }
  const beforeRegion = noteSequence.notes.filter(
    (noteObject) => noteObject.startTime != null && noteObject.startTime < start
  )
  const afterRegion = noteSequence.notes.filter(
    (noteObject) => noteObject.startTime != null && noteObject.startTime > end
  )
  const selectedRegion = noteSequence.notes.filter(
    (noteObject) =>
      noteObject.startTime != null &&
      noteObject.startTime >= start &&
      noteObject.startTime <= end
  )
  return [beforeRegion, selectedRegion, afterRegion]
}

export class ClickableVisualizerElement extends MonoVoiceVisualizerElement {
  static readonly cssClassesPrefix: string = 'midi-visualizer'

  protected inLoopSelectionOperation: boolean = false
  protected doubleTaptopMarginTimeout: null | NodeJS.Timeout = null
  initLoopSelectionOperation: boolean
  get Size(): {
    width: number
    height: number
    widthWithoutMargins: number
  } {
    return this.visualizer.Size
  }

  protected getMinMaxPitches(noExtraPadding = false): [number, number] {
    const MIN_MIDI_PITCH = 0
    const MAX_MIDI_PITCH = 127
    if (this.ns == null || this.ns.notes == null) {
      return [MIN_MIDI_PITCH, MAX_MIDI_PITCH]
    }
    if (this._config.minPitch && this._config.maxPitch) {
      return [this._config.minPitch, this._config.maxPitch]
    }

    // If the pitches haven't been specified already, figure them out
    // from the NoteSequence.
    let minPitch = this._config.minPitch ?? MAX_MIDI_PITCH
    let maxPitch = this._config.maxPitch ?? MIN_MIDI_PITCH
    // Find the smallest pitch so that we can scale the drawing correctly.
    for (const note of this.ns.notes) {
      minPitch = Math.min(note.pitch ?? MAX_MIDI_PITCH, minPitch)
      maxPitch = Math.max(note.pitch ?? MIN_MIDI_PITCH, maxPitch)
    }

    // Add a little bit of padding at the top and the bottom.
    if (!noExtraPadding) {
      minPitch -= 2
      maxPitch += 2
    }
    return [minPitch, maxPitch]
  }

  get config(): VisualizerConfig {
    const [minPitch, maxPitch] = this.getMinMaxPitches()
    const noteHeight = Math.min(
      12,
      Math.floor(this.clientHeight / Math.abs(maxPitch - minPitch) - 1)
    )
    return {
      ...this._config,
      // noteHeight: Math.round(this.clientHeight / 70),
      noteHeight: noteHeight,
      minPitch: minPitch,
      maxPitch: maxPitch,
    }
  }
  set config(value: VisualizerConfig) {
    this._config = value
    this.initVisualizer()
  }

  async updateZoom(pixelsPerTimestep: number): Promise<void> {
    this._config.pixelsPerTimeStep = pixelsPerTimestep
    await this.initVisualizerNow()
  }

  refresh() {
    this.refreshStartEndLinesPositions()
    this.refreshLoopDisplay()
    this.refreshSelectionOverlay()
    this.setSelectedRegion()
    this.refreshGenerationOverlay()
  }

  protected renderTimeout = setTimeout(() => {}, 0)
  protected visualizer: NoteByNotePianoRollSVGVisualizer
  protected readonly overlaysContainer: SVGElement = document.createElementNS(
    svgNamespace,
    'svg'
  )

  protected readonly playbackManager: MidiSheetPlaybackManager
  protected readonly regenerationCallback: () => void

  readonly emitter: EventEmitter

  constructor(
    regenerationCallback: () => void,
    playbackManager: MidiSheetPlaybackManager,
    emitter: EventEmitter,
    config?: VisualizerConfig
  ) {
    super()

    this.regenerationCallback = regenerationCallback
    this.classList.add('midi-visualizer')
    this.playbackManager = playbackManager
    this.playbackManager.on('changed-loopStart', (loopEnd) => {
      this.refreshLoopDisplay()
    })
    this.playbackManager.on('changed-loopEnd', (loopEnd) => {
      this.refreshLoopDisplay()
    })
    this.emitter = emitter
    if (config != undefined) {
      this._config = config
    }
  }

  protected refreshLoopDisplay(
    loopStartTotalProgress?: number,
    loopEndTotalProgress?: number,
    overlay: SVGRectElement | null = this.loopOverlay
  ) {
    if (overlay == null) {
      return
    }

    loopStartTotalProgress =
      loopStartTotalProgress ??
      this.playbackManager.transport.toTicks(this.playbackManager.loopStart) /
        this.playbackManager.transport.toTicks(
          this.playbackManager.totalDuration
        )
    loopEndTotalProgress =
      loopEndTotalProgress ??
      this.playbackManager.transport.toTicks(this.playbackManager.loopEnd) /
        this.playbackManager.transport.toTicks(
          this.playbackManager.totalDuration
        )

    let resetLoopButtonContainer: HTMLDivElement | null = null
    try {
      resetLoopButtonContainer = this.getElementsByClassName(
        'reset-loop-control'
      )[0] as HTMLDivElement
    } catch (e) {
      console.log('Failed to retrieve reset-loop button due to, ', e)
    }

    if (loopStartTotalProgress == 0 && loopEndTotalProgress == 1) {
      overlay.setAttribute('width', '0')
      this.topMarginLoopSetupContainer?.setAttribute('width', '0')

      this.classList.remove('enabled-loop')
    } else {
      const x = this.totalProgressToClientX(loopStartTotalProgress)
      const width = Math.abs(
        this.totalProgressToClientX(loopEndTotalProgress) -
          this.totalProgressToClientX(loopStartTotalProgress)
      )
      overlay.setAttribute('x', x.toFixed(10))
      overlay.setAttribute('width', width.toFixed(10))
      this.topMarginLoopSetupContainer?.setAttribute(
        'x',
        Math.max(0, x - 14).toFixed(10)
      )
      this.topMarginLoopSetupContainer?.setAttribute(
        'width',
        (width + 28).toFixed(10)
      )

      if (!this.inLoopSelectionOperation) {
        this.classList.add('enabled-loop')
      }
    }
  }

  protected selectionOverlay: SVGRectElement | null = null
  protected currentGenerationOverlayContainer: SVGElement | null = null
  protected currentGenerationGradient: SVGRectElement | null = null
  protected loopOverlay: SVGSVGElement | null = null
  protected pointerHoverVerticalBar: SVGLineElement | null = null
  protected startEndLines: [SVGLineElement, SVGLineElement] | [null, null] = [
    null,
    null,
  ]
  protected topMargin: HTMLDivElement | null = null
  protected topMarginLoopSetupContainer: SVGGElement | null = null

  get svgElement(): SVGSVGElement | null {
    const svgNotesContainerClass =
      ClickableVisualizerElement.cssClassesPrefix + '-notes-container'
    const elements = this.wrapper.getElementsByClassName(
      ClickableVisualizerElement.cssClassesPrefix + '-notes-container'
    )
    return elements.length > 0 ? (elements[0] as SVGSVGElement) : null
  }

  protected insertStartEndLines(): void {
    const startEndLinesClass =
      ClickableVisualizerElement.cssClassesPrefix + '-startend-lines'
    if (this.getElementsByClassName(startEndLinesClass).length > 0) {
      return
    }

    const makeDashedLineFullHeight = () => {
      const dashedLine = document.createElementNS(svgNamespace, 'line')
      dashedLine.setAttribute('x1', `0`)
      dashedLine.setAttribute('x2', `0`)
      dashedLine.setAttribute('y1', '0')
      dashedLine.setAttribute('y2', '100%')
      dashedLine.setAttribute('height', '100%')
      dashedLine.classList.add(startEndLinesClass)
      return dashedLine
    }

    this.startEndLines = [null, null].map(makeDashedLineFullHeight) as [
      SVGLineElement,
      SVGLineElement
    ]
    this.startEndLines.forEach((element) =>
      this.overlaysContainer.append(element)
    )
    this.refreshStartEndLinesPositions()
  }

  protected refreshStartEndLinesPositions(): void {
    const xPositionAttributes = ['x1', 'x2']
    if (this.startEndLines[0] != null) {
      const startLineOffset =
        NoteByNotePianoRollSVGVisualizer.clickableMarginWidth
      xPositionAttributes.forEach((attribute) => {
        this.startEndLines[0]?.setAttribute(
          attribute,
          `${Math.round(startLineOffset)}`
        )
      })
    }
    if (this.startEndLines[1] != null) {
      const endLineOffset = Math.min(
        this.totalProgressToClientX(1),
        this.overlaysContainer.scrollWidth -
          NoteByNotePianoRollSVGVisualizer.clickableMarginWidth
      )
      xPositionAttributes.forEach((attribute) => {
        this.startEndLines[1]?.setAttribute(
          attribute,
          `${Math.round(endLineOffset)}`
        )
      })
    }
  }

  protected playbackPositionCursor: SVGLineElement | null = null

  totalProgressToClientX(progress: number, noMargin = false): number {
    if (this.visualizer == null) {
      throw Error()
    }
    return (
      (noMargin ? 0 : NoteByNotePianoRollSVGVisualizer.clickableMarginWidth) +
      this.visualizer.Size.widthWithoutMargins * progress
    )
  }
  timeToClientX(time: number | null, noMargin = false): number | null {
    if (time == null || this.visualizer == null) {
      return null
    }
    const totalDuration = this.noteSequence?.totalTime
    if (totalDuration == null) {
      return null
    }
    const progress = time / totalDuration || 0
    return this.totalProgressToClientX(progress, noMargin)
  }

  setPlaybackDisplayProgress(totalProgress: number) {
    if (
      this.visualizer.Size == null ||
      this.svgElement == null ||
      this.playbackPositionCursor == null
    ) {
      console.log('woops')
      return
    }
    const nowPlayingPosition = this.totalProgressToClientX(totalProgress)
    this.playbackPositionCursor.style.transform = `translateX(${nowPlayingPosition}px)`
    // this.playbackPositionCursor.setAttribute(
    //   'x1',
    //   nowPlayingPosition.toFixed(4)
    // )
    // this.playbackPositionCursor.setAttribute(
    //   'x2',
    //   nowPlayingPosition.toFixed(4)
    // )

    const currentTime = totalProgress * this.ns.totalTime
    for (const note of this.ns?.notes ?? []) {
      this.svgElement
        .getElementById(this.visualizer.noteToRectID(note))
        .classList.toggle(
          'active',
          note.startTime <= currentTime && note.endTime > currentTime
        )
    }

    // for (const rect of this.svgElement.getElementsByTagName('rect')) {
    //   const rectX = parseFloat(rect.getAttribute('x'))
    //   const rectWidth = parseFloat(rect.getAttribute('width'))
    //   rect.classList.toggle(
    //     'active',
    //     rectX <= nowPlayingPosition && rectX + rectWidth > nowPlayingPosition
    //   )
    // }
  }

  protected insertPlaybackPositionCursor() {
    const playbackPositionCursorClass =
      ClickableVisualizerElement.cssClassesPrefix + '-playback-position-cursor'
    if (this.getElementsByClassName(playbackPositionCursorClass).length > 0) {
      return
    }
    this.playbackPositionCursor = document.createElementNS(svgNamespace, 'line')
    this.playbackPositionCursor.setAttribute('x1', '0')
    this.playbackPositionCursor.setAttribute('x2', '0')
    this.playbackPositionCursor.setAttribute('y1', '3vh')
    this.playbackPositionCursor.setAttribute('y2', '100%')
    this.playbackPositionCursor.setAttribute('width', '4px')
    this.playbackPositionCursor.classList.add(playbackPositionCursorClass)
    this.overlaysContainer.appendChild(this.playbackPositionCursor)
  }

  protected insertPointerHoverVerticalBar() {
    if (
      this.getElementsByClassName(
        ClickableVisualizerElement.cssClassesPrefix +
          'pointer-hover-verticalLine'
      ).length > 0
    ) {
      return
    }

    this.pointerHoverVerticalBar = document.createElementNS(
      svgNamespace,
      'line'
    )
    this.pointerHoverVerticalBar.setAttribute('y1', '0')
    this.pointerHoverVerticalBar.setAttribute('y2', '100%')
    this.pointerHoverVerticalBar.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-pointer-hover-verticalLine'
    )
    this.overlaysContainer.appendChild(this.pointerHoverVerticalBar)
  }

  protected insertSelectionOverlay() {
    if (
      this.getElementsByClassName(
        ClickableVisualizerElement.cssClassesPrefix + '-selection-overlay'
      ).length > 0
    ) {
      return
    }

    this.selectionOverlay = document.createElementNS(svgNamespace, 'rect')
    this.selectionOverlay.setAttribute('y', '0')
    this.selectionOverlay.setAttribute('height', '100%')
    this.selectionOverlay.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-selection-overlay'
    )
    this.overlaysContainer.appendChild(this.selectionOverlay)

    // this.currentGenerationOverlay = document.createElementNS(
    //   svgNamespace,
    //   'rect'
    // )
    // this.currentGenerationOverlay.setAttribute('y', '0')
    // this.currentGenerationOverlay.setAttribute('height', '100%')
    // this.currentGenerationOverlay.classList.add(
    //   ClickableVisualizerElement.cssClassesPrefix +
    //     '-current-generation-overlay'
    // )
    // this.overlaysContainer.appendChild(this.currentGenerationOverlay)
    this.currentGenerationOverlayContainer = document.createElementNS(
      svgNamespace,
      'svg'
    )
    this.currentGenerationOverlayContainer.setAttribute(
      'preserveAspectRatio',
      'none'
    )
    this.currentGenerationOverlayContainer.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-current-generation-overlay-container'
    )
    this.currentGenerationOverlayContainer.setAttribute(
      'viewBox',
      '0 0 100 100'
    )
    this.currentGenerationOverlayContainer.setAttribute('x', '0')
    this.currentGenerationOverlayContainer.setAttribute('y', '0')
    this.currentGenerationOverlayContainer.setAttribute('width', '200')
    this.currentGenerationOverlayContainer.setAttribute('height', '100%')
    // this.currentGenerationOverlayContainer.setAttribute('overflow', 'visible')
    // this.currentGenerationOverlay.classList.add(
    //   ClickableVisualizerElement.cssClassesPrefix +
    //     '-current-generation-overlay'
    // )
    this.overlaysContainer.appendChild(this.currentGenerationOverlayContainer)

    // this.currentGenerationGradient = document.createElementNS(
    //   svgNamespace,
    //   'rect'
    // )
    // this.currentGenerationGradient.classList.add(
    //   ClickableVisualizerElement.cssClassesPrefix +
    //     '-current-generation-gradient'
    // )
    // this.currentGenerationGradient.setAttribute('y', '0')
    // this.currentGenerationGradient.setAttribute('height', '100%')
    // this.overlaysContainer.appendChild(this.currentGenerationGradient)
    const currentGenerationDefs = document.createElementNS(svgNamespace, 'defs')

    function makeFullSize<SVGElementT extends SVGElement>(
      element: SVGElementT
    ): SVGElementT {
      element.setAttribute('x', '0')
      element.setAttribute('y', '0')
      element.setAttribute('width', '100%')
      element.setAttribute('height', '100%')
      return element
    }

    function createAndRegisterHorizontalGradientMask(
      id: string,
      stopPoints: SVGStopElement[]
    ): [SVGMaskElement, SVGRectElement] {
      const gradient = document.createElementNS(svgNamespace, 'linearGradient')
      Array.from([
        ['x1', '0%'],
        ['x2', '100%'],
        ['y1', '50%'],
        ['y2', '50%'],
      ]).forEach(([attribute, value]) => {
        gradient.setAttribute(attribute, value)
      })
      gradient.id = id + '-horizontalTransparencyGradient'
      Array.from(stopPoints).forEach((stopPoint) => {
        gradient.appendChild(stopPoint)
      })
      const transparencyMask = document.createElementNS(svgNamespace, 'mask')
      transparencyMask.id = id + '-horizontalTransparencyMask'
      const transparencyMaskFill = makeFullSize(
        document.createElementNS(svgNamespace, 'rect')
      )
      transparencyMaskFill.setAttribute('fill', `url(#${gradient.id})`)
      transparencyMask.appendChild(transparencyMaskFill)

      currentGenerationDefs.appendChild(gradient)
      currentGenerationDefs.appendChild(transparencyMask)
      return [transparencyMask, transparencyMaskFill]
    }

    const slidingMaskStopPoints = Array.from(['black', 'white']).map(
      (color, index) => {
        const stopPoint = document.createElementNS(svgNamespace, 'stop')
        stopPoint.setAttribute('offset', index.toString())
        stopPoint.setAttribute('stop-color', color)
        return stopPoint
      }
    )
    const [currentGenerationSlidingMask, currentGenerationSlidingMaskFill] =
      createAndRegisterHorizontalGradientMask(
        'slidingMask',
        slidingMaskStopPoints
      )
    currentGenerationSlidingMaskFill.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-current-generation-gradient'
    )

    const addFullWidthTransparencyMask = false
    if (addFullWidthTransparencyMask) {
      const fullWidthTransparencyMaskStopPoints = Array.from([
        ['black', '0%'],
        ['white', '20%'],
        ['white', '80%'],
        ['black', '100%'],
      ]).map(([color, offset]) => {
        const stopPoint = document.createElementNS(svgNamespace, 'stop')
        stopPoint.setAttribute('offset', offset)
        stopPoint.setAttribute('stop-color', color)
        return stopPoint
      })
      const [fullWidthTransparencyMask] =
        createAndRegisterHorizontalGradientMask(
          'fullWidthMask',
          fullWidthTransparencyMaskStopPoints
        )
      fullWidthTransparencyMask
      this.currentGenerationOverlayContainer.setAttribute(
        'mask',
        `url(#${fullWidthTransparencyMask.id})`
      )
    }

    this.currentGenerationOverlayContainer.appendChild(currentGenerationDefs)

    const currentGenerationOverlayBackground = makeFullSize(
      document.createElementNS(svgNamespace, 'rect')
    )
    currentGenerationOverlayBackground.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-current-generation-overlay'
    )
    this.currentGenerationOverlayContainer.appendChild(
      currentGenerationOverlayBackground
    )

    const currentGenerationOverlayGradient = makeFullSize(
      document.createElementNS(svgNamespace, 'rect')
    )
    currentGenerationOverlayGradient.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-current-generation-gradient-fill'
    )
    currentGenerationOverlayGradient.setAttribute(
      'mask',
      `url(#${currentGenerationSlidingMask.id})`
    )
    this.currentGenerationOverlayContainer.appendChild(
      currentGenerationOverlayGradient
    )
  }

  protected insertLoopOverlay() {
    if (
      this.getElementsByClassName(
        ClickableVisualizerElement.cssClassesPrefix + '-loop-overlay'
      ).length > 0
    ) {
      return
    }

    const topMarginSVGContainer = document.createElementNS(svgNamespace, 'svg')
    topMarginSVGContainer.setAttribute('x', '0')
    topMarginSVGContainer.setAttribute('y', '0')
    topMarginSVGContainer.setAttribute('height', '100%')
    topMarginSVGContainer.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-top-margin-svg-container'
    )
    this.topMargin?.appendChild(topMarginSVGContainer)
    const invisibleFilling = document.createElementNS(svgNamespace, 'rect')
    invisibleFilling.setAttribute('x', '0')
    invisibleFilling.setAttribute('y', '0')
    invisibleFilling.setAttribute('width', '100%')
    invisibleFilling.setAttribute('height', '100%')
    invisibleFilling.setAttribute('fill', 'transparent')
    invisibleFilling.style.visibility = 'hidden'

    this.topMarginLoopSetupContainer = document.createElementNS(
      svgNamespace,
      'svg'
    )
    this.topMarginLoopSetupContainer.setAttribute('y', '0')
    this.topMarginLoopSetupContainer.setAttribute('height', '100%')
    this.topMarginLoopSetupContainer.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-top-margin-loop-setup-container'
    )
    topMarginSVGContainer.appendChild(this.topMarginLoopSetupContainer)

    const loopRegionDisplay = document.createElementNS(svgNamespace, 'rect')
    loopRegionDisplay.classList.add(
      ClickableVisualizerElement.cssClassesPrefix +
        '-top-margin-loop-setup-display'
    )
    loopRegionDisplay.setAttribute('x', '14')
    loopRegionDisplay.setAttribute('y', '0')
    loopRegionDisplay.setAttribute('width', '100%')
    loopRegionDisplay.setAttribute('height', '100%')
    this.topMarginLoopSetupContainer.append(loopRegionDisplay)

    this.loopOverlay = document.createElementNS(svgNamespace, 'svg')
    this.loopOverlay.setAttribute('y', '0')
    this.loopOverlay.setAttribute('height', '100%')
    this.loopOverlay.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-loop-overlay-container'
    )
    this.overlaysContainer.appendChild(this.loopOverlay)

    const loopOverlayVisual = document.createElementNS(svgNamespace, 'rect')
    loopOverlayVisual.setAttribute('x', '3')
    loopOverlayVisual.setAttribute('y', '0')
    loopOverlayVisual.setAttribute('height', '100%')
    loopOverlayVisual.setAttribute('width', 'calc(100% - 6px)')
    loopOverlayVisual.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-loop-overlay'
    )
    const marginsXs = ['0', '100%']
    const makeLoopSetupMarginClasses: (
      side: 'right' | 'left',
      type: 'player-overlay-margin' | 'setup-handle' | 'setup-handle-display'
    ) => string[] = (
      side: 'right' | 'left',
      type: 'player-overlay-margin' | 'setup-handle' | 'setup-handle-display'
    ) => {
      return [
        ClickableVisualizerElement.cssClassesPrefix + '-loop-overlay-' + type,
        side + '-margin',
      ]
    }
    const makeTriangleMarkupClasses: (side: 'right' | 'left') => string[] = (
      side: 'right' | 'left'
    ) => {
      return [
        ClickableVisualizerElement.cssClassesPrefix +
          '-loop-overlay' +
          '-triangle-markup',
        side + '-margin',
      ]
    }
    const [leftMargins, rightMargins] = marginsXs.map((marginX, index) => {
      const marginSide = index == 0 ? 'left' : 'right'
      const loopSetupPlayerOverlayMarginClasses = makeLoopSetupMarginClasses(
        marginSide,
        'player-overlay-margin'
      )
      const loopSetupHandleMarginClasses = makeLoopSetupMarginClasses(
        marginSide,
        'setup-handle'
      )
      const loopSetupHandleDisplayMarginClasses = makeLoopSetupMarginClasses(
        marginSide,
        'setup-handle-display'
      )

      const loopSetupPlayerOverlayMargin = document.createElementNS(
        svgNamespace,
        'rect'
      )
      loopSetupPlayerOverlayMargin.setAttribute('y', '0')
      loopSetupPlayerOverlayMargin.setAttribute('height', '100%')
      loopSetupPlayerOverlayMargin.setAttribute('width', '3')
      loopSetupPlayerOverlayMargin.classList.add(
        ...loopSetupPlayerOverlayMarginClasses
      )
      this.loopOverlay?.appendChild(loopSetupPlayerOverlayMargin)

      const clickableArea = document.createElementNS(svgNamespace, 'rect')
      clickableArea.setAttribute('y', '0')
      clickableArea.setAttribute('height', '100%')
      clickableArea.setAttribute('x', '0')
      clickableArea.setAttribute('width', '19')
      clickableArea.setAttribute('fill', 'transparent')
      const displayArea = document.createElementNS(svgNamespace, 'rect')
      displayArea.setAttribute('y', '0')
      displayArea.setAttribute('height', '100%')
      displayArea.setAttribute('x', '8')
      displayArea.setAttribute('width', '3')
      const groupContainer = document.createElementNS(svgNamespace, 'g')
      const triangleMarkupContainer = document.createElementNS(
        svgNamespace,
        'svg'
      )
      const groupContainerClass =
        ClickableVisualizerElement.cssClassesPrefix +
        '-loop-overlay' +
        '-triangle-markup-group'
      groupContainer.classList.add(groupContainerClass)
      groupContainer.classList.add((index == 0 ? 'left' : 'right') + '-margin')
      groupContainer.appendChild(triangleMarkupContainer)
      triangleMarkupContainer.setAttribute('viewBox', '0 0 310 320')
      const triangleMarkup = document.createElementNS(svgNamespace, 'polygon')
      triangleMarkup.setAttribute('points', '160,10 10,300 310,300')
      const rotationAngle = index == 0 ? '90' : '-90'
      triangleMarkup.setAttribute(
        'transform',
        `rotate(${rotationAngle}, 160, 115)`
      )
      triangleMarkupContainer.setAttribute('x', index == 0 ? '17' : '-32')
      triangleMarkupContainer.setAttribute('y', '0')
      triangleMarkupContainer.setAttribute('width', '15px')
      triangleMarkupContainer.setAttribute('height', '30%')
      triangleMarkupContainer.setAttribute('preserveAspectRatio', 'none')

      const triangleMarkupClasses = makeTriangleMarkupClasses(marginSide)
      triangleMarkupContainer.classList.add(...triangleMarkupClasses)

      triangleMarkupContainer.appendChild(triangleMarkup)
      this.topMarginLoopSetupContainer?.appendChild(groupContainer)

      this.topMarginLoopSetupContainer?.appendChild(clickableArea)
      this.topMarginLoopSetupContainer?.appendChild(displayArea)
      clickableArea.classList.add(...loopSetupHandleMarginClasses)
      displayArea.classList.add(...loopSetupHandleDisplayMarginClasses)
      return [loopSetupPlayerOverlayMargin, clickableArea]
    })

    // this.topMarginLoopSetupContainer.insertBefore(
    //   invisibleFilling,
    //   this.topMarginLoopSetupContainer.firstChild
    // )

    let isDraggingMargin: 'left' | 'right' | null = null

    this.loopOverlay.appendChild(loopOverlayVisual)
    this.refreshLoopDisplay()

    const topMarginLoopControls = [leftMargins[1], rightMargins[1]]
    topMarginLoopControls.forEach((element, index) =>
      element.addEventListener('pointerdown', (ev: PointerEvent) => {
        if (
          !(this.inLoopSelectionOperation || this.initLoopSelectionOperation)
        ) {
          ev.preventDefault()
          ev.stopImmediatePropagation()
          isDraggingMargin = index == 0 ? 'left' : 'right'
          this.topMargin?.setPointerCapture(ev.pointerId)
        }
      })
    )
    this.topMargin?.addEventListener('pointerup', (ev: PointerEvent) => {
      if (isDraggingMargin) {
        this.inLoopSelectionOperation = false
        isDraggingMargin = null
        this.refreshLoopDisplay()
      }
    })
    this.topMargin?.addEventListener('pointerleave', (ev: PointerEvent) => {
      if (isDraggingMargin) {
        this.inLoopSelectionOperation = false
        isDraggingMargin = null
        this.refreshLoopDisplay()
      }
    })
    this.topMargin?.addEventListener(
      'pointermove',
      async (ev: PointerEvent) => {
        const onPointerMove = () => {
          this.inLoopSelectionOperation = true
          if (isDraggingMargin == 'left') {
            const currentLoopEnd = this.playbackManager.loopEnd
            const newLoopStart = this.playbackManager.totalProgressToTime(
              this.offsetXToGlobalProgress(ev.offsetX)
            )
            this.setLoopPoints(newLoopStart, currentLoopEnd)
          } else {
            const currentLoopStart = this.playbackManager.loopStart
            const newLoopEnd = this.playbackManager.totalProgressToTime(
              this.offsetXToGlobalProgress(ev.offsetX)
            )
            this.setLoopPoints(currentLoopStart, newLoopEnd)
          }
        }
        if (isDraggingMargin != null) {
          if (
            isDraggingMargin != null &&
            ev.pageX > document.body.clientWidth - 10 &&
            this.wrapperScrollLeft + this.clientWidth <
              this.wrapperScrollWidth - 10
          ) {
            this.wrapperScrollLeft += 50
          }
          if (
            isDraggingMargin != null &&
            ev.pageX < 10 &&
            this.wrapperScrollLeft > 0
          ) {
            this.wrapperScrollLeft -= 50
          }
          onPointerMove()
        }
      }
    )
  }

  static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  static get observedAttributes() {
    return [
      ...VisualizerElement.observedAttributes,
      'selection_timestamp_a',
      'selection_timestamp_b',
      'current_generation_timestamp_a',
      'current_generation_timestamp_b',
    ]
  }

  attributeChangedCallback(name: string, _oldValue: string, _newValue: string) {
    if (name === 'selection_timestamp_b') {
      try {
        this.setSelectedRegion()
      } catch {}
    }
    if (name === 'current_generation_timestamp_b') {
      try {
        this.refreshGenerationOverlay()
      } catch {}
    }
    super.attributeChangedCallback(name, _oldValue, _newValue)
  }

  protected _selectionTimestamp_A: number = 0
  protected _selectionTimestamp_B: number = 0

  // FIXME(@tbazin, 2022/09/01): clean this up!!
  protected get selectionTimestamp_A(): number | null {
    return this.parseAttribute('selection_timestamp_a')
  }
  protected get selectionTimestamp_B(): number | null {
    return this.parseAttribute('selection_timestamp_b')
  }
  protected set selectionTimestamp_A(value: number | null) {
    this.setTimestamp('selection_timestamp_a', value)
  }
  protected set selectionTimestamp_B(value: number | null) {
    this.setTimestamp('selection_timestamp_b', value)
  }

  get currentGenerationTimestamp_A(): number | null {
    return this.parseAttribute('current_generation_timestamp_a')
  }
  get currentGenerationTimestamp_B(): number | null {
    return this.parseAttribute('current_generation_timestamp_b')
  }
  set currentGenerationTimestamp_A(value: number | null) {
    this.setTimestamp('current_generation_timestamp_a', value)
  }
  set currentGenerationTimestamp_B(value: number | null) {
    this.setTimestamp('current_generation_timestamp_b', value)
  }

  protected setTimestamp(target: string, value: number | null): void {
    this.setOrRemoveAttribute(target, value != null ? value.toFixed(10) : '')
  }

  protected scrollIntoViewIfNeeded(
    scrollIntoView: boolean,
    activeNotePosition: number
  ) {
    if (scrollIntoView && this.parentElement) {
      // See if we need to scroll the container.
      if (activeNotePosition < this.parentElement.scrollLeft) {
        this.parentElement.scrollLeft = activeNotePosition - 20
      }
    }
  }

  redraw(activeNote?: NoteSequence.INote) {
    super.redraw(activeNote)
    const activeNotes = this.wrapper.getElementsByClassName('note active')
    if (activeNotes.length == 0) {
      return
    }
    const minRight = Math.min(
      ...Array.from(activeNotes).map((element) => {
        let [x, width]: [number | null, number | null] = [null, null]
        try {
          ;[x, width] = ClickableVisualizerElement.locateElement(element)
        } catch {
          return 1000000000
        }
        return x + width
      })
    )
    if (this.wrapper.scrollLeft > minRight) {
      this.wrapper.scrollLeft = minRight - 20
    }
  }

  protected parseAttribute(name: string): number | null {
    const value = this.getAttribute(name)
    if (value == null) {
      return null
    }
    return parseFloat(value)
  }
  protected parseAttributeForce(name: string): number {
    const value = this.getAttribute(name)
    if (value == null) {
      throw Error('Value error')
    }
    return parseFloat(value)
  }

  protected minMax(
    a: number | null,
    b: number | null
  ): [number | null, number | null] {
    if (a == null) {
      return [null, null]
    }
    if (b == null) {
      return [this.selectionTimestamp_A, null]
    }
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    return [min, max]
  }
  get selectionTimestamps(): [number | null, number | null] {
    return this.minMax(this.selectionTimestamp_A, this.selectionTimestamp_B)
  }
  get currentGenerationTimestamps(): [number | null, number | null] {
    return this.minMax(
      this.currentGenerationTimestamp_A,
      this.currentGenerationTimestamp_B
    )
  }

  protected inSelectionInteraction: boolean = false
  protected startingSelectionInteraction: boolean = false
  get InSelectionInteraction(): boolean {
    return this.inSelectionInteraction
  }

  protected async initVisualizerNow(): Promise<void> {
    this.initTimeout = null
    if (!this.domInitialized) {
      return
    }
    if (this.src) {
      this.ns = null
      this.ns = await urlToNoteSequence(this.src)
    }

    if (!this.ns) {
      return
    }

    if (this.visualizer != null && this.svgElement != null) {
      this.svgElement.innerHTML = ''
      this.visualizer = new NoteByNotePianoRollSVGVisualizer(
        this.ns,
        this.svgElement,
        this.config
      )
      this.refresh()
    } else {
      this.wrapper.classList.add('piano-roll-visualizer')
      const svg = document.createElementNS(svgNamespace, 'svg')
      svg.classList.add(
        ClickableVisualizerElement.cssClassesPrefix + '-notes-container'
      )
      this.wrapper.appendChild(svg)

      this.visualizer = new NoteByNotePianoRollSVGVisualizer(
        this.ns,
        svg,
        this.config
      )
      this.overlaysContainer.classList.add(
        ClickableVisualizerElement.cssClassesPrefix + '-overlays-container'
      )
      // should insert before notes container to avoid visual occlusion
      this.wrapper.insertBefore(this.overlaysContainer, this.svgElement)

      this.registerSVGEventListeners()

      this.insertPointerHoverVerticalBar()
      this.insertStartEndLines()
      this.insertSelectionOverlay()
      this.insertPlaybackPositionCursor()

      this.insertTimeControlTopMargin()
      this.insertLoopOverlay()
      // this.registerDropHandlers()
      this.emitter.emit('ready')
    }
  }

  protected get wrapperScrollWidth(): number {
    return this.getElementsByClassName('simplebar-content-wrapper')[0]
      .scrollWidth
  }
  protected get wrapperScrollLeft(): number {
    return this.getElementsByClassName('simplebar-content-wrapper')[0]
      .scrollLeft
  }
  protected set wrapperScrollLeft(newScrollLeft: number) {
    this.getElementsByClassName('simplebar-content-wrapper')[0].scrollLeft =
      newScrollLeft
  }

  protected insertTimeControlTopMargin() {
    const topMarginClass =
      ClickableVisualizerElement.cssClassesPrefix + '-top-margin'
    if (this.getElementsByClassName(topMarginClass).length > 0) {
      return
    }

    this.topMargin = document.createElement('div')
    this.topMargin.classList.add(topMarginClass)
    this.wrapper.appendChild(this.topMargin)

    const seekTimelineElement = document.createElement('div')
    seekTimelineElement.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-seek-timeline'
    )
    this.topMargin.appendChild(seekTimelineElement)

    const loopSetupTimelineElement = document.createElement('div')
    loopSetupTimelineElement.classList.add(
      ClickableVisualizerElement.cssClassesPrefix + '-loop-setup-timeline'
    )
    this.topMargin.appendChild(loopSetupTimelineElement)

    // this.topMargin.addEventListener('dblclick', (ev: MouseEvent) => {
    //   this.resetLoopPoints()
    // })
    seekTimelineElement.addEventListener('pointerdown', (ev: MouseEvent) => {
      // if (this.doubleTaptopMarginTimeout == null) {
      //   this.doubleTaptopMarginTimeout = setTimeout(() => {
      //     this.doubleTaptopMarginTimeout = null
      //   }, 200)
      // } else {
      this.seekCallback(ev)
      // this.doubleTaptopMarginTimeout = null
      // }
    })
    this.topMargin.addEventListener('pointerdown', (ev: PointerEvent) => {
      if (this.topMargin == null) {
        return
      }
      if (ev.target == loopSetupTimelineElement) {
        this.resetLoopPoints()
        this.topMargin?.removeAttribute('loopStartCandidate')
        this.initLoopSelectionOperation = true
        this.inLoopSelectionOperation = false
        this.topMargin.setAttribute('loopStartCandidate', ev.offsetX.toFixed(4))
        document.body.setPointerCapture(ev.pointerId)
      }
    })
    // document.body.addEventListener('pointerleave', (ev: PointerEvent) => {
    //   if (this.initLoopSelectionOperation || this.inLoopSelectionOperation) {
    //     this.resetLoopPoints()
    //     this.initLoopSelectionOperation = false
    //     this.inLoopSelectionOperation = false
    //     this.topMargin?.removeAttribute('loopStartCandidate')
    //   }
    // })
    document.body.addEventListener('pointermove', (ev: PointerEvent) => {
      if (this.topMargin == null) {
        return
      }

      if (
        this.initLoopSelectionOperation &&
        this.topMargin.hasAttribute('loopStartCandidate')
      ) {
        this.initLoopSelectionOperation = false
        this.inLoopSelectionOperation = true
      }
      if (
        this.inLoopSelectionOperation &&
        this.topMargin.hasAttribute('loopStartCandidate')
      ) {
        if (
          ev.pageX > document.body.clientWidth - 10 &&
          this.wrapperScrollLeft + this.clientWidth <
            this.wrapperScrollWidth - 10
        ) {
          this.wrapperScrollLeft += 50
        }
        if (ev.pageX < 10 && this.wrapperScrollLeft > 0) {
          this.wrapperScrollLeft -= 50
        }
        this.resetLoopPoints()
        const offsetXStart = parseFloat(
          this.topMargin.getAttribute('loopStartCandidate') as string
        )
        const totalProgressStart = this.offsetXToGlobalProgress(
          offsetXStart
        ) as number
        const totalProgressEnd = this.offsetXToGlobalProgress(
          ev.pageX + this.wrapperScrollLeft
        ) as number
        this.refreshLoopDisplay(
          Math.min(totalProgressStart, totalProgressEnd),
          Math.max(totalProgressStart, totalProgressEnd)
        )
      }
    })
    // this.topMargin.addEventListener('pointerleave', (ev: PointerEvent) => {
    //   this.initLoopSelectionOperation = false
    //   if (this.topMargin == null) {
    //     return
    //   }
    //   this.topMargin.removeAttribute('loopStartCandidate')
    //   this.refreshLoopDisplay()
    //   this.inLoopSelectionOperation = false
    // })
    document.body.addEventListener('pointerup', (ev: PointerEvent) => {
      if (this.topMargin == null) {
        return
      }
      if (
        this.initLoopSelectionOperation &&
        this.topMargin.hasAttribute('loopStartCandidate')
      ) {
        this.initLoopSelectionOperation = false
        this.topMargin.removeAttribute('loopStartCandidate')
        return
      }
      if (
        this.inLoopSelectionOperation &&
        this.topMargin.hasAttribute('loopStartCandidate')
      ) {
        this.setLoopPointsCallback(ev.pageX + this.wrapperScrollLeft)
        this.classList.add('enabled-loop')
        this.topMargin.removeAttribute('loopStartCandidate')
        this.inLoopSelectionOperation = false
      }
    })
    this.inLoopSelectionOperation = false

    if (this.getElementsByTagName('reset-loop-control').length == 0) {
      const resetLoopButtonContainer = document.createElement('div')
      resetLoopButtonContainer.classList.add(
        'reset-loop-control',
        'control-item'
      )
      this.appendChild(resetLoopButtonContainer)
      const resetLoopButton = document.createElement('div')
      resetLoopButton.classList.add('fa-1x', 'fa-stack')
      resetLoopButtonContainer.appendChild(resetLoopButton)
      const resetLoopButtonIcon = document.createElement('i')
      resetLoopButtonIcon.classList.add(
        'fa-stack-1x',
        'fa-solid',
        'fa-repeat',
        'reset-loop-control-loop-icon'
      )
      const overlayDisableIcon = document.createElement('i')
      overlayDisableIcon.classList.add(
        'fa-stack-2x',
        'fa-solid',
        'fa-ban',
        'reset-loop-control-disable-icon'
      )
      resetLoopButton.appendChild(resetLoopButtonIcon)
      resetLoopButton.appendChild(overlayDisableIcon)

      resetLoopButtonContainer.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation()
        this.resetLoopPoints()
      })
    }
  }

  protected registerDropHandlers() {
    if (this.svgElement == null) {
      return
    }
    this.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      void this.dropHandler(e)
      this.classList.remove('in-dragdrop-operation')
    })
    this.addEventListener('dragover', (e: DragEvent) => {
      if (e.dataTransfer != null) {
        e.stopPropagation()
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    })
    this.addEventListener('dragenter', (e: DragEvent) => {
      if (e.dataTransfer != null) {
        e.stopPropagation()
        e.preventDefault()
        this.classList.add('in-dragdrop-operation')
      }
    })
    this.addEventListener('dragleave', (e: DragEvent) => {
      if (e.dataTransfer != null) {
        e.stopPropagation()
        e.preventDefault()
        this.classList.remove('in-dragdrop-operation')
      }
    })
  }

  protected offsetXToGlobalProgress(offsetX: number): number | null {
    if (this.svgElement == null || this.visualizer.Size == null) {
      return null
    }
    const progress =
      (offsetX - NoteByNotePianoRollSVGVisualizer.clickableMarginWidth) /
      this.visualizer.Size.widthWithoutMargins
    return Math.max(0, Math.min(1, progress))
  }
  protected pointerEventToGlobalProgress(
    ev: PointerEvent | MouseEvent
  ): number | null {
    return this.offsetXToGlobalProgress(ev.offsetX)
  }
  protected pointerEventToTime(ev: PointerEvent | MouseEvent): number | null {
    if (this.svgElement == null) {
      return null
    }
    const duration = this.noteSequence?.totalTime
    const progress = this.pointerEventToGlobalProgress(ev)
    if (duration == null || progress == null) {
      return null
    }
    return duration * progress
  }

  protected seekCallback = (ev: PointerEvent | MouseEvent) => {
    const clickProgress = this.pointerEventToGlobalProgress(ev)
    if (clickProgress == null) {
      return
    }
    this.setPlaybackDisplayProgress(clickProgress)
    this.playbackManager.transport.seconds =
      this.playbackManager.transport.toSeconds(
        this.playbackManager.totalDuration
      ) * clickProgress
  }

  protected setLoopPoints(
    loopStart: Tone.Unit.Time,
    loopEnd: Tone.Unit.Time
  ): boolean {
    loopStart = this.playbackManager.transport.toSeconds(loopStart)
    loopEnd = this.playbackManager.transport.toSeconds(loopEnd)
    let isValidLoop = loopEnd - loopStart > 0.1
    if (isValidLoop) {
      this.playbackManager.loopStart = loopStart
      this.playbackManager.loopEnd = loopEnd
    }
    this.getElementsByClassName('reset-loop-control')[0].classList.toggle(
      'disabled-loop',
      !isValidLoop
    )
  }

  protected resetLoopPoints(): void {
    this.setLoopPoints(0, this.playbackManager.totalDuration)
    this.refreshLoopDisplay()
  }

  protected setLoopPointsCallback = (offsetX: number) => {
    const clickGlobalProgress_A = this.offsetXToGlobalProgress(
      parseFloat(this.topMargin.getAttribute('loopStartCandidate'))
    )
    const clickGlobalProgress_B = this.offsetXToGlobalProgress(offsetX)
    if (clickGlobalProgress_A == null || clickGlobalProgress_B == null) {
      return
    }
    // this.setPlaybackDisplayProgress(clickProgress)
    const candidateLoopCue_A =
      this.playbackManager.transport.toSeconds(
        this.playbackManager.totalDuration
      ) * clickGlobalProgress_A
    const candidateLoopCue_B =
      this.playbackManager.transport.toSeconds(
        this.playbackManager.totalDuration
      ) * clickGlobalProgress_B
    const hasUpdatedLoop = this.setLoopPoints(
      Math.min(candidateLoopCue_A, candidateLoopCue_B),
      Math.max(candidateLoopCue_A, candidateLoopCue_B)
    )
    if (!hasUpdatedLoop) {
      this.refreshLoopDisplay()
    }
  }

  protected _lastPointermoveClientX: number | null = null
  get lastPointermoveClientX(): number | null {
    return this._lastPointermoveClientX
  }

  protected registerSVGEventListeners(): void {
    if (this.svgElement == null) {
      return
    }
    this.svgElement.addEventListener('pointerdown', (ev: PointerEvent) => {
      if (this.selectionOverlay == null || this.svgElement == null) {
        return
      }
      const clickTime = this.pointerEventToTime(ev)
      if (clickTime == null) {
        return
      }
      ev.preventDefault()
      ev.stopPropagation()
      if (!ev.shiftKey) {
        this.selectionTimestamp_B = null
        this.resetSelectedRegion()
        try {
          this.setSelectedRegion()
        } catch {}
        this.selectionOverlay.setAttribute('width', '0')
        this.selectionTimestamp_A = clickTime
        this.selectionTimestamp_B = clickTime
        this.startingSelectionInteraction = true
      } else {
        this.seekCallback(ev)
      }
    })
    // this.svgElement.addEventListener('
    this.svgElement.addEventListener('pointermove', (ev: PointerEvent) => {
      this._lastPointermoveClientX = ev.clientX
      this.setCursorHoverPosition(ev.offsetX)
    })
    this.svgElement.addEventListener('pointerleave', (ev: PointerEvent) => {
      if (this.pointerHoverVerticalBar != null) {
        this.pointerHoverVerticalBar.style.visibility = 'hidden'
      }
    })
    this.svgElement.addEventListener('pointerenter', (ev: PointerEvent) => {
      if (this.pointerHoverVerticalBar != null) {
        this.pointerHoverVerticalBar.style.visibility = 'visible'
      }
    })
    this.svgElement.addEventListener('pointermove', (ev: PointerEvent) => {
      if (this.selectionOverlay == null || this.svgElement == null) {
        return
      }
      if (ev.offsetY < 0 || ev.offsetY > this.svgElement.clientHeight) {
        this.resetSelectedRegion()
      }
      if (!this.inSelectionInteraction && this.startingSelectionInteraction) {
        this.inSelectionInteraction = true
        this.startingSelectionInteraction = false
      }
      if (!this.inSelectionInteraction) {
        return
      }
      const clickTime = this.pointerEventToTime(ev)
      if (clickTime == null) {
        return
      }
      this.selectionTimestamp_B = clickTime
      // if (
      //   this.selectionTimestamp_A != null &&
      //   this.selectionTimestamp_B != null &&
      //   this.selectionTimestamps[1] != null
      // ) {
      //   const [, timestampRight] = this.minMax(
      //     this.selectionTimestamp_A,
      //     this.selectionTimestamp_B
      //   ) as [number, number]
      //   const [_, updatedTimestampRight, firstNoteAfterRegionIndex] =
      //     this.resizeSelectedRegionEnd(timestampRight)
      //   if (
      //     this.selectionTimestamp_A < this.selectionTimestamp_B &&
      //     firstNoteAfterRegionIndex != 0
      //   ) {
      //     this.selectionTimestamp_B = updatedTimestampRight
      //     this.selectionTimestamp_B -= 0.000001
      //   } else {
      //     this.selectionTimestamp_A = updatedTimestampRight
      //     this.selectionTimestamp_A -= 0.000001
      //     if (firstNoteAfterRegionIndex != 0) {
      //       this.selectionTimestamp_B += 0.000001
      //     }
      //   }
      // }
      this.refreshSelectionOverlay()
    })
    this.svgElement.addEventListener('pointerup', (e: PointerEvent) => {
      if (VITE_SCREENSHOT_MODE) {
        return
      }
      if (this.inSelectionInteraction && this.selectionIsValid) {
        this.copySelectionOverlayToRegenerationOverlay()
        this.regenerationCallback()
      }
      this.resetSelectedRegion()
    })
    this.svgElement.addEventListener('pointerleave', () => {
      if (VITE_SCREENSHOT_MODE) {
        return
      }
      this._lastPointermoveClientX = null
      this.resetSelectedRegion()
    })
  }

  protected resizeSelectedRegionEnd(
    regionEndQuarters: number
  ): [number, number, number] {
    if (this.noteSequence == null || this.noteSequence.notes == null) {
      return [regionEndQuarters, regionEndQuarters, -1]
    }
    const sortedNotes = this.noteSequence.notes
      .filter((note) => note.startTime != undefined)
      .sort((a, b) => a.startTime ?? 0 - (b.startTime ?? 0))
    const firstIndexAfterRegion = sortedNotes.findIndex(
      (note) => note.startTime != null && note.startTime > regionEndQuarters
    )
    if (firstIndexAfterRegion > 0) {
      const startTimeOfLastNoteInRegion =
        sortedNotes[firstIndexAfterRegion - 1].startTime
      return [
        startTimeOfLastNoteInRegion as number,
        sortedNotes[firstIndexAfterRegion].startTime as number,
        firstIndexAfterRegion,
      ]
    } else if (firstIndexAfterRegion == 0) {
      return [
        regionEndQuarters,
        sortedNotes[firstIndexAfterRegion].startTime as number,
        firstIndexAfterRegion,
      ]
    } else {
      return [regionEndQuarters, regionEndQuarters, firstIndexAfterRegion]
    }
  }

  protected get selectionIsValid(): boolean {
    // the PIA API fails on too short selections
    if (
      this.selectionTimestamp_A == null ||
      this.selectionTimestamp_B == null
    ) {
      return false
    }
    const selectionIsLongEnough =
      (Math.abs(this.selectionTimestamp_B - this.selectionTimestamp_A) * 60) /
        120 >
      0.2
    return selectionIsLongEnough
  }

  protected refreshSelectionOverlay(): void {
    if (this.selectionOverlay == null) {
      return
    }
    if (
      this.selectionTimestamp_A == null ||
      this.selectionTimestamp_B == null
    ) {
      this.selectionOverlay.setAttribute('x', '0')
      this.selectionOverlay.setAttribute('width', '0')
      return
    }

    this.selectionOverlay.classList.toggle(
      'invalid-selection',
      !this.selectionIsValid
    )
    const [x_left, x_right] = this.selectionTimestamps.map((timestamp) =>
      this.timeToClientX(timestamp)
    ) as [number, number]
    this.selectionOverlay.setAttribute('x', x_left.toString())
    this.selectionOverlay.setAttribute(
      'width',
      Math.abs(x_right - x_left).toString()
    )
  }

  protected copySelectionOverlayToRegenerationOverlay() {
    this.currentGenerationTimestamp_A = this.selectionTimestamp_A
    this.currentGenerationTimestamp_B = this.selectionTimestamp_B
  }
  protected refreshGenerationOverlay(): void {
    if (this.currentGenerationOverlayContainer == null) {
      return
    }
    const [x_A, x_B] = this.currentGenerationTimestamps.map((timestamp) =>
      this.timeToClientX(timestamp)
    )
    if (x_A == null || x_B == null) {
      this.currentGenerationOverlayContainer.setAttribute('x', '0')
      this.currentGenerationOverlayContainer.setAttribute('width', '0')
    } else {
      const x = (x_A - 7).toString()
      const width = Math.abs(x_B - x_A) + 14
      this.currentGenerationOverlayContainer.setAttribute('x', x)
      this.currentGenerationOverlayContainer.setAttribute(
        'width',
        width.toString()
      )
      this.currentGenerationOverlayContainer.style.animationDuration = `${
        Math.sqrt(width) / 5
      }s`
      // this.currentGenerationGradient.setAttribute(
      //   'width',
      //   Math.min(width / 10, 20).toFixed()
      // )
    }
  }

  setCursorHoverPosition(offsetX: number) {
    if (this.pointerHoverVerticalBar != null) {
      this.pointerHoverVerticalBar.setAttribute('x1', offsetX.toFixed(2))
      this.pointerHoverVerticalBar.setAttribute('x2', offsetX.toFixed(2))
    }
    if (!this.inSelectionInteraction) {
      this.setSelectedRegion([offsetX, offsetX + 20], true)
    }
  }

  protected resetSelectedRegion() {
    this.inSelectionInteraction = false
    this.startingSelectionInteraction = false
    this.selectionTimestamp_A = null
    this.selectionTimestamp_B = null
    this.selectionOverlay?.setAttribute('width', '0')
  }
  protected setSelectedRegion(
    timestamps?: [number, number],
    candidateSelection = false
  ) {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
    }
    this.renderTimeout = setTimeout(() => {
      if (this.noteSequence == null) {
        return
      }
      if (this.svgElement == null || this.svgElement.children == null) {
        return
      }
      const selectionClasses = candidateSelection
        ? ['candidate-selection']
        : ['selected']
      if (!this.selectionIsValid) {
        selectionClasses.push('invalid-selection')
      }

      const noteElements = Array.from(
        this.svgElement.getElementsByClassName('note')
      )
      noteElements.forEach((element) => {
        const classesToRemove = [
          'candidate-selection',
          'invalid-selection',
          'selected',
        ]
        element.classList.remove(...classesToRemove)
      })

      const [currentGeneration_left_x, currentGeneration_right_x] =
        this.currentGenerationTimestamps.map((timestamp) =>
          this.timeToClientX(timestamp)
        )
      const currentlyGenerating =
        currentGeneration_left_x != null && currentGeneration_right_x != null

      const sortedNoteElements = (
        noteElements
          .map(((element) => {
            try {
              return [
                element,
                ClickableVisualizerElement.locateElement(element)[0],
              ]
            } catch {
              return null
            }
          }) as (element: Element) => [Element, number] | null)
          .filter((value) => value != null) as [Element, number][]
      ).sort(([, x_A], [, x_B]) => x_A - x_B)

      if (currentlyGenerating) {
        const startIndex = sortedNoteElements.findIndex(
          ([, x]) =>
            x >= currentGeneration_left_x && x < currentGeneration_right_x
        )
        if (startIndex >= 0) {
          for (let i = startIndex; i < sortedNoteElements.length; i++) {
            const [elem, x] = sortedNoteElements[i]
            if (x > currentGeneration_right_x) {
              break
            }
            elem.classList.add('recently-generated')
          }
        }
      }

      const [selectionTimestamp_left_x, selectionTimestamp_right_x] =
        timestamps ??
        this.selectionTimestamps.map((timestamp) =>
          this.timeToClientX(timestamp)
        )
      if (
        selectionTimestamp_left_x != null &&
        selectionTimestamp_right_x != null
      ) {
        const startIndex = sortedNoteElements.findIndex(
          ([, x]) =>
            x >= selectionTimestamp_left_x && x < selectionTimestamp_right_x
        )
        if (startIndex >= 0) {
          for (let i = startIndex; i < sortedNoteElements.length; i++) {
            const [elem, x] = sortedNoteElements[i]
            if (x > selectionTimestamp_right_x) {
              break
            }
            if (x >= selectionTimestamp_left_x) {
              elem.classList.add(...selectionClasses)
            }
          }
        }
      }
    }, 1)
  }

  static locateElement(element: Element): [number, number] {
    const x_string = element.getAttribute('x')
    const width_string = element.getAttribute('width')
    if (x_string == null || width_string == null) {
      throw Error('Value error')
    }
    const x = parseFloat(x_string)
    const width = parseFloat(width_string)
    return [x, width]
  }

  drawNote(
    note: NoteSequence.INote,
    noteIndex?: number
  ): SVGRectElement | null {
    const dataAttributes: DataAttribute[] = [
      ['instrument', note.instrument],
      ['program', note.program],
      ['isDrum', note.isDrum === true],
      ['pitch', note.pitch],
    ]
    const velocity = note.velocity != undefined ? note.velocity : 127
    const cssProperties: CSSProperty[] = [
      [
        '--midi-velocity',
        String(note.velocity != undefined ? note.velocity : 127),
      ],
    ]
    const { x, y, w, h } = this.visualizer.getNotePositionPublic(note, 0)
    const rect = this.visualizer.drawNote(
      x,
      y,
      w,
      h,
      'blue',
      dataAttributes,
      cssProperties
    )
    if (rect != null) {
      rect.id = this.visualizer.noteToRectID(note)
    }
    return rect
  }

  async dropHandler(e: DragEvent): Promise<void> {
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
          const midiFile = e.dataTransfer.items[i].getAsFile()
          if (midiFile == null) {
            continue
          }
          const midiURL = URL.createObjectURL(
            new Blob([await midiFile.arrayBuffer()])
          )
          // player.src = midiURL
          this.src = midiURL
        }
      }
    }
  }
}

window.customElements.define(
  'clickable-midi-visualizer',
  ClickableVisualizerElement
)
