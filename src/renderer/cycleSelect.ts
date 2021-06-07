// Create select element with a list of icons

import EventEmitter from 'events'
import * as path from 'path'

import '../common/styles/cycleSelect.scss'

export class CycleSelect<T extends string> extends EventEmitter {
  static interfaceCssClass = 'cycleSelect'
  static disabledCssClass = 'cycleSelect-disabled'
  static currentValueCssClass = 'cycleSelect-currentValue'

  readonly containerElement: HTMLElement
  readonly interfaceElement: HTMLDivElement
  readonly onchangeCallback: (e: Event) => void
  readonly basePath: string
  readonly icons: Map<T, string>
  readonly options: T[]
  protected _activeOptions: Set<T> = new Set()

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

    this.emit('changed')
  }

  protected _selectElement: HTMLSelectElement

  constructor(
    containerElement: HTMLElement,
    selectElemID: string,
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

    this._selectElement = document.createElement('select')
    this._selectElement.id = selectElemID
    this.interfaceElement.appendChild(this._selectElement)

    this.onchangeCallback = onchangeCallback.bind(this)

    this.icons = icons
    this.basePath = basePath
    this.options = Array.from(this.icons.keys())
    this.activeOptions = activeOptions != null ? activeOptions : this.options

    this.populateSelect()
    this.populateContainer()

    this._selectElement.addEventListener('change', (e) => {
      this.updateVisuals()
      this.onchangeCallback(e)
    })
    this.containerElement.addEventListener('click', () => {
      this.selectNextOption.bind(this)()
    })

    this.updateVisuals()

    this.on('changed', this.callToAction.bind(this))
  }

  protected makeOptionId(key: string): string {
    // create an id for an <option> element
    return this.containerElement.id + '--' + key
  }

  public get value(): T {
    // return the name of the currently selected option
    return this.options[parseInt(this._selectElement.value)]
  }

  public set value(newValue: T) {
    // set the value of the <select> element and update the visuals
    if (!this.options.includes(newValue)) {
      throw EvalError('Unexpected value ' + newValue)
    }
    if (!this.activeOptions.includes(newValue)) {
      throw EvalError('Trying to set inactive option: ' + newValue)
    }
    this._selectElement.value = this.options.indexOf(newValue).toString()
    this._selectElement.dispatchEvent(new Event('change'))
  }

  protected updateVisuals(): void {
    // display icon for the current option and hide all others
    $(`#${this.containerElement.id} img`).removeClass(
      CycleSelect.currentValueCssClass
    )

    this.getCurrentElement().classList.toggle(
      CycleSelect.currentValueCssClass,
      true
    )
  }

  protected getCurrentElement(): HTMLElement {
    // return the currently selected element
    return document.getElementById(this.makeOptionId(this.value))
  }

  protected populateContainer(): void {
    // append all images as <img> to the container
    const self = this
    this.icons.forEach((iconPath, iconName) => {
      const imageElement = document.createElement('img')
      imageElement.id = this.makeOptionId(iconName)
      imageElement.src = path.join(this.basePath, iconPath)
      self.interfaceElement.appendChild(imageElement)
    })
  }

  protected populateSelect(): void {
    // append all options to the inner <select> element
    this.options.forEach((optionName, optionIndex) => {
      const newOption = document.createElement('option')
      newOption.value = optionIndex.toString()
      newOption.textContent = optionName
      this._selectElement.appendChild(newOption)
    })
  }

  protected selectNextOption(): void {
    // select the next option in the list, cycle to the beginning if needed
    const currentOptionIndex: number = this.activeOptions.indexOf(this.value)
    // fails gracefully if the current value is not within the activeOptions,
    // since the resulting newIndex would then be 0
    const newIndex: number =
      (currentOptionIndex + 1) % this.activeOptions.length
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
