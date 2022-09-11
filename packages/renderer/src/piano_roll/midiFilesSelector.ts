import { BaseInterfaceOptions } from 'nexusui/dist/types/core/interface'
import { NexusSelectWithShuffle } from '../nexusColored'

export class MidiFileSelector extends NexusSelectWithShuffle {
  static blankTemplate = '-- Blank --'

  protected static readonly basePath = './midi/'
  static readonly midiFiles: Map<string, string | null> = new Map([
    [
      'Mozart – Symphony Nº 41 (Movement 3)',
      MidiFileSelector.basePath + 'mozart-symphony41-3-piano.mid',
    ],
    ['Jingle Bells', MidiFileSelector.basePath + 'jingle-bells-keyboard.mid'],
    [MidiFileSelector.blankTemplate, null],
  ])

  static _options = Array.from(MidiFileSelector.midiFiles.keys())

  constructor(parent: HTMLElement | string) {
    super(parent, { options: MidiFileSelector._options })
  }
}
