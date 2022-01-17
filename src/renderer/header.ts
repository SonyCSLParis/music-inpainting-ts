import screenfull from 'screenfull'

import { getPathToStaticFile } from './staticPath'

import '../common/styles/main.scss'
import '../common/styles/header.scss'
import {
  setBackgroundColorElectron,
  toggleMaximizeWindowElectron,
} from './utils/display'
import colors from '../common/styles/mixins/_colors.module.scss'

declare let COMPILE_ELECTRON: boolean

async function setupSystemIntegrationForLinksOpening() {
  if (COMPILE_ELECTRON) {
    const shell = (await import('electron')).shell

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
  containerElement.addEventListener('dblclick', () => {
    void toggleMaximizeWindowElectron()
  })

  if (configuration['display_sony_logo']) {
    const cslLogoLinkElement = document.createElement('a')
    cslLogoLinkElement.id = 'csl-logo'
    cslLogoLinkElement.classList.add('header-item-left')
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
    CslLargeLogoElement.media = '(min-width: 700px) and (min-height: 500px)'
    CslLargeLogoElement.srcset = getPathToStaticFile(
      '/icons/logos/sonycsl-logo.svg'
    )
    cslLogoContainerElement.appendChild(CslLargeLogoElement)
    const CslSmallLogoElement = document.createElement('img')
    CslSmallLogoElement.src = getPathToStaticFile(
      '/icons/logos/sonycsl-logo-no_text.svg'
    )
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

  const nameElement: HTMLElement = document.createElement('div')
  nameElement.id = 'app-title'
  nameElement.innerText = <string>configuration['app_name']

  containerElement.appendChild(nameElement)

  if (configuration['display_ircam_logo']) {
    const ircamLogoLinkElement = document.createElement('a')
    ircamLogoLinkElement.id = 'ircam-logo'
    ircamLogoLinkElement.classList.add('header-item-right')

    containerElement.appendChild(ircamLogoLinkElement)

    const ircamLogoContainerElement = document.createElement('picture')
    ircamLogoContainerElement.classList.add('logo')
    ircamLogoLinkElement.appendChild(ircamLogoContainerElement)
    const ircamLargeLogoElement = document.createElement('source')
    ircamLargeLogoElement.type = 'image/png'
    ircamLargeLogoElement.media = '(min-width: 700px) and (min-height: 500px)'
    ircamLargeLogoElement.srcset = getPathToStaticFile(
      '/icons/logos/logoircam_noir.png'
    )
    ircamLogoContainerElement.appendChild(ircamLargeLogoElement)
    const ircamSmallLogoElement = document.createElement('img')
    ircamSmallLogoElement.src = getPathToStaticFile(
      '/icons/logos/logoircam_noir-no_text.png'
    )
    ircamSmallLogoElement.alt = 'ircam Team Logo'
    ircamLogoContainerElement.appendChild(ircamSmallLogoElement)

    ircamLogoContainerElement.style.cursor = 'pointer'
    ircamLogoContainerElement.addEventListener('click', () => {
      const displayTheme = document.body.getAttribute('theme')
      if (displayTheme == 'lavender-light') {
        document.body.setAttribute('theme', 'lavender-dark')
        void setBackgroundColorElectron(
          colors.lavender_dark_mode_panes_background_color
        )
      }
      if (displayTheme == 'lavender-dark') {
        document.body.setAttribute('theme', 'lavender-light')
        void setBackgroundColorElectron(
          colors.lavender_light_mode_panes_background_color
        )
      }
    })
  }
}
