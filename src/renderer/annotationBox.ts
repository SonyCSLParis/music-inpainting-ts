import '../common/styles/overlays.scss'

export abstract class AnnotationBox {
  readonly containedQuarterNotes: number[]

  constructor(timestampContainer: string | HTMLElement, cssClass: string) {
    // Store container element
    if (typeof timestampContainer === 'string') {
      // ID passed
      this.timestampContainer = document.getElementById(timestampContainer)
    } else if (timestampContainer && 'appendChild' in timestampContainer) {
      // Element passed
      this.timestampContainer = timestampContainer
    }
    if (
      !this.timestampContainer ||
      this.timestampContainer.getAttribute('containedquarternotes') ===
        undefined
    ) {
      throw new Error(
        'Please pass a valid timestamp container for the annotation box'
      )
    }
    this.validateTimestampContainer()

    this.containedQuarterNotes = (() => {
      const containedQuarters_str = this.timestampContainer.getAttribute(
        'containedquarternotes'
      )
      const containedQuarters_strlist: string[] = containedQuarters_str.split(
        ' '
      )
      const containedQuarterNotes = containedQuarters_strlist.map(parseInt)
      return containedQuarterNotes
    })()

    this.cssClass = cssClass
    this.createContainer()
  }

  protected timestampContainer: HTMLElement
  protected abstract validateTimestampContainer(): void

  public container: HTMLDivElement
  readonly cssClass: string

  // create containing div,
  private createContainer(): void {
    const containerId = this.timestampContainer.id + '-' + this.cssClass
    const containerByID = <HTMLDivElement>document.getElementById(containerId)
    const containerExistsInitially = containerByID !== null
    this.container = containerByID || document.createElement('div')
    this.container.id = containerId
    this.container.classList.add(this.cssClass)

    // let containedQuarters_str: string = this.timestampContainer.getAttribute('containedquarternotes')
    // this.container.setAttribute('containedquarternotes', containedQuarters_str);

    if (!containerExistsInitially) {
      this.timestampContainer.appendChild(this.container)
    }
  }

  public abstract draw(): void
}
