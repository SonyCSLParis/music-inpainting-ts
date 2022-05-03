import { AnnotationBox } from './annotationBox'

export class FermataBox extends AnnotationBox {
  constructor(
    timestampContainer: HTMLElement,
    sequenceDuration: number,
    allowOnlyOneActive = false
  ) {
    super(timestampContainer, 'Fermata')
    this.sequenceDuration = sequenceDuration

    // allow to enable only one Fermata maximum at a time
    // (excluding imposed Fermatas)
    this._allowOnlyOneActive = allowOnlyOneActive

    if (this.allowOnlyOneActive) {
      this.onclickCallback = () => {
        if (this.container.classList.contains('active')) {
          this.container.classList.toggle('active', false)
        } else {
          $('.Fermata').not('.imposed').toggleClass('active', false)
          this.container.classList.toggle('active')
        }
      }
    } else {
      this.onclickCallback = () => {
        this.container.classList.toggle('active')
      }
    }

    this.draw()
  }

  protected validateTimestampContainer(timestampContainer: HTMLElement): void {
    if (!timestampContainer.classList.contains('1_quarterNote_duration')) {
      throw new EvalError('Fermata should be associated to a quarter-note box')
    }
  }

  private sequenceDuration: number
  private containedQuarterNote: number = this.containedQuarterNotes[0]

  private _allowOnlyOneActive: boolean

  private onclickCallback: Function

  public get allowOnlyOneActive(): boolean {
    return this._allowOnlyOneActive
  }

  public draw(): void {
    if (this.containedQuarterNote >= this.sequenceDuration - 2) {
      // TODO(theis) move this out of the class
      // Add imposed fermata at the end of the sequence
      // Do not add onclick callback
      this.container.classList.add('imposed')
      this.container.classList.add('active')
    } else {
      // const self = this
      this.container.addEventListener('pointerdown', () => {
        this.onclickCallback()
      })
    }
  }
}
