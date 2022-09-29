import screenfull from 'screenfull'
import $ from 'jquery'

import '../styles/main.scss'
import '../styles/header.scss'
import {
  setBackgroundColorElectron,
  toggleMaximizeWindowElectron,
} from './utils/display'
import colors from '../styles/mixins/_colors.module.scss'
import { setColors } from './nexusColored'

import localization from '../static/localization.json'

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
  configuration: Record<string, unknown>,
  insertSignatureInAppTitle: boolean = false
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
    cslLogoLinkElement.title = 'Sony CSL Music Team'
    cslLogoLinkElement.href = 'https://cslmusicteam.sony.fr'
    // open in new tab
    cslLogoLinkElement.target = '_blank'
    // securely open tab, cf. https://stackoverflow.com/a/15551842
    cslLogoLinkElement.rel = 'noopener noreferrer'

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
  }

  const headerCenterElement = document.createElement('div')
  headerCenterElement.addEventListener(
    'dblclick',
    restrictCallbackToInitialEventListenerTarget(toggleMaximizeWindowElectron)
  )
  headerCenterElement.id = 'header-center-element'
  containerElement.appendChild(headerCenterElement)

  const undoButtonContainer = document.createElement('div')
  undoButtonContainer.id = 'undo-button-container'
  undoButtonContainer.classList.add('control-item')
  const undoButtonInterface = document.createElement('i')
  undoButtonInterface.id = 'undo-button'
  undoButtonContainer.appendChild(undoButtonInterface)
  const appTitleGridElement = document.createElement('div')
  appTitleGridElement.id = 'app-title-container'
  const appTitleElement = document.createElement('div')
  appTitleElement.innerText = configuration['app_name'] as string
  appTitleElement.id = 'app-title'
  appTitleGridElement.appendChild(appTitleElement)
  if (insertSignatureInAppTitle) {
    const signatureElement = document.createElement('div')
    signatureElement.innerHTML = localization['header']['signature']['en']
    signatureElement.classList.add('signature')
    appTitleGridElement.appendChild(signatureElement)
  }

  const redoButtonContainer = document.createElement('div')
  redoButtonContainer.classList.add('control-item')
  redoButtonContainer.id = 'redo-button-container'
  const redoButtonInterface = document.createElement('i')
  redoButtonInterface.id = 'redo-button'
  redoButtonContainer.appendChild(redoButtonInterface)

  headerCenterElement.appendChild(undoButtonContainer)
  headerCenterElement.appendChild(appTitleGridElement)
  headerCenterElement.appendChild(redoButtonContainer)

  if (configuration['display_ircam_logo']) {
    const ircamLogoLinkElement = document.createElement('a')
    ircamLogoLinkElement.id = 'ircam-logo'
    ircamLogoLinkElement.classList.add('header-logo', 'header-logo-right')
    ircamLogoLinkElement.title = 'IRCAM'
    ircamLogoLinkElement.href = 'https://www.ircam.fr'
    // open in new tab
    ircamLogoLinkElement.target = '_blank'
    // securely open tab, cf. https://stackoverflow.com/a/15551842
    ircamLogoLinkElement.rel = 'noopener noreferrer'

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

    const allowCyclingThemes = false
    if (allowCyclingThemes) {
      ircamLogoContainerElement.style.cursor = 'pointer'
      ircamLogoContainerElement.addEventListener('click', () => cycleThemes())
    }
  }
}

const themes = ['dark']

function cycleThemes(): void {
  const currentTheme = document.body.getAttribute('theme')
  let currentThemeIndex = -1
  if (currentTheme != null && themes.contains(currentTheme)) {
    currentThemeIndex = themes.indexOf(currentTheme)
  }
  const nextTheme = themes[(currentThemeIndex + 1) % themes.length]
  setTheme(nextTheme)
}

const themeToElectronBackgroundColor = new Map([
  ['lavender-light', colors.lavender_dark_mode_panes_background_color],
  ['lavender-dark', colors.lavender_light_mode_panes_background_color],
  ['dark', 'black'],
])

function setTheme(theme: string) {
  document.body.setAttribute('theme', theme)
  if (themeToElectronBackgroundColor.has(theme)) {
    void setBackgroundColorElectron(
      themeToElectronBackgroundColor.get(theme) as string
    )
  }

  if (theme == 'dark') {
    setColors('white', 'black')
  }
}
