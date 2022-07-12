import { TypedEmitter } from 'tiny-typed-emitter'
import { NexusButton, NexusSelect } from 'nexusui'

import '../styles/cycleSelect.scss'
import { debounce } from 'chart.js/helpers'

interface NullableVariableValueEvents<T> {
  change: (value: T, previousValue?: T) => void
  added: (value: T) => void
  removed: () => void
  disabled: () => void
  enabled: () => void
}

export class VariableValue<T> extends TypedEmitter<
  NullableVariableValueEvents<T>
> {
  protected _value: T | undefined = undefined
  protected _options: T[]

  constructor(
    options: T[] = [],
    initialValue?: T,
    onchange?: (value: T, previousValue?: T) => void
  ) {
    super()
    if (onchange != null) {
      this.on('change', onchange)
    }

    this._options = options
    if (initialValue !== undefined) {
      this.value = initialValue
    }
  }

  protected checkValue(value: T): boolean {
    return this.options.includes(value)
  }

  get value(): T | never {
    if (this._value === undefined) {
      throw new EvalError('Value not initialized')
    }
    return this._value
  }
  set value(value: T) {
    if (!this.checkValue(value)) {
      throw EvalError('Unrecognized option')
    }
    const previousValue = this._value
    if (previousValue != value) {
      this._value = value
      this.emit('change', this.value, previousValue)
    }
  }

  protected cycle(increasing: boolean, looping: boolean): T {
    // select the previous/next option in the list, cycle to the beginning if needed
    const currentOptionIndex: number = this.options.indexOf(this.value)
    // fails gracefully if the current value is not within the activeOptions,
    // since the resulting newIndex would then be 0
    let newIndex: number
    if (looping) {
      newIndex =
        (currentOptionIndex + (increasing ? 1 : -1)) % this.options.length
    } else {
      if (increasing) {
        newIndex = Math.min(currentOptionIndex + 1, this.options.length - 1)
      } else {
        newIndex = Math.max(currentOptionIndex - 1, 0)
      }
    }
    return (this.value = this.options[newIndex])
  }

  next(looping = true): T {
    return this.cycle(true, looping)
  }
  previous(looping = true): T {
    return this.cycle(false, looping)
  }

  get options(): T[] {
    return this._options
  }
  addOption(value: T): void {
    if (!this.options.includes(value)) {
      this._options.push(value)
      this.emit('added', value)
    }
  }
  removeOption(value: T): void {
    if (this.value == value) {
      // cycle to next option
      this.next(true)
    }
    const previousLength = this.options.length
    this._options = this.options.filter((v) => v != value)
    const hasChanged = previousLength != this.options.length
    if (hasChanged) {
      this.emit('removed')
    }
  }

  emitChanged(): void {
    this.emit('change', this.value)
  }
}

// should be able to restore previous value after null-ing
export class NullableVariableValue<T> extends VariableValue<T | null> {
  protected _previousValue: T | null | undefined = undefined
  protected readonly defaultValue: T | null = null

  get previousValue(): T | null | undefined {
    return this._previousValue
  }

  constructor(
    options: T[] = [],
    initialValue?: T | null,
    onchange?: (value: T | null) => void,
    defaultValue: T | null = null
  ) {
    super(options, initialValue, onchange)

    this.on('change', (value: T | null, previousValue?: T | null) => {
      this._previousValue = previousValue
    })

    this.defaultValue = defaultValue
  }

  restorePreviousValue(): void {
    if (this._value === null && this.previousValue !== undefined) {
      this.value = this.previousValue
    }
  }

  get value(): T | null {
    if (super.value === null && this.defaultValue != null) {
      return this.defaultValue
    } else {
      return super.value
    }
  }
  set value(newValue: T | null) {
    super.value = newValue
    if (newValue === null) {
      this.emit('disabled')
    } else {
      this.emit('enabled')
    }
  }

  next(looping = true): T | null {
    if (this._value === null) {
      return null
    } else {
      return this.cycle(true, looping)
    }
  }

  protected checkValue(value: T): boolean {
    return value === null || super.checkValue(value)
  }
}

export function bindButtonModel<V>(
  view: NexusButton,
  model: VariableValue<V>,
  isPressed: (value: V) => boolean
): void {
  view.removeAllListeners()
  view.preClick =
    view.preRelease =
    view.preTouch =
    view.preTouchRelease =
      () => {
        return
      }
  view.element.addEventListener('pointerdown', () => {
    model.next(true)
  })
  model.on('change', (value) => {
    isPressed(value) ? view.turnOn(false) : view.turnOff(false)
    view.render()
  })
}
export function bindSelectModel<V extends string>(
  view: NexusSelect,
  model: VariableValue<V>
): void {
  view.removeAllListeners()
  view.on('change', (valueAndIndex) => {
    model.value = <V>valueAndIndex.value
  })
  model.on('change', (value) => {
    if (view.value != value) {
      view.value = value
      view.render()
    }
  })
}

export function createIconElements<T>(
  basePath: URL | string | undefined,
  iconPaths: Map<T, string>
): Map<T, HTMLElement> {
  function createIconElement(iconPath: string): HTMLElement {
    const imageElement = document.createElement('img')
    imageElement.src = iconPath // new URL(iconPath, basePath).href
    return imageElement
  }
  // append all images as <img> to the container
  const iconElements = new Map<T, HTMLElement>()
  iconPaths.forEach((iconPath, option) => {
    const imageElement = createIconElement(iconPath)
    iconElements.set(option, imageElement)
  })
  return iconElements
}

export class CycleSelectView<
  T,
  VariableValueT extends VariableValue<T> = VariableValue<T>
> extends HTMLElement {
  readonly valueModel: VariableValueT

  readonly interactiveElement = document.createElement('div')
  static interfaceCssClass = 'cycleSelect'
  static currentValueCssClass = 'cycleSelect-currentValue'

  readonly imageElements: Map<T, HTMLElement>

  get value(): T {
    return this.valueModel.value
  }

  constructor(valueModel: VariableValueT, imageElements: Map<T, HTMLElement>) {
    super()
    this.interactiveElement.classList.add('cycleSelect--interactive-element')
    this.appendChild(this.interactiveElement)

    this.valueModel = valueModel

    this.classList.add(CycleSelectView.interfaceCssClass)

    this.imageElements = imageElements
    this.imageElements.forEach((element) => this.appendChild(element))

    this.interactiveElement.addEventListener('click', () =>
      this.selectNextOption()
    )
    this.valueModel.on(
      'added',
      debounce(() => this.callToAction(), 20)
    )
    this.valueModel.on('change', () => {
      this.updateVisibleIcon()
    })
  }

  refresh() {
    this.updateVisibleIcon()
  }

  protected updateVisibleIcon(): void {
    // display icon for the current option and hide all others
    this.imageElements.forEach((img) =>
      img.classList.remove(CycleSelectView.currentValueCssClass)
    )

    const currentElement = this.currentElement
    if (currentElement != null) {
      currentElement.classList.add(CycleSelectView.currentValueCssClass)
    }
  }

  protected get currentElement(): HTMLElement | null {
    // return the currently selected element
    try {
      return this.imageElements.get(this.value)
    } catch {
      return null
    }
  }

  protected selectNextOption(): void {
    this.valueModel.next(true)
  }

  callToAction(): this {
    this.classList.remove('pulsing')
    this.classList.add('pulsing')
    return this
  }
}
customElements.define('cycle-select', CycleSelectView)

export class CycleSelectViewWithDisable<T> extends CycleSelectView<
  T | null,
  NullableVariableValue<T>
> {
  static disabledCssClass = 'cycleSelect-disabled'

  constructor(
    valueModel: NullableVariableValue<T>,
    imageElements: Map<T, HTMLElement>
  ) {
    super(valueModel, imageElements)

    this.valueModel.on('change', (value: T | null) => {
      this.toggleDisable(value == null)
    })
    this.valueModel.on('disabled', () => {
      this.toggleDisable(true)
    })
    this.valueModel.on('enabled', () => {
      this.toggleDisable(false)
    })
  }

  protected updateVisibleIcon(): void {
    super.updateVisibleIcon()
  }

  protected get currentElement(): HTMLElement | null {
    // return the currently selected element
    if (this.value != null) {
      return super.currentElement
    } else {
      return this.imageElements.get(this.valueModel.previousValue)
    }
  }

  protected toggleDisable(force: boolean): boolean {
    return this.classList.toggle(
      CycleSelectViewWithDisable.disabledCssClass,
      force
    )
  }
}
customElements.define('cycle-select-with-disable', CycleSelectViewWithDisable)

export class BooleanValue extends NullableVariableValue<boolean> {
  constructor(
    initialValue?: boolean,
    onchange?: (state: boolean | null) => void
  ) {
    super([true, false], initialValue, onchange)
  }
}

export function createFontAwesomeElements<T>(
  iconNames: Map<T, string | null>,
  faClasses: string[] = []
): Map<T, HTMLElement> {
  function createFontAwesomeElement(iconName: string | null) {
    let element: HTMLElement
    if (iconName != null) {
      element = document.createElement('i')
      element.classList.add(iconName, ...faClasses)
    } else {
      element = document.createElement('div')
    }
    return element
  }
  const elements = new Map<T, HTMLElement>()
  iconNames.forEach((iconName, value) => {
    const element = createFontAwesomeElement(iconName)
    elements.set(value, element)
  })
  return elements
}

const defaultFontAwesomeEnableDisableIcons = new Map<boolean, string | null>([
  [true, 'fa-check'],
  [false, null],
])
export class CycleSelectEnableDisableFontAwesomeView extends CycleSelectView<
  boolean | null,
  BooleanValue
> {
  constructor(
    valueModel: BooleanValue,
    imageElements?: Map<boolean, HTMLElement>
  ) {
    if (imageElements == null) {
      imageElements = createFontAwesomeElements(
        defaultFontAwesomeEnableDisableIcons,
        ['fa-solid', 'fa-xl']
      )
    }
    super(valueModel, imageElements)
  }
}
customElements.define(
  'cycle-select-enable-disable-font-awesome',
  CycleSelectEnableDisableFontAwesomeView
)
