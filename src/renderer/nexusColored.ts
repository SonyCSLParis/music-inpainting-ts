// Simple module to store and share the color parameters for Nexus UI

import Nexus from 'nexusui'
import defaultColors from '../common/styles/mixins/_colors.module.scss'

export function setColors(accent: string, fill: string): void {
  Nexus.colors.accent = accent
  Nexus.colors.fill = fill
}
setColors(defaultColors.active_control, defaultColors.idle_control)

export class NexusSelectWithShuffle extends Nexus.Select {
  // update the controller's current value with a randomly chosen one
  shuffle(): void {
    this.value = this._options[Math.floor(Math.random() * this._options.length)]
  }
}
export default Nexus
