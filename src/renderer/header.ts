import * as Path from 'path'
import * as screenfull from 'screenfull'

import '../common/styles/main.scss'
import '../common/styles/header.scss'

import { static_correct } from './staticPath'

import * as HelpTour from './helpTour'

declare let COMPILE_ELECTRON: boolean
declare let ENABLE_ANONYMOUS_MODE: boolean

if (COMPILE_ELECTRON) {
  const shell = require('electron').shell

  //open links externally by default
  $(document).on(
    'click',
    'a[href^="http"]',
    function (this: HTMLAnchorElement, event) {
      event.preventDefault()
      shell.openExternal(this.href)
    }
  )
}

export function render(containerElement: HTMLElement, configuration) {
  if (configuration['sony_logo']) {
    const cslLogoLinkElem = document.createElement('a')
    cslLogoLinkElem.id = 'csl-logo'
    cslLogoLinkElem.classList.add('header-item-left')
    // cslLogoLinkElem.href = "https://www.sonycsl.co.jp/";
    //
    // // open in new tab
    // cslLogoLinkElem.target = '_blank';
    // // securely open tab, cf. https://stackoverflow.com/a/15551842
    // cslLogoLinkElem.rel = "noopener noreferrer";

    containerElement.appendChild(cslLogoLinkElem)

    const cslLogoContainerElem = document.createElement('picture')
    cslLogoContainerElem.classList.add('logo')
    cslLogoLinkElem.appendChild(cslLogoContainerElem)
    const CslLargeLogoElem = document.createElement('source')
    CslLargeLogoElem.type = 'image/svg+xml'
    CslLargeLogoElem.media = '(min-width: 700px) and (min-height: 500px)'
    CslLargeLogoElem.srcset = Path.join(
      static_correct,
      '/icons/logos/sonycsl-logo.svg'
    )
    cslLogoContainerElem.appendChild(CslLargeLogoElem)
    const CslSmallLogoElem = document.createElement('img')
    CslSmallLogoElem.src = Path.join(
      static_correct,
      '/icons/logos/sonycsl-logo-no_text.svg'
    )
    CslSmallLogoElem.alt = 'Sony CSL Logo'
    cslLogoContainerElem.appendChild(CslSmallLogoElem)

    cslLogoLinkElem.addEventListener('click', () => {
      if (screenfull.isEnabled) {
        screenfull.request()
      }
    })
  }

  const nameElem: HTMLElement = document.createElement('div')
  nameElem.id = 'app-title'
  nameElem.innerText = configuration['app_name']

  containerElement.appendChild(nameElem)

  if (configuration['acids_logo']) {
    const acidsLogoLinkElem = document.createElement('a')
    acidsLogoLinkElem.id = 'acids-logo'
    acidsLogoLinkElem.classList.add('header-item-right')

    containerElement.appendChild(acidsLogoLinkElem)

    const acidsLogoContainerElem = document.createElement('picture')
    acidsLogoContainerElem.classList.add('logo')
    acidsLogoLinkElem.appendChild(acidsLogoContainerElem)
    const acidsLargeLogoElem = document.createElement('source')
    acidsLargeLogoElem.type = 'image/png'
    acidsLargeLogoElem.media = '(min-width: 700px) and (min-height: 500px)'
    acidsLargeLogoElem.srcset = Path.join(
      static_correct,
      '/icons/logos/acids-flat-logo.png'
    )
    acidsLogoContainerElem.appendChild(acidsLargeLogoElem)
    const acidsSmallLogoElem = document.createElement('img')
    acidsSmallLogoElem.src = Path.join(
      static_correct,
      '/icons/logos/acids-flat-logo-no_text.png'
    )
    acidsSmallLogoElem.alt = 'ACIDS Team Logo'
    acidsLogoContainerElem.appendChild(acidsSmallLogoElem)
  }
}

if (module.hot) {
}
