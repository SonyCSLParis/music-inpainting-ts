import { NoteSequence, INoteSequence } from '@magenta/music/esm/protobuf'
import {
  PianoRollSVGVisualizer,
  VisualizerConfig,
} from '@magenta/music/esm/core/visualizer'
import { urlToNoteSequence } from '@magenta/music/esm/core/midi_io'
import * as mm_sequences from '@magenta/music/esm/core/sequences'

import { PlayerElement, VisualizerElement } from 'html-midi-player'

import './Player.scss'
import { PlaybackManager } from '../playback'
import * as Tone from 'tone'
import EventEmitter from 'events'

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
      note.program = 0
      return note
    })

  noteSequence.notes = firstVoice
  return new NoteSequence({ ...noteSequence.toJSON() })
}

function normalizeVelocity(
  noteSequence: NoteSequence,
  targetMeanVelocity: number
): NoteSequence {
  const notes = noteSequence.notes
  const numNotesNonNullVelocity = notes.filter(
    (note) => note.velocity != null
  ).length
  const sumVelocities = notes.reduce(
    (acc, note) => acc + (note.velocity || 0),
    0
  )
  const meanVelocity = sumVelocities / numNotesNonNullVelocity || 0
  noteSequence.notes = notes.map((note) => {
    note.velocity =
      note.velocity != null
        ? Math.round((note.velocity * targetMeanVelocity) / meanVelocity)
        : null
    return note
  })
  return new NoteSequence(noteSequence)
}

export function pianorollify(
  noteSequence: NoteSequence,
  cropDuration: number = 60,
  targetMeanVelocity: number = 80
): NoteSequence {
  noteSequence = removeDrums(noteSequence)
  noteSequence = mapAllInstrumentsToFirstVoice(noteSequence)
  noteSequence = trimStartSilence(noteSequence)
  noteSequence = normalizeVelocity(noteSequence, targetMeanVelocity)
  return mm_sequences.trim(noteSequence, 0, cropDuration, true)
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
    return sizeUpdated
  }

  get Size(): {
    width: number
    height: number
    widthWithoutMargins: number
  } {
    return this.getSize()
  }

  removeNote(note: NoteSequence.Note): void {
    this.svg.getElementById(this.noteToRectID(note))?.remove()
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
    rect.setAttribute('fill', fill)
    x = x + NoteByNotePianoRollSVGVisualizer.clickableMarginWidth

    // Round values to the nearest integer to avoid partially filled pixels.
    rect.setAttribute('x', `${Math.round(x)}`)
    rect.setAttribute('y', `${Math.round(y)}`)
    rect.setAttribute('width', `${Math.round(w)}`)
    rect.setAttribute('height', `${Math.round(h)}`)
    dataAttributes.forEach(([key, value]: DataAttribute) => {
      if (value !== undefined) {
        rect.dataset[key] = `${value}`
      }
    })
    cssProperties.forEach(([key, value]: CSSProperty) => {
      rect.style.setProperty(key, value)
    })
    this.svg.appendChild(rect)
    return rect
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
    return `${note.startTime}-${note.endTime}-${note.pitch}`
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
  get Size(): {
    width: number
    height: number
    widthWithoutMargins: number
  } {
    return this.visualizer.Size
  }

  get config(): VisualizerConfig {
    return {
      ...this._config,
      noteHeight: Math.round(this.clientHeight / 70),
      // minPitch: 0,
      // maxPitch: 128,
    }
  }
  set config(value: VisualizerConfig): VisualizerConfig {
    this._config = value
    this.initVisualizer()
  }

  protected renderTimeout = setTimeout(() => {}, 0)
  protected visualizer: NoteByNotePianoRollSVGVisualizer

  protected readonly playbackManager: PlaybackManager
  protected readonly regenerationCallback: () => void

  readonly emitter: EventEmitter

  constructor(
    regenerationCallback: () => void,
    playbackManager: PlaybackManager,
    emitter: EventEmitter,
    config?: VisualizerConfig
  ) {
    super()
    this.regenerationCallback = regenerationCallback
    this.classList.add('midi-visualizer')
    this.playbackManager = playbackManager
    this.emitter = emitter
    if (config != undefined) {
      this._config = config
    }
  }

  protected selectionOverlay: SVGRectElement | null = null
  protected pointerHoverVerticalBar: SVGLineElement | null = null
  protected startEndLines: [SVGLineElement, SVGLineElement] | [null, null] = [
    null,
    null,
  ]

  get svgElement(): SVGSVGElement | null {
    return this.wrapper.getElementsByTagName('svg')[0]
  }

  protected insertStartEndLines() {
    if (
      this.svgElement == null ||
      this.getElementsByClassName('midi-visualizer-startend-lines').length > 0
    ) {
      return
    }

    const makeDashedLineFullHeight = (x: number) => {
      const dashedLine = document.createElementNS(svgNamespace, 'line')
      dashedLine.setAttribute('x1', `${Math.round(x)}`)
      dashedLine.setAttribute('x2', `${Math.round(x)}`)
      dashedLine.setAttribute('y1', '0')
      dashedLine.setAttribute('y2', '100%')
      dashedLine.setAttribute('height', '100%')
      dashedLine.classList.add('midi-visualizer-startend-lines')
      return dashedLine
    }

    const startLineOffset =
      NoteByNotePianoRollSVGVisualizer.clickableMarginWidth
    const endLineOffset = Math.min(
      this.progressToClientX(1),
      this.svgElement.scrollWidth -
        NoteByNotePianoRollSVGVisualizer.clickableMarginWidth
    )
    this.startEndLines = [startLineOffset, endLineOffset]
      .reverse()
      .map(makeDashedLineFullHeight) as [SVGLineElement, SVGLineElement]
    this.startEndLines.forEach((element) =>
      this.svgElement?.insertBefore(element, this.svgElement.firstChild)
    )
  }

  protected playbackPositionCursor: SVGLineElement | null = null

  progressToClientX(progress: number): number {
    return (
      NoteByNotePianoRollSVGVisualizer.clickableMarginWidth +
      this.visualizer.Size.widthWithoutMargins * progress
    )
  }

  setPlaybackDisplayProgress(progress: number) {
    if (
      this.visualizer.Size == null ||
      this.svgElement == null ||
      this.playbackPositionCursor == null
    ) {
      console.log('woops')
      return
    }
    const nowPlayingPosition = this.progressToClientX(progress)
    this.playbackPositionCursor.setAttribute(
      'x1',
      nowPlayingPosition.toFixed(4)
    )
    this.playbackPositionCursor.setAttribute(
      'x2',
      nowPlayingPosition.toFixed(4)
    )
  }

  protected insertPlaybackPositionCursor() {
    if (
      this.getElementsByClassName('midi-visualizer-playback-position-cursor')
        .length > 0
    ) {
      return
    }
    this.playbackPositionCursor = document.createElementNS(svgNamespace, 'line')
    this.playbackPositionCursor.setAttribute('x1', '0')
    this.playbackPositionCursor.setAttribute('x2', '0')
    this.playbackPositionCursor.setAttribute('y1', '0')
    this.playbackPositionCursor.setAttribute('y2', '100%')
    this.playbackPositionCursor.setAttribute('width', '4px')
    this.playbackPositionCursor.setAttribute('height', '100%')
    this.playbackPositionCursor.classList.add(
      'midi-visualizer-playback-position-cursor'
    )
    this.svgElement?.insertBefore(
      this.playbackPositionCursor,
      this.svgElement.firstChild
    )
  }

  protected insertPointerHoverVerticalBar() {
    if (
      this.getElementsByClassName('midi-visualizer-pointer-hover-verticalLine')
        .length > 0
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
      'midi-visualizer-pointer-hover-verticalLine'
    )
    this.svgElement?.insertBefore(
      this.pointerHoverVerticalBar,
      this.svgElement.firstChild
    )
  }

  protected insertSelectionOverlay() {
    if (
      this.getElementsByClassName('midi-visualizer-selection-overlay').length >
      0
    ) {
      return
    }

    this.selectionOverlay = document.createElementNS(svgNamespace, 'rect')
    this.selectionOverlay.setAttribute('y', '0')
    this.selectionOverlay.setAttribute('height', '100%')
    this.selectionOverlay.classList.add('midi-visualizer-selection-overlay')
    this.svgElement?.insertBefore(
      this.selectionOverlay,
      this.svgElement.firstChild
    )
  }

  static get observedAttributes() {
    return [
      ...VisualizerElement.observedAttributes,
      'timestamp_a',
      'timestamp_b',
      'timestamp_a_x',
      'timestamp_b_x',
    ]
  }

  attributeChangedCallback(name: string, _oldValue: string, _newValue: string) {
    if (name === 'timestamp_b_x') {
      try {
        this.setSelectedRegion()
      } catch {}
    }
    super.attributeChangedCallback(name, _oldValue, _newValue)
  }

  protected _timestamp_A: number = 0
  protected _timestamp_B: number = 0

  protected get timestamp_A(): number {
    return this.parseAttributeForce('timestamp_a')
  }
  protected get timestamp_B(): number {
    return this.parseAttributeForce('timestamp_b')
  }
  protected get timestamp_A_ticks(): number {
    return this.parseAttributeForce('timestamp_a_ticks')
  }
  protected get timestamp_B_ticks(): number {
    return this.parseAttributeForce('timestamp_b_ticks')
  }
  protected set timestamp_A(value: number | null) {
    this.setOrRemoveAttribute(
      'timestamp_a',
      (value = value != null ? value.toFixed(10) : null)
    )
    if (
      value != null &&
      this.noteSequence?.totalTime != null &&
      this.noteSequence.ticksPerQuarter != null
    ) {
      const timestamp_A_ticks = Math.round(
        value *
          (this.noteSequence.tempos[0].qpm / 60) *
          this.noteSequence.ticksPerQuarter
      )
      this.setAttribute('timestamp_a_ticks', timestamp_A_ticks.toString())
    } else {
      this.removeAttribute('timestamp_a_ticks')
    }
  }
  protected set timestamp_B(value: number) {
    this.setOrRemoveAttribute(
      'timestamp_b',
      (value = value != null ? value.toFixed(10) : null)
    )
    if (
      value != null &&
      this.noteSequence?.totalTime != null &&
      this.noteSequence.ticksPerQuarter != null
    ) {
      const timestamp_b_ticks = Math.round(
        value *
          (this.noteSequence.tempos[0].qpm / 60) *
          this.noteSequence.ticksPerQuarter
      )
      this.setAttribute('timestamp_b_ticks', timestamp_b_ticks.toString())
    } else {
      this.removeAttribute('timestamp_b_ticks')
    }
  }
  protected get timestamp_A_x(): number {
    return this.parseAttributeForce('timestamp_a_x')
  }
  protected get timestamp_B_x(): number {
    return this.parseAttributeForce('timestamp_b_x')
  }
  protected set timestamp_A_x(value: number) {
    this.setOrRemoveAttribute('timestamp_a_x', `${value?.toFixed(10)}`)
  }
  protected set timestamp_B_x(value: number) {
    this.setOrRemoveAttribute('timestamp_b_x', `${value?.toFixed(10)}`)
  }

  protected _timestamp_A_x: number = 0
  protected _timestamp_B_x: number = 0

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

  get timestamps(): [number | null, number | null] {
    const timestamp_left = Math.min(this.timestamp_A, this.timestamp_B)
    const timestamp_right = Math.max(this.timestamp_A, this.timestamp_B)
    return [timestamp_left, timestamp_right]
  }
  get timestamps_ticks(): [number | null, number | null] {
    const timestamp_left = Math.min(
      this.timestamp_A_ticks,
      this.timestamp_B_ticks
    )
    const timestamp_right = Math.max(
      this.timestamp_A_ticks,
      this.timestamp_B_ticks
    )
    return [timestamp_left, timestamp_right]
  }
  get timestamps_x(): [number | null, number | null] {
    const timestamp_left = Math.min(this.timestamp_A_x, this.timestamp_B_x)
    const timestamp_right = Math.max(this.timestamp_A_x, this.timestamp_B_x)
    return [timestamp_left, timestamp_right]
  }

  protected inSelectionInteraction: boolean = false
  protected startingSelectionInteraction: boolean = false
  get InSelectionInteraction(): boolean {
    return this.inSelectionInteraction
  }

  protected async initVisualizerNow(): Promise<void> {
    await super.initVisualizerNow()
    if (this.ns != null && this.svgElement != null) {
      this.visualizer = new NoteByNotePianoRollSVGVisualizer(
        this.ns,
        this.svgElement,
        this.config
      )
    }
    this.registerSVGEventListeners()

    this.insertPointerHoverVerticalBar()
    this.insertStartEndLines()
    this.insertSelectionOverlay()
    this.insertPlaybackPositionCursor()
    // this.registerDropHandlers()
    this.emitter.emit('ready')
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

  protected offsetXToProgress(offsetX: number): number | null {
    if (this.svgElement == null || this.visualizer.Size == null) {
      return null
    }
    const progress =
      (offsetX - NoteByNotePianoRollSVGVisualizer.clickableMarginWidth) /
      this.visualizer.Size.widthWithoutMargins
    return Math.max(0, Math.min(1, progress))
  }
  protected pointerEventToProgress(ev: PointerEvent): number | null {
    return this.offsetXToProgress(ev.offsetX)
  }
  protected pointerEventToTime(ev: PointerEvent): number | null {
    if (this.svgElement == null) {
      return null
    }
    const duration = this.noteSequence?.totalTime
    const progress = this.pointerEventToProgress(ev)
    if (duration == null || progress == null) {
      return null
    }
    return duration * progress
  }

  protected seekCallback = (ev: PointerEvent) => {
    const clickProgress = this.pointerEventToProgress(ev)
    if (clickProgress == null) {
      return
    }
    this.setPlaybackDisplayProgress(clickProgress)
    this.playbackManager.transport.seconds =
      new Tone.TimeClass(
        this.playbackManager.context,
        this.playbackManager.transport.loopEnd
      ).toSeconds() * clickProgress
  }

  // protected setLoopPoints = (ev: PointerEvent) => {
  //   const clickProgressStart = this.offsetXToProgress(
  //     parseFloat(this.wrapper.getAttribute('loopStartCandidate'))
  //   )
  //   const clickProgress = this.pointerEventToProgress(ev)
  //   if (clickProgress == null) {
  //     return
  //   }
  //   this.setPlaybackDisplayProgress(clickProgress)
  //   this.playbackManager.transport.loopStart =
  //     new Tone.TimeClass(
  //       this.playbackManager.context,
  //       this.playbackManager.transport.loopEnd
  //     ).toSeconds() * clickProgress
  //   this.playbackManager.transport.loopEnd =
  //     new Tone.TimeClass(
  //       this.playbackManager.context,
  //       this.playbackManager.transport.loopEnd
  //     ).toSeconds() * clickProgress
  // }

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
      if (!ev.shiftKey) {
        ev.preventDefault()
        ev.stopPropagation()
        this.timestamp_B = null
        this.resetSelectedRegion()
        try {
          this.setSelectedRegion()
        } catch {}
        this.selectionOverlay.setAttribute('width', '0')
        this.timestamp_A = clickTime
        const x = this.svgElement.scrollLeft + ev.offsetX
        this.timestamp_A_x = x
        this.startingSelectionInteraction = true
      } else {
        this.seekCallback(ev)
      }
    })
    this.wrapper.addEventListener('pointerdown', (ev: PointerEvent) => {
      this.wrapper.setAttribute('loopStartCandidate', ev.clientX.toFixed(4))
      this.seekCallback(ev)
    })
    this.wrapper.addEventListener('pointermove', (ev: PointerEvent) => {
      if (this.wrapper.hasAttribute('loopStartCandidate')) {
        // this.setLoopPoints(ev)
      }
    })
    this.wrapper.addEventListener('pointerleave', (ev: PointerEvent) => {
      this.wrapper.removeAttribute('loopStartCandidate')
    })
    this.wrapper.addEventListener('pointerup', (ev: PointerEvent) => {
      this.wrapper.removeAttribute('loopStartCandidate')
    })
    this.svgElement.addEventListener('pointermove', (ev: PointerEvent) => {
      this._lastPointermoveClientX = ev.clientX
      this.setCursorHoverPosition(ev.offsetX)
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
      this.timestamp_B = clickTime
      const x = this.svgElement.scrollLeft + ev.offsetX
      this.timestamp_B_x = x
      this.selectionOverlay.setAttribute(
        'x',
        Math.min(this.timestamp_A_x, this.timestamp_B_x).toString()
      )
      this.selectionOverlay.setAttribute(
        'width',
        Math.abs(this.timestamp_B_x - this.timestamp_A_x).toString()
      )
    })
    this.svgElement.addEventListener('pointerup', () => {
      if (this.inSelectionInteraction) {
        this.regenerationCallback()
      }
      this.resetSelectedRegion()
    })
    this.svgElement.addEventListener('pointerleave', () => {
      this._lastPointermoveClientX = null
      this.resetSelectedRegion()
    })
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
    this.timestamp_A_x = null
    this.timestamp_B_x = null
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
      const selectionClass = candidateSelection
        ? 'candidate-selection'
        : 'selected'

      const noteElements = Array.from(
        this.svgElement.getElementsByClassName('note')
      )
      noteElements.forEach((element) => {
        const classesToRemove = (
          !candidateSelection ? ['candidate-selection'] : []
        ).concat([selectionClass])
        element.classList.remove(...classesToRemove)
      })
      noteElements.forEach((element) => {
        let [x, width]: [number | null, number | null] = [null, null]
        try {
          ;[x, width] = ClickableVisualizerElement.locateElement(element)
        } catch {
          return
        }
        const [timestamp_left_x, timestamp_right_x] =
          timestamps ?? this.timestamps_x
        const isInSelection = x > timestamp_left_x && x <= timestamp_right_x
        element.classList.toggle(selectionClass, isInSelection)
      })
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
    const cssProperties: CSSProperty[] = [
      [
        '--midi-velocity',
        String(note.velocity !== undefined ? note.velocity : 127),
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
