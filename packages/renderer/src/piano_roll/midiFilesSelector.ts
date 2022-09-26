import { BaseInterfaceOptions } from 'nexusui/dist/types/core/interface'
import { NexusSelectWithShuffle } from '../nexusColored'

export const enum TemplateCommands {
  OpenFile = 'OpenFile',
  BlankTemplate = 'BlankTemplate',
}

export class MidiFileSelector extends NexusSelectWithShuffle {
  static blankTemplate = '📄 Blank'
  static triggerOpenFileDisplay = '🗃 Open...'
  static customFileDisplay = '🍱 Custom'

  protected inputFileElement: HTMLInputElement | null = null

  protected static readonly basePath = './midi/'
  static readonly midiFiles: Map<string, string | TemplateCommands> = new Map([
    [MidiFileSelector.blankTemplate, TemplateCommands.BlankTemplate],
    [
      '🎼 Mozart – Symphony Nº 41 (Movement 3)',
      MidiFileSelector.basePath + 'mozart-symphony41-3-piano.mid',
    ],
    [
      '🧑‍🎄 Jingle Bells',
      MidiFileSelector.basePath + 'jingle-bells-keyboard.mid',
    ],
    [MidiFileSelector.triggerOpenFileDisplay, TemplateCommands.OpenFile],
  ])

  static options = Array.from(MidiFileSelector.midiFiles.keys())
  static optionsWithCustomFile = [
    ...MidiFileSelector.midiFiles.keys(),
    MidiFileSelector.customFileDisplay,
  ]

  constructor(parent: HTMLElement | string) {
    super(parent, { options: MidiFileSelector.options })
    this.on('change', (value: { value: string; index: number }) => {
      if (value.index < MidiFileSelector.options.length) {
        this.defineOptions(MidiFileSelector.options)
        this.element.selectedIndex = value.index
      }
    })

    this.inputFileElement = document.createElement('input')
    this.inputFileElement.type = 'file'
    this.inputFileElement.accept = 'audio/midi'
    this.inputFileElement.multiple = false
    this.inputFileElement.style.display = 'none'
    this.inputFileElement.style.visibility = 'hidden'
    this.parent.appendChild(this.inputFileElement)
  }

  async triggerOpenFile(): Promise<File | null> {
    if (this.inputFileElement == null) {
      return null
    }
    const selectedPromise = new Promise<File | null>((resolve) => {
      if (this.inputFileElement == null) {
        return null
      }
      this.inputFileElement.onchange = () => {
        if (this.inputFileElement == null) {
          resolve(null)
          return
        }
        const selectedFiles = this.inputFileElement.files
        if (selectedFiles != null) {
          this.setCustomOptionDisplay()
          resolve(selectedFiles.item(0))
          return
        } else {
          resolve(null)
        }
        return
      }
    })
    this.inputFileElement.click()
    return selectedPromise
  }

  setCustomOptionDisplay(): void {
    this.defineOptions(MidiFileSelector.optionsWithCustomFile)
    this.element.selectedIndex =
      MidiFileSelector.optionsWithCustomFile.findIndex(
        (value) => value == MidiFileSelector.customFileDisplay
      )
  }
  resetOptions(): void {
    this.defineOptions(MidiFileSelector.options)
  }
}
