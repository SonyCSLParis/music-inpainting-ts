import AudioKeys from 'audiokeys'

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
  }

  get isInFocus(): boolean {
    return window.document.activeElement == this.focusElement
  }

  protected _bind(): void {
    if (typeof window !== 'undefined' && window.document) {
      window.document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (
          this.isInFocus &&
          !(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)
        ) {
          this._addKey(e)
        }
      })
      window.document.addEventListener('keyup', (e: KeyboardEvent) => {
        this._removeKey(e)
      })

      let lastFocus = true
      setInterval(() => {
        if (window.document.hasFocus() === lastFocus) {
          return
        }
        lastFocus = !lastFocus
        if (!lastFocus) {
          this.clear()
        }
      }, 100)
    }
  }
}
