import * as ControlLabels from '../controlLabels'
import Nexus from '../nexusColored'

import { NoteSequence, INoteSequence } from '@magenta/music/es6/protobuf'
export interface PiaNoteData {
  type: 'note' // must always add this field
  pitch: number
  time: number
  duration: number
  velocity: number
  muted: number
}

type Case = 'start' | 'continue'

export interface PiaData extends PiaHyperParameters {
  case: Case

  clip_start: number // start time of the whole input sequence, usually 0
  clip_end: number // end/duration of the whole input sequence
  // cue-points for the specific zone to transform
  selected_region: CuePoints

  notes: ('notes' | 'note' | number)[] // all flattened!
}

interface CuePoints {
  start: number
  end: number
}

interface PiaHyperParameters {
  // these values are not relevant outside of Ableton Live,
  // you can safely keep the defaults of `0`
  id: number
  clip_id: number
  detail_clip_id: number

  note_density: number // usually keep this at 1
  top_p: number
  superconditioning: number // usually keep this at 1
  tempo: number // usually 120
}

export class PiaAPIManager {
  // parse notes as returned by the PIA API to NoteSequence format
  convertPiaNoteToNoteSequenceNote(noteObject: PiaNoteData): NoteSequence.Note {
    return new NoteSequence.Note({
      pitch: noteObject.pitch,
      velocity: noteObject.velocity,
      startTime: noteObject.time,
      endTime: noteObject.time + noteObject.duration,
    })
  }

  // parse note in NoteSequence format to the format returned by the PIA API
  convertNoteSequenceNoteToPiaNoteObject(
    note: NoteSequence.INote,
    defaultVelocity: number = 70
  ): PiaNoteData | null {
    if (
      note.startTime == null ||
      note.endTime == null ||
      note.velocity == null ||
      note.pitch == null
    ) {
      return null
    }
    return {
      type: 'note',
      pitch: note.pitch,
      velocity: note.velocity ?? defaultVelocity,
      time: note.startTime,
      duration: note.endTime - note.startTime,
      muted: 0,
    }
  }

  // flatten a single PIA note for the PIA input note format
  protected piaNoteObjectToFlattenedPiaNote(
    piaNoteObject: PiaNoteData
  ): (number | 'note')[] {
    return [
      'note',
      piaNoteObject.pitch,
      piaNoteObject.time,
      piaNoteObject.duration,
      piaNoteObject.velocity,
      piaNoteObject.muted,
    ]
  }

  // flatten a sequence of PIA notes to the PIA input format
  protected convertPiaNoteObjectsToPiaInput(
    piaNoteObjects: PiaNoteData[]
  ): (number | 'note' | 'notes')[] {
    const piaNotes = piaNoteObjects.map(this.piaNoteObjectToFlattenedPiaNote)
    return ['notes', piaNotes.length, ...piaNotes.flat()]
  }

  // convert notes in NoteSequence format to the PIA input format
  convertNoteSequenceNotesToPiaInputNotes(noteSequence_notes) {
    const piaNoteObjects = noteSequence_notes.map((noteSequence_note) =>
      this.convertNoteSequenceNoteToPiaNoteObject(noteSequence_note)
    )
    return this.convertPiaNoteObjectsToPiaInput(piaNoteObjects)
  }

  static readonly default_superconditioning = 1
  static readonly superconditioning_range = [0.4, 1.6]
  static readonly default_top_p = 0.95
  static readonly top_p_range = [0.8, 1]
  static readonly piaDefaultSettings: PiaHyperParameters = {
    id: 0,
    clip_id: 0,
    detail_clip_id: 0,
    note_density: 1,
    tempo: 60,
    top_p: this.default_top_p,
    superconditioning: this.default_superconditioning,
  }

  noteSequenceToPiaJSON(
    noteSequence: INoteSequence,
    regionStart: number,
    regionEnd: number,
    clipEnd?: number
  ): PiaData {
    const DEFAULT_DURATION = 60
    clipEnd = clipEnd ?? noteSequence.totalTime ?? DEFAULT_DURATION

    // format loaded noteSequence to PIA input format
    const notes_piaInput = this.convertNoteSequenceNotesToPiaInputNotes(
      noteSequence.notes
    )

    let timeOfLastNote = 0
    for (const note of noteSequence.notes ?? []) {
      timeOfLastNote = Math.max(timeOfLastNote, note.startTime ?? 0)
    }

    // setup PIA API request data
    const piaInputData: PiaData = {
      ...PiaAPIManager.piaDefaultSettings,
      case: 'start',
      clip_start: 0,
      clip_end: Math.max(timeOfLastNote, regionEnd),
      selected_region: {
        start: regionStart,
        end: regionEnd,
      },
      notes: notes_piaInput,
      superconditioning: this.superconditioning,
      top_p: this.top_p,
    }
    return piaInputData
  }

  get top_p(): number {
    if (this.top_pControl != null) {
      return this.top_pControl.value
    } else {
      return PiaAPIManager.default_top_p
    }
  }
  set top_p(top_p: number) {
    if (this.top_pControl != null) {
      this.top_pControl._value.update(top_p)
    } else {
      throw new Error('Cannot set top_p, top_p control not initialized')
    }
  }
  get superconditioning(): number {
    if (this.superconditioningControl != null) {
      return this.superconditioningControl.value
    } else {
      return PiaAPIManager.default_superconditioning
    }
  }
  set superconditioning(superconditioning: number) {
    if (this.superconditioningControl != null) {
      this.superconditioningControl._value.update(superconditioning)
    } else {
      throw new Error(
        'Cannot set superconditioning, superconditioning control not initialized'
      )
    }
  }

  protected parent?: HTMLElement
  protected controlsContainer?: HTMLElement
  protected top_pControl?: Nexus.NexusDial
  protected superconditioningControl?: Nexus.NexusDial

  static readonly CSSClassPrefix = 'pia-hyperparameters-controls'

  renderHyperparameterControls(parent: HTMLElement, dialSize: number): void {
    this.parent = parent
    this.parent.id = PiaAPIManager.CSSClassPrefix + '-gridspan'
    this.controlsContainer = document.createElement('div')
    this.controlsContainer.classList.add(
      PiaAPIManager.CSSClassPrefix + '-container',
      'gridspan'
    )
    this.parent.appendChild(this.controlsContainer)
    ControlLabels.createLabel(
      this.controlsContainer,
      '',
      true,
      'pia-hyperparameters-controls-gridspan-label',
      this.parent
    )

    const top_pControlContainer = document.createElement('div')
    top_pControlContainer.classList.add(
      PiaAPIManager.CSSClassPrefix + '-top_p-control-container',
      'control-item'
    )
    this.top_pControl = new (PointerLockDial as typeof Nexus.Dial)(
      top_pControlContainer,
      {
        size: [dialSize, dialSize],
        interaction: 'vertical',
        min: PiaAPIManager.top_p_range[0],
        max: PiaAPIManager.top_p_range[1],
        value: PiaAPIManager.default_top_p,
      }
    )
    this.top_pControl.value = PiaAPIManager.default_top_p
    this.controlsContainer.appendChild(top_pControlContainer)
    ControlLabels.createLabel(
      top_pControlContainer,
      '',
      false,
      PiaAPIManager.CSSClassPrefix + '-top_p-control-label',
      this.controlsContainer
    )

    const superconditioningControlContainer = document.createElement('div')
    superconditioningControlContainer.classList.add(
      PiaAPIManager.CSSClassPrefix + '-superconditioning-control-container',
      'control-item'
    )
    this.superconditioningControl = new (PointerLockDial as typeof Nexus.Dial)(
      superconditioningControlContainer,
      {
        size: [dialSize, dialSize],
        interaction: 'vertical',
        min: PiaAPIManager.superconditioning_range[0],
        max: PiaAPIManager.superconditioning_range[1],
        value: PiaAPIManager.default_superconditioning,
      }
    )
    this.superconditioningControl.value =
      PiaAPIManager.default_superconditioning
    this.controlsContainer.appendChild(superconditioningControlContainer)
    ControlLabels.createLabel(
      superconditioningControlContainer,
      '',
      false,
      PiaAPIManager.CSSClassPrefix + '-superconditioning-control-label',
      this.controlsContainer
    )

    this.registerResetOnDoubleClick()
    this.registerDisplayModifiedValue()
    // this.registerHideCursorDuringInteraction()
  }

  registerResetOnDoubleClick() {
    for (const dial of [this.superconditioningControl, this.top_pControl]) {
      if (dial != null) {
        const resetValue = () => {
          const maybeInitialValue = dial.settings.value
          if (maybeInitialValue != undefined) {
            dial.value = maybeInitialValue
          }
        }

        // dial.element.addEventListener('dblclick', resetValue)

        let lastTapTime: number | null = null
        const doubleTapDelay = 200 // 200ms
        dial.element.addEventListener('pointerdown', () => {
          const date = new Date()
          const now = date.getTime()
          if (lastTapTime != null && now - lastTapTime < doubleTapDelay) {
            resetValue()
          }
          lastTapTime = now
        })
      }
    }
  }
  registerDisplayModifiedValue() {
    for (const dial of [this.superconditioningControl, this.top_pControl]) {
      if (dial != null) {
        ;[
          // dial.handle,
          // dial.handle2,
          dial.handleFill,
          dial.handle2Fill,
          // dial.handleLine,
        ].forEach((element) => element.classList.add('nexus-dial-handle-fill'))
        dial.handleLine.classList.add('nexus-dial-handle-line')
        dial.on('change', (value: number) => {
          const settings = dial.settings as unknown as DialOptions
          const maybeInitialValue = settings.value
          const maybeMin = settings.min
          const maybeMax = settings.max
          if (
            maybeMin != undefined &&
            maybeMax != undefined &&
            maybeInitialValue != undefined
          ) {
            const range = Math.abs(maybeMax - maybeMin)
            // TODO(@tbazin, 2022/09/22): hardcoded threshold
            const isSignificantlyModified =
              (Math.abs(value - maybeInitialValue) / range) * 100 > 1
            dial.element.classList.toggle(
              'modified-value',
              isSignificantlyModified
            )
          }
        })
      }
    }
  }
}

import { Handle } from 'nexusui/lib/util/interaction'
import math from 'nexusui/lib/util/math'
import dom from 'nexusui/lib/util/dom'
import { NexusButton, NexusDial } from 'nexusui'
import { Mouse } from 'canvg'
import { DialOptions } from 'nexusui/dist/types/interfaces/dial'

class PointerLockHandle extends Handle {
  update(mouse: Mouse) {
    if (mouse.movementX == undefined && mouse.movementY == undefined) {
      if (this.mode === 'relative') {
        let rawIncrement = this.convertPositionToValue(mouse) - this.anchor
        let interpretedIncrement =
          Math.abs(rawIncrement) > 0.5 && this.direction === 'radial'
            ? 0
            : rawIncrement * this.sensitivity
        this.anchor = mouse
        this.value = this.value + interpretedIncrement
      } else {
        this.value = this.convertPositionToValue(mouse)
      }
    }
    // this.value = math.clip(this.value, 0, 1)

    // super.convertPositionToValue(current)
    // if (previous != this.value) {
    //   return
    // }
    // no movement detected based on current.x and current.y, try with current.movementX and current.movementY
    else {
      if (this.mode === 'relative') {
        let rawIncrement = this.convertMovementToIncrement(mouse)
        let interpretedIncrement =
          // Math.abs(rawIncrement) > 0.5 && this.direction === 'radial'
          // ? 0
          // :
          math.clip(rawIncrement * this.sensitivity, -0.999, 0.999)
        this.anchor = mouse
        this.value = this.value + interpretedIncrement
      }
    }

    this.value = math.clip(this.value, 0, 1)
  }

  convertMovementToIncrement(current: MouseEvent) {
    switch (this.direction) {
      case 'radial':
        let position = math.toPolar(current.movementX, current.movementY)
        position = position.angle / (Math.PI * 2)
        position = (position - 0.25 + 1) % 1
        return position
      case 'vertical':
        const scaledMovementY = -current.movementY / 500
        return scaledMovementY
      case 'horizontal':
        return math.scale(
          current.movementX,
          this.boundary.min.x,
          this.boundary.max.x,
          0,
          1
        )
    }
  }
}

class PointerLockDial extends Nexus.Dial {
  constructor() {
    super(...arguments)

    this.position = new PointerLockHandle(
      this.settings.mode,
      this.interaction,
      [0, this.width],
      [this.height, 0]
    )
    this.resetMouseMovement()
  }

  // registerHideCursorDuringInteraction() {
  //   for (const dial of [this.superconditioningControl, this.top_pControl]) {
  //     if (dial != null) {
  //       const element = dial.element
  //       element.addEventListener('pointerdown', (e: PointerEvent) => {
  //         document.body.classList.add('hidden-cursor')
  //         // element.setPointerCapture(e.pointerId)
  //         document.body.requestPointerLock()
  //       })
  //       document.body.addEventListener('pointerleave', (e: PointerEvent) => {
  //         document.body.classList.remove('hidden-cursor')
  //         element.releasePointerCapture(e.pointerId)
  //       })
  //       document.body.addEventListener('pointerup', (e: PointerEvent) => {
  //         console.log(e.pointerId)
  //         document.exitPointerLock()
  //         document.body.classList.remove('hidden-cursor')
  //         element.releasePointerCapture(e.pointerId)
  //       })
  //     }
  //   }
  // }

  protected resetMouseMovement() {
    this.mouse.movementX = 0
    this.mouse.movementY = 0
  }
  protected eraseMouseMovement() {
    this.mouse.movementX = undefined
    this.mouse.movementY = undefined
  }

  preMove(e: MouseEvent) {
    // accumulate mouse movement
    this.mouse.movementX = (this.mouse.movementX ?? 0) + e.movementX
    this.mouse.movementY = (this.mouse.movementY ?? 0) + e.movementY
    if (!this.wait) {
      this.mouse = {
        ...this.mouse,
        ...dom.locateMouse(e, this.offset),
      }
      this.move()
      this.resetMouseMovement()
      this.wait = true
      setTimeout(() => {
        this.wait = false
      }, 25)
    }
    e.preventDefault()
    e.stopPropagation()
  }

  // preTouchMove(e) {
  //   if (this.clicked) {
  //     this.mouse = dom.locateTouch(e, this.offset)
  //     this.touchMove()
  //     e.preventDefault()
  //     e.stopPropagation()
  //   }
  // }
  preClick(e: MouseEvent): void {
    this.element.requestPointerLock()
    super.preClick(e)
    this.resetMouseMovement()
  }
  preRelease(e: MouseEvent): void {
    super.preRelease(e)
    this.eraseMouseMovement()
    document.exitPointerLock()
  }
  preTouch(e: MouseEvent): void {
    this.eraseMouseMovement()
    super.preTouch(e)
  }
  touch() {
    super.touch()
  }

  move() {
    if (this.clicked) {
      this.position.update(this.mouse)

      let angle = this.position.value * Math.PI * 2

      if (angle < 0) {
        angle += Math.PI * 2
      }

      if (
        this.mode === 'relative' &&
        this.mouse.movementX == undefined &&
        this.mouse.movementY == undefined
      ) {
        if (
          this.previousAngle !== false &&
          Math.abs(this.previousAngle - angle) > 2
        ) {
          if (this.previousAngle > 3) {
            angle = Math.PI * 2
          } else {
            angle = 0
          }
        }
      } /* else {
        if (this.previousAngle !== false && Math.abs(this.previousAngle - angle) > 2) {
          if (this.previousAngle > 3) {
            angle = Math.PI*2;
          } else {
            angle = 0;
          }
        }
      } */
      this.previousAngle = angle

      let realValue = angle / (Math.PI * 2)

      this.value = this._value.updateNormal(realValue)

      if (this.mode === 'relative') {
        this.position.value = realValue
      }

      this.emit('change', this._value.value)

      this.render()
    }
  }
}
