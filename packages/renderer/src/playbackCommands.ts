import { PlaybackManager } from './playback'
import * as ControlLabels from './controlLabels'

export class PlaybackCommands {
  static readonly stoppedClasses: string[] = ['playback-command--stopped']
  static readonly playingClasses: string[] = ['playback-command--playing']
  static readonly waitingClass = 'playback-command--waiting'
  static readonly spinningClass = 'fa-spin'
  static readonly brokenClass = 'fa-heart-crack'
  static readonly disabledClass = 'playback-command--disabled'

  readonly parent: HTMLElement
  readonly playbackManager: PlaybackManager
  playButtonInterface?: HTMLElement
  playButtonContainer?: HTMLElement

  constructor(parent: HTMLElement, playbackManager: PlaybackManager) {
    this.parent = parent
    this.playbackManager = playbackManager
  }

  protected async togglePlayback(play?: boolean): Promise<void> {
    if (play == undefined) {
      play = this.playbackManager.transport.state != 'started'
    }
    if (play) {
      await this.playbackManager.play()
    } else {
      await this.playbackManager.stop()
    }
  }

  protected async playCallback(play?: boolean): Promise<void> {
    if (play == undefined) {
      play = this.playbackManager.transport.state != 'started'
    }
    if (play) {
      this.setWaitingClass()
    }
    await this.togglePlayback(play)
    this.unsetWaitingClass()
  }

  protected setPlayingClass(isPlaying: boolean) {
    // Update Play/Stop CSS classes
    if (this.playButtonContainer == null || this.playButtonInterface == null) {
      return
    }
    if (isPlaying) {
      this.playButtonInterface.classList.add(...PlaybackCommands.playingClasses)
      this.playButtonInterface.classList.remove(
        ...PlaybackCommands.stoppedClasses
      )

      // updates interface colors
      this.playButtonContainer.classList.add('active')
    } else {
      this.playButtonInterface.classList.add(...PlaybackCommands.stoppedClasses)
      this.playButtonInterface.classList.remove(
        ...PlaybackCommands.playingClasses
      )

      // updates interface colors
      this.playButtonContainer.classList.remove('active')
    }
  }

  setWaitingClass() {
    if (this.playButtonContainer == null || this.playButtonInterface == null) {
      return
    }
    // Replace the playback icon with a rotating 'wait' icon until
    // playback state correctly updated
    this.clearInterface()
    this.isEnabled = false
    this.playButtonInterface.classList.add(PlaybackCommands.waitingClass)
    this.playButtonInterface.classList.add(PlaybackCommands.spinningClass)
  }

  unsetWaitingClass() {
    if (this.playButtonContainer == null || this.playButtonInterface == null) {
      return
    }
    // Remove rotating 'wait' icon
    this.playButtonInterface.classList.remove(PlaybackCommands.waitingClass)
    this.playButtonInterface.classList.remove(PlaybackCommands.spinningClass)
    this.refreshInterface()
    this.isEnabled = true
  }

  protected clearInterface() {
    if (this.playButtonInterface == null) {
      return
    }
    this.playButtonInterface.classList.remove(
      ...PlaybackCommands.playingClasses,
      ...PlaybackCommands.stoppedClasses
    )
    this.unsetWaitingClass()
  }

  refreshInterface() {
    const isPlaying = this.playbackManager.transport.state == 'started'
    this.setPlayingClass(isPlaying)
  }

  // protected togglePlayback() {
  //   this.playCallback()
  // }

  render(): this {
    const mainIconSize = 'fa-2xl'

    this.playButtonContainer = document.createElement('div')
    this.playButtonContainer.id = 'play-button-container'
    this.playButtonContainer.classList.add('control-item')
    this.parent.appendChild(this.playButtonContainer)

    ControlLabels.createLabel(
      this.playButtonContainer,
      'play-button-label',
      false,
      undefined,
      this.parent
    )

    this.playButtonInterface = document.createElement('i')
    this.playButtonInterface.id = 'play-button-interface'
    this.playButtonContainer.appendChild(this.playButtonInterface)
    this.playButtonInterface.classList.add('fa-solid', mainIconSize)
    this.playButtonInterface.style.alignSelf = 'inherit'
    this.playButtonInterface.style.cursor = 'pointer'

    // Initialize playback display
    this.setPlayingClass(this.playbackManager.transport.state == 'started')
    this.playButtonInterface.addEventListener('click', () => {
      this.playCallback()
    })

    this.playbackManager.transport.on('start', () => {
      this.setPlayingClass(true)
    })
    this.playbackManager.transport.on('stop', () => {
      this.setPlayingClass(false)
    })
    // this.playbackManager.on('enabled', () => {
    //   this.unsetWaitingClass()
    //   this.setPlayingClass(this.playbackManager.transport.state == 'started')
    // })

    document.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return
      }
      const keyName = event.key
      switch (keyName) {
        case 'Spacebar':
        case ' ':
          // disable scrolling on Spacebar press
          event.preventDefault()
          void this.togglePlayback()
          break
      }
    })

    return this
  }

  _isEnabled: boolean = true
  protected get isEnabled(): boolean {
    return this._isEnabled
  }
  protected set isEnabled(enable: boolean) {
    this._isEnabled = enable
    if (this.playButtonInterface != null) {
      this.parent.classList.toggle('disabled-gridspan', !this.isEnabled)
    }
  }

  setBrokenIcon(): void {
    if (this.playButtonInterface == null) {
      return
    }
    this.clearInterface()
    this.playButtonInterface.classList.add(PlaybackCommands.brokenClass)
    this.isEnabled = false
  }
}
