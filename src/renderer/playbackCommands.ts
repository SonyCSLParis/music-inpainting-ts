import '@fortawesome/fontawesome-free/css/all.css'

import { PlaybackManager } from './playback'
import { Locator } from './locator'
import * as ControlLabels from './controlLabels'

let playbackManager: PlaybackManager<Locator>

export function setPlaybackManager(
  newPlaybackManager: PlaybackManager<Locator>
): void {
  playbackManager = newPlaybackManager
}

export function render(container: HTMLElement): void {
  async function playbackCallback(play: boolean) {
    if (play) {
      await playbackManager.play()
    } else {
      await playbackManager.stop()
    }
  }

  const stoppedClasses: string[] = ['stopped', 'fa-play-circle']
  const playingClasses: string[] = ['playing', 'fa-stop-circle']
  const waitingClass = 'fa-circle-notch'

  const mainIconSize = 'fa-4x'

  const playbuttonContainer = document.createElement('div')
  playbuttonContainer.id = 'play-button-container'
  playbuttonContainer.classList.add('control-item')
  container.appendChild(playbuttonContainer)

  ControlLabels.createLabel(
    playbuttonContainer,
    'play-button-label',
    false,
    undefined,
    container
  )

  const playButtonInterface = document.createElement('i')
  playButtonInterface.id = 'play-button-interface'
  playbuttonContainer.appendChild(playButtonInterface)
  playButtonInterface.classList.add('fas', mainIconSize)
  playButtonInterface.style.alignSelf = 'inherit'
  playButtonInterface.style.cursor = 'pointer'

  function setPlayingClass(isPlaying: boolean) {
    // Update Play/Stop CSS classes
    unsetWaitingClass()
    if (isPlaying) {
      playButtonInterface.classList.add(...playingClasses)
      playButtonInterface.classList.remove(...stoppedClasses)

      // updates interface colors
      playbuttonContainer.classList.add('active')
    } else {
      playButtonInterface.classList.add(...stoppedClasses)
      playButtonInterface.classList.remove(...playingClasses)

      // updates interface colors
      playbuttonContainer.classList.remove('active')
    }
  }
  function setWaitingClass() {
    // Replace the playback icon with a rotating 'wait' icon until
    // playback state correctly updated
    playButtonInterface.classList.remove(...playingClasses, ...stoppedClasses)

    playButtonInterface.classList.add('fa-spin', waitingClass) // spinning icon
  }
  function unsetWaitingClass() {
    // Remove rotating 'wait' icon
    playButtonInterface.classList.remove('fa-spin', waitingClass) // spinning icon
  }
  // Initialize playback to stopped
  setPlayingClass(false)

  async function playCallback(play: boolean) {
    setWaitingClass()
    await playbackCallback(play)
    unsetWaitingClass()
    setPlayingClass(play)
  }

  async function pressPlay() {
    await playCallback(true)
  }

  async function pressStop() {
    await playCallback(false)
  }

  async function togglePlayback() {
    await playCallback(
      playButtonInterface.classList.contains(stoppedClasses[0])
    )
  }

  playButtonInterface.addEventListener('click', () => {
    togglePlayback()
  })

  document.addEventListener('keydown', (event) => {
    const keyName = event.key
    switch (keyName) {
      case 'Spacebar':
      case ' ':
        // disable scrolling on Spacebar press
        event.preventDefault()
        togglePlayback()
        break
      case 'p':
        event.preventDefault()
        pressPlay()
        break
      case 's':
        event.preventDefault()
        pressStop()
        break
    }
  })
}
