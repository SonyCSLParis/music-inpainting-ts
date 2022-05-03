import screenfull from 'screenfull'
import $ from 'jquery'

import { getPathToStaticFile } from './staticPath'

import '../styles/main.scss'
import '../styles/header.scss'
import {
  setBackgroundColorElectron,
  toggleMaximizeWindowElectron,
} from './utils/display'
import colors from '../styles/mixins/_colors.module.scss'
import { setColors } from './nexusColored'

import SonyCslLogoURL from '../static/icons/logos/sonycsl-logo.svg'
import SonyCslLogoNoTextUrl from '../static/icons/logos/sonycsl-logo-no_text.svg'
import IRCAMLogoURL from '../static/icons/logos/logoircam_noir.png'
import IRCAMLogoNoTextURL from '../static/icons/logos/logoircam_noir-no_text.png'

const COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

// cf. https://stackoverflow.com/a/53815609/
function restrictCallbackToInitialEventListenerTarget<T extends Event>(
  callback: (event: T) => void
): (event: T) => void {
  return (event: T) => {
    if (event.currentTarget != event.target) {
      return
    } else {
      callback(event)
    }
  }
}

async function setupSystemIntegrationForLinksOpening() {
  if (COMPILE_ELECTRON) {
    const shell = window.electronShell
    //open links externally by default
    $(document).on(
      'click',
      'a[href^="http"]',
      function (this: HTMLAnchorElement, event) {
        event.preventDefault()
        void shell.openExternal(this.href)
      }
    )
  }
}
void setupSystemIntegrationForLinksOpening()

export function render(
  containerElement: HTMLElement,
  configuration: Record<string, unknown>
): void {
  containerElement.addEventListener(
    'dblclick',
    restrictCallbackToInitialEventListenerTarget(toggleMaximizeWindowElectron)
  )
  containerElement.classList.add('application-header')

  if (configuration['display_sony_logo']) {
    const cslLogoLinkElement = document.createElement('a')
    cslLogoLinkElement.id = 'csl-logo'
    cslLogoLinkElement.classList.add('header-logo', 'header-logo-left')
    // cslLogoLinkElement.href = "https://www.sonycsl.co.jp/";
    //
    // // open in new tab
    // cslLogoLinkElement.target = '_blank';
    // // securely open tab, cf. https://stackoverflow.com/a/15551842
    // cslLogoLinkElement.rel = "noopener noreferrer";

    containerElement.appendChild(cslLogoLinkElement)

    const cslLogoContainerElement = document.createElement('picture')
    cslLogoContainerElement.classList.add('logo')
    cslLogoLinkElement.appendChild(cslLogoContainerElement)
    const CslLargeLogoElement = document.createElement('source')
    CslLargeLogoElement.type = 'image/svg+xml'
    CslLargeLogoElement.media = '(min-width: 1000px) and (min-height: 500px)'
    CslLargeLogoElement.srcset = SonyCslLogoURL
    cslLogoContainerElement.appendChild(CslLargeLogoElement)
    const CslSmallLogoElement = document.createElement('img')
    CslSmallLogoElement.src = SonyCslLogoNoTextUrl
    CslSmallLogoElement.alt = 'Sony CSL Logo'
    cslLogoContainerElement.appendChild(CslSmallLogoElement)

    // TODO(theis): remove this hack, add a proper fullscreen icon
    cslLogoContainerElement.style.cursor = 'pointer'
    cslLogoContainerElement.addEventListener('click', () => {
      if (screenfull.isEnabled) {
        void screenfull.toggle()
      }
    })
  }

  const appTitleContainerElement = document.createElement('div')
  appTitleContainerElement.addEventListener(
    'dblclick',
    restrictCallbackToInitialEventListenerTarget(toggleMaximizeWindowElectron)
  )
  appTitleContainerElement.id = 'app-title-container'
  containerElement.appendChild(appTitleContainerElement)

  const undoButtonContainer = document.createElement('div')
  undoButtonContainer.id = 'undo-button-container'
  undoButtonContainer.classList.add('control-item')
  const undoButtonInterface = document.createElement('i')
  undoButtonInterface.id = 'undo-button'
  undoButtonContainer.appendChild(undoButtonInterface)
  const nameElement = document.createElement('div')
  nameElement.id = 'app-title'
  nameElement.innerText = <string>configuration['app_name']
  const redoButtonContainer = document.createElement('div')
  redoButtonContainer.classList.add('control-item')
  redoButtonContainer.id = 'redo-button-container'
  const redoButtonInterface = document.createElement('i')
  redoButtonInterface.id = 'redo-button'
  redoButtonContainer.appendChild(redoButtonInterface)

  appTitleContainerElement.appendChild(undoButtonContainer)
  appTitleContainerElement.appendChild(nameElement)
  appTitleContainerElement.appendChild(redoButtonContainer)

  if (configuration['display_ircam_logo']) {
    const ircamLogoLinkElement = document.createElement('a')
    ircamLogoLinkElement.id = 'ircam-logo'
    ircamLogoLinkElement.classList.add('header-logo', 'header-logo-right')

    containerElement.appendChild(ircamLogoLinkElement)

    const ircamLogoContainerElement = document.createElement('picture')
    ircamLogoContainerElement.classList.add('logo')
    ircamLogoLinkElement.appendChild(ircamLogoContainerElement)
    const ircamLargeLogoElement = document.createElement('source')
    ircamLargeLogoElement.type = 'image/png'
    ircamLargeLogoElement.media = '(min-width: 1000px) and (min-height: 500px)'
    ircamLargeLogoElement.srcset = IRCAMLogoURL
    ircamLogoContainerElement.appendChild(ircamLargeLogoElement)
    const ircamSmallLogoElement = document.createElement('img')
    ircamSmallLogoElement.src = IRCAMLogoNoTextURL
    ircamSmallLogoElement.alt = 'ircam Team Logo'
    ircamLogoContainerElement.appendChild(ircamSmallLogoElement)

    ircamLogoContainerElement.style.cursor = 'pointer'
    ircamLogoContainerElement.addEventListener('click', () => cycleThemes())
  }
}

const themes = ['lavender-light', 'lavender-dark', 'dark']

function cycleThemes(ev?: MouseEvent): void {
  const currentTheme = document.body.getAttribute('theme')
  const newTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length]
  document.body.setAttribute('theme', newTheme)
  if (newTheme == 'lavender-light') {
    void setBackgroundColorElectron(
      colors.lavender_dark_mode_panes_background_color
    )
  } else if (newTheme == 'lavender-dark') {
    void setBackgroundColorElectron(
      colors.lavender_light_mode_panes_background_color
    )
  } else if (newTheme == 'dark') {
    void setBackgroundColorElectron('black')
    setColors('white', 'black')
  }
}
