export abstract class AnnotationBox {
  readonly containedQuarterNotes: number[]

  constructor(timestampContainer: HTMLElement, cssClass: string) {
    this.validateTimestampContainer(timestampContainer)
    this.timestampContainer = timestampContainer

    this.containedQuarterNotes = (() => {
      const containedQuarters_str = this.timestampContainer.getAttribute(
        'containedquarternotes'
      )
      const containedQuarters_strlist = containedQuarters_str.split(' ')
      const containedQuarterNotes = containedQuarters_strlist.map(parseInt)
      return containedQuarterNotes
    })()

    this.cssClass = cssClass
    this.container = this.createContainer()
  }

  protected timestampContainer: HTMLElement

  // TODO(theis): create TimestampContainer class for encapsulation
  protected validateTimestampContainer(
    timestampContainer: HTMLElement
  ): void | never {
    if (!timestampContainer.hasAttribute('containedquarternotes')) {
      throw new Error(
        'Timestamp container should provide `containedquarternotes` attribute'
      )
    }
  }

  public container: HTMLElement | null = null
  readonly cssClass: string

  // create containing div,
  private createContainer(): HTMLElement {
    const containerId = this.timestampContainer.id + '-' + this.cssClass
    const containerByID = document.getElementById(containerId)
    const containerExistsInitially = containerByID !== null
    const container = containerByID || document.createElement('div')
    container.id = containerId
    container.classList.add(this.cssClass)

    // let containedQuarters_str: string = this.timestampContainer.getAttribute('containedquarternotes')
    // this.container.setAttribute('containedquarternotes', containedQuarters_str);

    if (!containerExistsInitially) {
      this.timestampContainer.appendChild(container)
    }
    return container
  }

  public abstract draw(): void
}
