import * as Tone from 'tone'
import Nexus from './nexusColored'

import LinkClient from './ableton_link/linkClient'
import * as ControlLabels from './controlLabels'

// Monkey-patch Nexus.Number to remove the undocumented dependency of the rate of change
// of the value via click-and-drag on the x position of the initial mouse click
class UniformChangeRateNumber extends Nexus.Number {
  changeFactor = 1

  constructor(container: string, options: {}) {
    super(container, options)
  }

  public click(): void {
    super.click()
    // restore this.changeFactor to a default, effect-less value
    this.changeFactor = 1
  }
}

export class NumberControl {
  protected readonly parent: HTMLElement
  readonly interactionId: string
  readonly labelId: string
  readonly id: string
  readonly range: [number, number]
  protected controller
  readonly onchange: (newValue: number) => void
  private readonly initialValue: number

  constructor(
    parent: HTMLElement,
    id: string,
    range: [number, number],
    initialValue: number,
    onchange: (newValue: number) => void = (v) => {}
  ) {
    this._checkRange(range, initialValue)

    this.parent = parent
    this.id = id
    this.labelId = this.id + '-label'
    this.interactionId = this.id + '-interaction'
    this.range = range
    this.onchange = onchange
    this.initialValue = initialValue
  }

  protected _checkRange(range: [number, number], initialValue: number) {
    if (range[1] < initialValue || range[0] > initialValue) {
      throw Error(`Selected initial value should be in the accepted range`)
    }
  }

  get container(): HTMLElement {
    return document.getElementById(this.id)
  }

  render(useSimpleSlider = false, elementWidth: number): void {
    const containerElement = document.createElement('div')
    containerElement.id = this.id
    containerElement.classList.add('control-item')
    containerElement.setAttribute('horizontal', '')
    containerElement.setAttribute('layout', '')
    containerElement.setAttribute('display', 'grid')
    containerElement.setAttribute('grid-template-columns', '200px 200px;')

    this.parent.appendChild(containerElement)

    ControlLabels.createLabel(
      containerElement,
      this.labelId,
      false,
      undefined,
      this.parent
    )

    if (!useSimpleSlider) {
      const interactionElement: HTMLElement = document.createElement('div')
      interactionElement.id = this.interactionId
      containerElement.appendChild(interactionElement)
      this.controller = new UniformChangeRateNumber('#' + this.interactionId, {
        min: this.range[0],
        max: this.range[1],
        step: 1,
        value: this.initialValue,
      })
      this.controller.element.style.width =
        Math.round(elementWidth).toString() + 'px'
    } else {
      const bpmSliderElement: HTMLElement = document.createElement('div')
      bpmSliderElement.id = this.id
      containerElement.appendChild(bpmSliderElement)

      this.controller = new Nexus.Slider('#' + this.id, {
        size: [100, 40],
        mode: 'absolute', // 'relative' or 'absolute'
        min: this.range[0],
        max: this.range[1],
        step: (this.range[1] - this.range[0]) / 10,
        value: this.initialValue,
      })
    }

    this.controller.on('change', this.onchange)
  }

  get value(): number {
    return this.controller.value
  }

  set value(newValue: number) {
    this.controller.value = newValue
  }
}

export class BPMControl extends NumberControl {

  protected onchangeCallback_default(newBPM: number): void {
    Tone.getTransport().bpm.value = newBPM
    LinkClient.updateLinkBPM(newBPM)
  }
  protected static defaultRange: [number, number] = [30, 300]
  protected static defaultInitialValue = 100

  constructor(
    containerElement: HTMLElement,
    id: string,
    range: [number, number] = BPMControl.defaultRange,
    initialValue: number = BPMControl.defaultInitialValue,
    onchange?: (newValue: number) => void
  ) {
    super(containerElement, id, range, initialValue, onchange)
    if (onchange == null) {
      this.onchange = this.onchangeCallback_default.bind(this)
    }
  }

  protected _checkRange(range: [number, number]) {
    if (range[1] < 2 * range[0]) {
      throw Error(`BPM range should be at least one tempo octave wide, ie.
            maxAcceptedBPM at least twice as big as minAcceptedBPM`)
    }
  }

  // ensure the new BPM is in the accepted range
  // this works because the accepted range is at least strictly one octave wide
  set value(newBPM: number) {
    while (newBPM > this.range[1]) {
      newBPM = newBPM / 2
    }
    while (newBPM < this.range[0]) {
      newBPM = 2 * newBPM
    }

    // HACK perform a comparison to avoid messaging loops, since
    // the link update triggers a bpm modification message
    if (Tone.getTransport().bpm.value !== newBPM) {
      Tone.getTransport().bpm.value = newBPM
      this.controller._value.update(newBPM)
      this.controller.render()
    }
  }

  // must also subclass getter if subclassing setter,
  // see https://stackoverflow.com/a/28951055
  // otherwise return value is `undefined`
  get value(): number {
    return super.value
  }
}

export function renderPitchRootAndOctaveControl() {
  const constraintsGridspanElement = document.getElementById(
    'constraints-gridspan'
  )
  const pitchSelectGridspanElement = document.createElement('div')
  pitchSelectGridspanElement.id = 'pitch-control-gridspan'
  pitchSelectGridspanElement.classList.add('gridspan')
  constraintsGridspanElement.appendChild(pitchSelectGridspanElement)

  const pitchSelectContainer = document.createElement('div')
  pitchSelectContainer.id = 'pitch-control-root-select'
  pitchSelectContainer.classList.add('control-item')
  pitchSelectGridspanElement.appendChild(pitchSelectContainer)
  const notes = [
    'C',
    'C♯',
    'D',
    'E♭',
    'E',
    'F',
    'F♯',
    'G',
    'A♭',
    'A',
    'B♭',
    'B',
  ]
  const pitchRootSelect = new Nexus.Select('#pitch-control-root-select', {
    size: [20, 30],
    options: notes,
  })
  pitchSelectContainer.style.width = ''
  pitchSelectContainer.style.height = ''
  ControlLabels.createLabel(
    pitchSelectContainer,
    'pitch-control-root-select-label',
    false,
    undefined,
    pitchSelectGridspanElement
  )

  const octaveControl = new NumberControl(
    pitchSelectGridspanElement,
    'pitch-control-octave-control',
    [2, 7],
    5
  )
  const useSimpleSlider = false
  const elementWidth_px = 40
  octaveControl.render(useSimpleSlider, elementWidth_px)

  return [pitchRootSelect, octaveControl]
}
