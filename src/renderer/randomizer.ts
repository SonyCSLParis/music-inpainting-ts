import Tone from 'tone'

import { PlaybackManager } from './playback'
import { Inpainter } from './inpainter'

class LowFrequencyRandomizer<
  PlaybackManagerT extends PlaybackManager
> extends Tone.Loop {
  protected container: HTMLElement
  readonly inpainter: Inpainter<PlaybackManagerT, unknown>

  // numCells: number = 1;
  constructor(
    inpainter: Inpainter<PlaybackManagerT, unknown>,
    callback: (time: number, numCells?: number) => void,
    interval: Tone.Unit.Time = '4n'
  ) {
    super((time) => {}, interval)
    this.inpainter = inpainter
  }

  callback: (time: number) => void = (time: number) => {
    this.inpainter
  }

  protected render(container: HTMLElement, registerAsAdvancedControl = false) {
    this.container = container
  }
}
