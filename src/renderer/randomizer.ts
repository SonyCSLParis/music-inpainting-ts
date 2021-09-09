import Tone from 'tone'

import { PlaybackManager } from './playback'
import { Locator } from './locator'

class LowFrequencyRandomizer<
  PlaybackManagerT extends PlaybackManager
> extends Tone.Loop {
  protected container: HTMLElement
  readonly locator: Locator<PlaybackManagerT, unknown>

  // numCells: number = 1;
  constructor(
    locator: Locator<PlaybackManagerT, unknown>,
    callback: (time: number, numCells?: number) => void,
    interval: Tone.Unit.Time = '4n'
  ) {
    super((time) => {}, interval)
    this.locator = locator
  }

  callback: (time: number) => void = (time: number) => {
    this.locator
  }

  protected render(container: HTMLElement, registerAsAdvancedControl = false) {
    this.container = container
  }
}
