// Create select element with a list of icons

import EventEmitter from 'events'
import * as path from 'path'

import '../common/styles/cycleSelect.scss'

const enum CycleSelectEvents {
  ValueChanged = 'value-changed',
  ActiveOptionsChanged = 'active-options-changed',
}

export class CycleSelect<T> extends EventEmitter {
  static interfaceCssClass = 'cycleSelect'
  static disabledCssClass = 'cycleSelect-disabled'
  static currentValueCssClass = 'cycleSelect-currentValue'
  readonly events = {
    ValueChanged: CycleSelectEvents.ValueChanged,
    ActiveOptionsChanged: CycleSelectEvents.ActiveOptionsChanged,
  }

  readonly containerElement: HTMLElement
  readonly interfaceElement: HTMLDivElement
  readonly onchangeCallback: (e: Event) => void
  readonly basePath: string
  readonly icons: Map<T, string>
  readonly iconElements: Map<T, HTMLElement>
  readonly options: T[]
  protected _activeOptions: Set<T> = new Set()

  protected _value: T

  get activeOptions(): readonly T[] {
    return Array.from(this._activeOptions)
  }

  set activeOptions(newActiveOptions: readonly T[]) {
    if (newActiveOptions.length == 0) {
      throw new Error('Must enable at least one option')
    }
    if (!newActiveOptions.every((option) => this.options.includes(option))) {
      throw new Error('Active options must be a subset of available options')
    }
    const newActiveOptionsSet = new Set(newActiveOptions)
    if (this._activeOptions == newActiveOptionsSet) {
      return
    }

    this._activeOptions = newActiveOptionsSet

    if (!this.activeOptions.includes(this.value)) {
      this.selectNextOption()
    }

    this.emit(CycleSelectEvents.ActiveOptionsChanged)
  }

  on(event: CycleSelectEvents, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }
  emit(event: CycleSelectEvents): boolean {
    return super.emit(event)
  }

  constructor(
    containerElement: HTMLElement,
    onchangeCallback: (e: Event) => void,
    icons: Map<T, string>,
    basePath = '',
    activeOptions?: T[]
  ) {
    super()
    if (!(icons.size > 0)) {
      // TODO define specific error object
      throw Error('Must provide a non-empty list of options')
    }
    if (containerElement.id === '') {
      // TODO define specific error object
      throw Error('Must set an id for the provided container element')
    }
    this.containerElement = containerElement

    this.interfaceElement = document.createElement('div')
    this.interfaceElement.classList.add(CycleSelect.interfaceCssClass)
    this.containerElement.appendChild(this.interfaceElement)

    this.onchangeCallback = onchangeCallback.bind(this)

    this.icons = icons
    this.basePath = basePath
    this.options = Array.from(this.icons.keys())
    this.activeOptions = activeOptions != null ? activeOptions : this.options

    this.iconElements = this.createIconElements()

    this.containerElement.addEventListener('click', () =>
      this.selectNextOption()
    )

    this.updateVisuals()

    this.on(this.events.ActiveOptionsChanged, () => this.callToAction())
    this.on(this.events.ValueChanged, (e) => {
      this.updateVisuals()
      this.onchangeCallback(e)
    })

    this.value = this.activeOptions[0]
  }

  public get value(): T {
    return this._value
  }

  public set value(newValue: T) {
    // set the value of the <select> element and update the visuals
    if (!this.options.includes(newValue)) {
      throw EvalError('Unexpected value')
    }
    if (!this.activeOptions.includes(newValue)) {
      throw EvalError('Trying to set inactive option')
    }
    if (newValue == this.value) {
      return
    }
    this._value = newValue
    this.emit(this.events.ValueChanged)
  }

  protected updateVisuals(): void {
    // display icon for the current option and hide all others
    Array.from(
      this.containerElement.getElementsByTagName('img')
    ).forEach((img) => img.classList.remove(CycleSelect.currentValueCssClass))

    this.getCurrentElement().classList.add(CycleSelect.currentValueCssClass)
  }

  protected getCurrentElement(): HTMLElement {
    // return the currently selected element
    return this.iconElements.get(this.value)
  }

  protected createIconElements(): Map<T, HTMLElement> {
    // append all images as <img> to the container
    const iconElements = new Map<T, HTMLElement>()
    this.icons.forEach((iconPath, option) => {
      const imageElement = document.createElement('img')
      imageElement.src = path.join(this.basePath, iconPath)
      this.interfaceElement.appendChild(imageElement)
      iconElements.set(option, imageElement)
    })
    return iconElements
  }

  protected selectNextOption(): void {
    this.cycleOptions(true, true)
  }

  cycleOptions(increasing = true, looping = true): void {
    // select the previous/next option in the list, cycle to the beginning if needed
    const currentOptionIndex: number = this.activeOptions.indexOf(this.value)
    // fails gracefully if the current value is not within the activeOptions,
    // since the resulting newIndex would then be 0
    let newIndex: number
    if (looping) {
      newIndex =
        (currentOptionIndex + (increasing ? 1 : -1)) % this.activeOptions.length
    } else {
      if (increasing) {
        newIndex = Math.min(
          currentOptionIndex + 1,
          this.activeOptions.length - 1
        )
      } else {
        newIndex = Math.max(currentOptionIndex - 1, 0)
      }
    }
    this.value = this.activeOptions[newIndex]
  }

  disable(disable: boolean): boolean {
    return this.interfaceElement.classList.toggle(
      CycleSelect.disabledCssClass,
      disable
    )
  }

  callToAction(): this {
    this.interfaceElement.classList.remove('pulsing')
    this.interfaceElement.classList.add('pulsing')
    return this
  }
}
