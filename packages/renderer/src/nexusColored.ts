// Simple module to store and share the color parameters for Nexus UI

import Nexus from 'nexusui'
import defaultColors from '../styles/mixins/_colors.module.scss'

export function setColors(accent: string, fill: string, light = 'white'): void {
  Nexus.colors.accent = accent // used for active control text
  Nexus.colors.fill = fill
  Nexus.colors.dark = accent // used for idle control text
  Nexus.colors.mediumLight = accent
  Nexus.colors.light = light
}
setColors(defaultColors.arabian_sand, 'black')

export class NexusSelectWithShuffle extends Nexus.Select {
  // update the controller's current value with a randomly chosen one
  shuffle(): void {
    this.value = this._options[Math.floor(Math.random() * this._options.length)]
  }
}
export default Nexus
