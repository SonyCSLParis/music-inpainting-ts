import { PlaybackManager } from './playback'
import * as ControlLabels from './controlLabels'

export function render(
  container: HTMLElement,
  playbackManager: PlaybackManager
): void {
  function playbackCallback(play: boolean): void {
    if (play) {
      void playbackManager.play()
    } else {
      void playbackManager.stop()
    }
  }

  const stoppedClasses: string[] = ['playback-command--stopped']
  const playingClasses: string[] = ['playback-command--playing']
  const waitingClass = 'playback-command--waiting'
  const spinningClass = 'fa-spin'

  const mainIconSize = 'fa-2xl'

  const playButtonContainer = document.createElement('div')
  playButtonContainer.id = 'play-button-container'
  playButtonContainer.classList.add('control-item')
  container.appendChild(playButtonContainer)

  ControlLabels.createLabel(
    playButtonContainer,
    'play-button-label',
    false,
    undefined,
    container
  )

  const playButtonInterface = document.createElement('i')
  playButtonInterface.id = 'play-button-interface'
  playButtonContainer.appendChild(playButtonInterface)
  playButtonInterface.classList.add('fa-solid', mainIconSize)
  playButtonInterface.style.alignSelf = 'inherit'
  playButtonInterface.style.cursor = 'pointer'

  function setPlayingClass(isPlaying: boolean) {
    // Update Play/Stop CSS classes
    if (isPlaying) {
      playButtonInterface.classList.add(...playingClasses)
      playButtonInterface.classList.remove(...stoppedClasses)

      // updates interface colors
      playButtonContainer.classList.add('active')
    } else {
      playButtonInterface.classList.add(...stoppedClasses)
      playButtonInterface.classList.remove(...playingClasses)

      // updates interface colors
      playButtonContainer.classList.remove('active')
    }
    unsetWaitingClass()
  }
  function setWaitingClass() {
    // Replace the playback icon with a rotating 'wait' icon until
    // playback state correctly updated
    playButtonInterface.classList.add(waitingClass)
    playButtonInterface.classList.remove(...playingClasses, ...stoppedClasses)
    playButtonInterface.classList.add(spinningClass)
  }
  function unsetWaitingClass() {
    // Remove rotating 'wait' icon
    playButtonInterface.classList.remove(waitingClass)
    playButtonInterface.classList.remove(spinningClass)
  }
  // Initialize playback display
  setPlayingClass(playbackManager.transport.state == 'started')

  function playCallback(play: boolean) {
    if (play) {
      setWaitingClass()
    }
    void playbackCallback(play)
  }

  function togglePlayback() {
    playCallback(playbackManager.transport.state != 'started')
  }

  playButtonInterface.addEventListener('click', () => {
    togglePlayback()
  })

  playbackManager.transport.on('start', () => {
    setPlayingClass(true)
  })
  playbackManager.transport.on('stop', () => {
    setPlayingClass(false)
  })
  playbackManager.on('enabled', () => {
    unsetWaitingClass()
    setPlayingClass(playbackManager.transport.state == 'started')
  })

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
        void togglePlayback()
        break
    }
  })
}
