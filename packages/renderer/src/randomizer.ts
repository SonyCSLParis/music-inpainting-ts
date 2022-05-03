import * as Tone from 'tone'

import { Inpainter } from './inpainter/inpainter'

class LowFrequencyRandomizer<DataT> extends Tone.Loop {
  protected container: HTMLElement
  readonly inpainter: Inpainter<DataT>

  // numCells: number = 1;
  constructor(
    inpainter: Inpainter<DataT>,
    callback: (time: number, numCells?: number) => void,
    interval: Tone.Unit.Time = '4n'
  ) {
    super((time) => {
      return
    }, interval)
    this.inpainter = inpainter
  }

  callback: (time: number) => void = (time: number) => {
    this.inpainter
  }

  protected render(container: HTMLElement, registerAsAdvancedControl = false) {
    this.container = container
  }
}
