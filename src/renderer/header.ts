import screenfull from 'screenfull'

import { getPathToStaticFile } from './staticPath'

import '../common/styles/main.scss'
import '../common/styles/header.scss'

declare let COMPILE_ELECTRON: boolean

if (COMPILE_ELECTRON) {
  // inner declaration required to have this block properly
  // erased on non-Electron compilation
  // eslint-disable-next-line no-inner-declarations
  async function setupSystemIntegrationForLinksOpening() {
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
  void setupSystemIntegrationForLinksOpening()
}

export function render(
  containerElement: HTMLElement,
  configuration: Record<string, unknown>
): void {
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

  if (configuration['display_acids_logo']) {
    const acidsLogoLinkElement = document.createElement('a')
    acidsLogoLinkElement.id = 'acids-logo'
    acidsLogoLinkElement.classList.add('header-item-right')

    containerElement.appendChild(acidsLogoLinkElement)

    const acidsLogoContainerElement = document.createElement('picture')
    acidsLogoContainerElement.classList.add('logo')
    acidsLogoLinkElement.appendChild(acidsLogoContainerElement)
    const acidsLargeLogoElement = document.createElement('source')
    acidsLargeLogoElement.type = 'image/png'
    acidsLargeLogoElement.media = '(min-width: 700px) and (min-height: 500px)'
    acidsLargeLogoElement.srcset = getPathToStaticFile(
      '/icons/logos/logoircam_noir.png'
    )
    acidsLogoContainerElement.appendChild(acidsLargeLogoElement)
    const acidsSmallLogoElement = document.createElement('img')
    acidsSmallLogoElement.src = getPathToStaticFile(
      '/icons/logos/logoircam_noir-no_text.png'
    )
    acidsSmallLogoElement.alt = 'ACIDS Team Logo'
    acidsLogoContainerElement.appendChild(acidsSmallLogoElement)

    acidsLogoContainerElement.style.cursor = 'pointer'
    acidsLogoContainerElement.addEventListener('click', () => {
      document.body.classList.toggle('light')
    })
  }
}
