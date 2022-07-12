import { AudioKeys } from 'audiokeys'

// expose protected methods
declare module 'audiokeys' {
  interface AudioKeys {
    _addKey: (e: KeyboardEvent) => void
    _removeKey: (e: KeyboardEvent) => void
  }
}
export class NoSpecialKeysAudioKeys extends AudioKeys {
  _addKey = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
      super._addKey(e)
    }
  }
}

// only triggers note on events if the this.focusElement is the document's activeElement
// avoids triggering notes when interacting with the setups
export default class FocusedAudioKeys extends AudioKeys {
  readonly focusElement: Document | HTMLElement = window.document.body

  constructor(
    options: { focusElement?: HTMLElement } & Partial<AudioKeysOptions>
  ) {
    super(options)
    if (options.focusElement != null) {
      this.focusElement = options.focusElement
    }

    // TODO(@tbazin, 2022/06/22): check if this is useful
    // let lastFocus = true
    // setInterval(() => {
    //   if (window.document.hasFocus() === lastFocus) {
    //     return
    //   }
    //   lastFocus = !lastFocus
    //   if (!lastFocus) {
    //     this.clear()
    //   }
    // }, 100)
  }

  get isInFocus(): boolean {
    return window.document.activeElement == this.focusElement
  }

  _addKey: (e: KeyboardEvent) => void = (e: KeyboardEvent) => {
    if (this.isInFocus) {
      super._addKey(e)
    }
  }
}
