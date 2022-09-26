import Nexus from './nexusColored'
import { NexusNumber, NexusSelect, NexusSlider } from 'nexusui'
import * as ControlLabels from './controlLabels'
import { EventEmitter } from 'events'

// Monkey-patch Nexus.Number to remove the undocumented dependency of the rate of change
// of the value via click-and-drag on the x position of the initial mouse click
class UniformChangeRateNumber extends Nexus.Number {
  changeFactor = 1

  constructor(container: string | HTMLElement, options: {}) {
    super(container, options)
  }

  public click(): void {
    super.click()
    // restore this.changeFactor to a default, effect-less value
    this.changeFactor = 1
  }
}

export class NumberControl extends EventEmitter {
  protected readonly parent: HTMLElement
  readonly interactionId: string
  readonly labelId: string
  readonly id: string
  readonly range: [number, number]
  protected _controller?: NexusSlider | NexusNumber
  private readonly initialValue: number

  protected onchange: (newValue: number) => void

  constructor(
    parent: HTMLElement,
    id: string,
    range: [number, number],
    initialValue: number,
    onchange: (newValue: number) => void = () => {
      return
    }
  ) {
    super()
    this._checkRange(range, initialValue)

    this.parent = parent
    this.id = id
    this.labelId = this.id + '-label'
    this.interactionId = this.id + '-interaction'
    this.range = range
    this.initialValue = initialValue

    this.onchange = onchange.bind(this)
  }

  protected _checkRange(range: [number, number], initialValue: number): void {
    if (range[1] < initialValue || range[0] > initialValue) {
      throw Error(`Selected initial value should be in the accepted range`)
    }
  }

  get container(): HTMLElement {
    return document.getElementById(this.id)
  }

  render(
    elementWidth: number,
    useSimpleSlider = false,
    elementHeight: number = 40
  ): this {
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
      const interactionElement = document.createElement('div')
      interactionElement.id = this.interactionId
      containerElement.appendChild(interactionElement)
      this._controller = new UniformChangeRateNumber('#' + this.interactionId, {
        min: this.range[0],
        max: this.range[1],
        step: 1,
        value: this.initialValue,
      })
      this._controller.element.style.width =
        Math.round(elementWidth).toString() + 'px'
      this._controller.element.style.padding = '0'
    } else {
      const sliderContainer = document.createElement('div')
      sliderContainer.id = this.id
      containerElement.appendChild(sliderContainer)

      this._controller = new Nexus.Slider(sliderContainer, {
        size: [elementWidth, elementHeight],
        mode: 'absolute',
        min: this.range[0],
        max: this.range[1],
        step: (this.range[1] - this.range[0]) / 10,
        value: this.initialValue,
      })
      this._controller.bar.classList.add('nexus-slider-bar')
      this._controller.fillbar.classList.add('nexus-slider-fillbar')
      this._controller.knob.classList.add('nexus-slider-knob')
    }

    this._controller.on('change', this.onchange)
    this._controller.on('change', (value) => {
      this._controller?.element.classList.toggle(
        'modified-value',
        value != this.initialValue
      )
    })
    return this
  }

  get value(): number {
    return this._controller.value
  }

  set value(newValue: number) {
    this._controller.value = newValue
  }

  get controller(): NexusSlider | NexusNumber | undefined {
    return this._controller
  }

  silentUpdate(value: number): void {
    if (this._controller != null) {
      this._controller._value.update(value)
      this._controller.render()
      this.emit('interface-tempo-changed-silent', value)
    }
  }
}

export class BPMControl extends NumberControl {
  protected static defaultRange: [number, number] = [20, 999]
  protected static defaultInitialValue = 100

  constructor(
    containerElement: HTMLElement,
    id: string,
    range: [number, number] = BPMControl.defaultRange,
    initialValue: number = BPMControl.defaultInitialValue,
    onchange: (newValue: number) => void = (newBPM: number): void => {
      this.emit('interface-tempo-changed', newBPM)
    }
  ) {
    super(containerElement, id, range, initialValue, onchange)

    this.on('link-tempo-changed', (newTempo: number) => {
      this.silentUpdate(newTempo)
    })
  }

  protected _checkRange(range: [number, number]): void {
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
    this._controller.value = newBPM
  }

  // see https://stackoverflow.com/a/28951055:
  // must also subclass getter if subclassing setter,
  // otherwise return value is `undefined`
  get value(): number {
    return super.value
  }
}

export class PlaybackRateControl extends BPMControl {
  protected static defaultRange: [number, number] = [0.8, 1.2]
  protected static defaultInitialValue = 1

  protected readonly defaultTempo: number

  constructor(
    containerElement: HTMLElement,
    id: string,
    range: [number, number] = PlaybackRateControl.defaultRange,
    initialValue: number = PlaybackRateControl.defaultInitialValue,
    onchange: (newValue: number) => void = (playbackRate: number): void => {
      this.emit('interface-tempo-changed', this.makeTempo(playbackRate))
    },
    defaultTempo: number = 120
  ) {
    super(containerElement, id, range, initialValue, onchange)
    this.defaultTempo = defaultTempo
  }

  protected _checkRange(range: [number, number]): void {
    if (!(0 < range[0] && range[0] < range[1] && range[1] < 2)) {
      throw Error(`Invalid playback rates range`)
    }
  }

  // ensure the new BPM is in the accepted range
  // this works because the accepted range is at least strictly one octave wide
  set value(playbackRateFactor: number) {
    playbackRateFactor = Math.max(
      Math.min(playbackRateFactor, this.range[1]),
      this.range[0]
    )
    this._controller.value = playbackRateFactor
  }

  // see https://stackoverflow.com/a/28951055:
  // must also subclass getter if subclassing setter,
  // otherwise return value is `undefined`
  get value(): number {
    return this.makeTempo(super.value)
  }

  protected makeTempo(playbackRate: number): number {
    return this.defaultTempo * playbackRate ** 2
  }

  render(
    elementWidth: number,
    useSimpleSlider: boolean | undefined,
    elementHeight: number = 40
  ): this {
    super.render(elementWidth, useSimpleSlider, elementHeight)
    this._controller?.interactionTarget.classList.add('playback-rate-control')
    this._controller?.interactionTarget.addEventListener('dblclick', () => {
      this.value = PlaybackRateControl.defaultInitialValue
    })

    const centerLine = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line'
    )
    this._controller?.interactionTarget.insertBefore(
      centerLine,
      this._controller?.interactionTarget.firstChild
    )
    centerLine.setAttribute('x1', '50%')
    centerLine.setAttribute('x2', '50%')
    centerLine.setAttribute('y1', '0%')
    centerLine.setAttribute('y2', '100%')
    centerLine.setAttribute('stroke-width', '1.5')
    centerLine.setAttribute('stroke', 'currentColor')

    return this
  }
}

export function renderPitchRootAndOctaveControl(
  container: HTMLElement,
  lockPitchClassToC = false
): { pitchClassSelect: NexusSelect; octaveControl: NexusSelect } {
  const pitchSelectContainerElement = document.createElement('div')
  pitchSelectContainerElement.id = 'pitch-control-container'
  pitchSelectContainerElement.classList.add('gridspan')
  container.appendChild(pitchSelectContainerElement)

  ControlLabels.createLabel(
    pitchSelectContainerElement,
    'pitch-control-label',
    false,
    undefined,
    container
  )

  const pitchSelectContainer = document.createElement('div')
  pitchSelectContainer.id = 'pitch-control-pitch-class-select'
  pitchSelectContainer.classList.add('control-item')
  pitchSelectContainerElement.appendChild(pitchSelectContainer)
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
  const pitchClassSelect = new Nexus.Select(pitchSelectContainer, {
    size: [20, 30],
    options: lockPitchClassToC ? ['C'] : notes,
  })
  pitchSelectContainer.style.width = ''
  pitchSelectContainer.style.height = ''
  if (lockPitchClassToC) {
    // TODO(theis, 2021/07/27): check this setup
    pitchClassSelect.element.style.display = 'none'
  } else {
    ControlLabels.createLabel(
      pitchSelectContainer,
      'pitch-control-pitch-class-select-label',
      false,
      undefined,
      pitchSelectContainerElement
    )
  }

  const octaveSelectContainer = document.createElement('div')
  octaveSelectContainer.id = 'pitch-control-octave-select'
  octaveSelectContainer.classList.add('control-item')
  pitchSelectContainerElement.appendChild(octaveSelectContainer)
  const octaveControl = new Nexus.Select(octaveSelectContainer, {
    size: [20, 30],
    options: ['2', '3', '4', '5', '6', '7'],
  })
  octaveControl.value = '4'
  ControlLabels.createLabel(
    octaveSelectContainer,
    'pitch-control-octave-select-label',
    false,
    undefined,
    pitchSelectContainerElement
  )

  return { pitchClassSelect, octaveControl }
}
