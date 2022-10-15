// start-up module offering a splash screen in which to select the configuration
// this menu also allows to properly start the AudioContext upon the user
// clicking on the start button
import * as Tone from 'tone'
import SimpleBar from 'simplebar'
import log from 'loglevel'

import Nexus from './nexusColored'
import { NexusTextButton } from 'nexusui'
import * as Header from './header'
import {
  BooleanValue,
  CycleSelectEnableDisableFontAwesomeView,
} from './cycleSelect'

import localization from '../static/localization.json'
import defaultConfiguration from '../../common/default_config.json'
import customConfiguration from '../../../config.json'

import '../styles/startupSplash.scss'
import { unmute } from './utils/unmute'
import { PiaInpainter } from './piano_roll/pianoRollInpainter'

export type applicationConfiguration = typeof defaultConfiguration

// TODO(@tbazin, 2021/11/04): merge all symbolic modes
// and auto-detect sheet layout in app
enum ApplicationMode {
  Pianoto = 'pianoto',
  Nonoto = 'nonoto',
  NonotoLeadsheets = 'nonoto-leadsheet',
  NonotoFolkSongs = 'nonoto-folk-song',
  Notono = 'notono',
}
const allApplicationModes = [
  ApplicationMode.Pianoto,
  ApplicationMode.Nonoto,
  ApplicationMode.NonotoLeadsheets,
  ApplicationMode.NonotoFolkSongs,
  ApplicationMode.Notono,
]

const applicationModeToAPIEndpointRoute: Map<ApplicationMode, string> = new Map(
  [
    [ApplicationMode.Pianoto, 'pia/'],
    [ApplicationMode.Nonoto, 'deepbach/'],
    [ApplicationMode.Notono, 'notono/'],
  ]
)

const VITE_COMPILE_ELECTRON: boolean =
  import.meta.env.VITE_COMPILE_ELECTRON != undefined
const VITE_APP_TITLE: string | undefined = import.meta.env.VITE_APP_TITLE
const VITE_HIDE_IRCAM_LOGO: boolean =
  import.meta.env.VITE_HIDE_IRCAM_LOGO != undefined
const VITE_REMOTE_INPAINTING_API_ADDRESS_BASE: string | undefined = import.meta
  .env.VITE_REMOTE_INPAINTING_API_ADDRESS_BASE
const VITE_NO_CHECK_API_STATUS: boolean =
  import.meta.env.VITE_NO_CHECK_API_STATUS != undefined
const VITE_PIA_INPAINTING_API_ADDRESS: string | undefined = import.meta.env
  .VITE_PIA_INPAINTING_API_ADDRESS
const VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS: string | undefined =
  import.meta.env.VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS ??
  'http://localhost:'
const VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT: boolean =
  import.meta.env.VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT !=
  undefined
const VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX: boolean =
  import.meta.env.VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX != undefined
const VITE_ENABLE_ANONYMOUS_MODE: boolean =
  import.meta.env.VITE_ENABLE_ANONYMOUS_MODE != undefined
const isDevelopment: boolean = process.env.NODE_ENV !== 'production'

const defaultApplicationModes: ApplicationMode[] = [
  ApplicationMode.Pianoto,
  ApplicationMode.Nonoto,
  ApplicationMode.Notono,
]
function parseAvailableApplicationModes(
  applicationModes: string | undefined
): ApplicationMode[] {
  if (applicationModes == undefined) {
    return defaultApplicationModes
  } else {
    const applicationModesUnvalidated = applicationModes
      .replace(' ', '')
      .split(',')
    return applicationModesUnvalidated
      .filter((value) => (allApplicationModes as string[]).contains(value))
      .map((value) => value as ApplicationMode)
  }
}
const VITE_AVAILABLE_APPLICATION_MODES: ApplicationMode[] =
  parseAvailableApplicationModes(
    import.meta.env.VITE_AVAILABLE_APPLICATION_MODES
  )

// via https://stackoverflow.com/a/17632779/
function cloneJSON<T>(obj: T): T {
  return <T>JSON.parse(JSON.stringify(obj))
}

const globalConfiguration: applicationConfiguration = {
  ...defaultConfiguration,
  ...customConfiguration,
}

const startupSplashAppTitle = VITE_APP_TITLE ?? defaultConfiguration['app_name']

globalConfiguration['splash_screen']['insert_eula_agreement_checkbox'] =
  globalConfiguration['splash_screen']['insert_eula_agreement_checkbox'] ||
  VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX

globalConfiguration['display_ircam_logo'] =
  globalConfiguration['display_ircam_logo'] && !VITE_HIDE_IRCAM_LOGO

globalConfiguration['inpainting_api_address_base'] =
  VITE_REMOTE_INPAINTING_API_ADDRESS_BASE

// TODO(theis) don't create modes like this (goes against 12 Factor App principles)
// should have truly orthogonal configuration options
const nonotoConfiguration = cloneJSON(globalConfiguration)
nonotoConfiguration['osmd'] = true
nonotoConfiguration['app_name'] = 'NONOTO'
nonotoConfiguration['spectrogram'] = false

const pianotoConfiguration = cloneJSON(globalConfiguration)
pianotoConfiguration['osmd'] = false
pianotoConfiguration['spectrogram'] = false
pianotoConfiguration['piano_roll'] = true
pianotoConfiguration['inpainting_api_address'] = VITE_PIA_INPAINTING_API_ADDRESS
pianotoConfiguration['app_name'] = 'PIANOTO'

const nonotoDeepbachConfiguration = cloneJSON(nonotoConfiguration)
nonotoDeepbachConfiguration['use_chords_instrument'] = false
nonotoDeepbachConfiguration['annotation_types'] = ['fermata']

const nonotoLeadsheetConfiguration = cloneJSON(nonotoConfiguration)
nonotoLeadsheetConfiguration['use_chords_instrument'] = true
nonotoLeadsheetConfiguration['annotation_types'] = ['chord_selector']

const nonotoFolkConfiguration = cloneJSON(nonotoConfiguration)
nonotoFolkConfiguration['use_chords_instrument'] = false
nonotoFolkConfiguration['annotation_types'] = []
nonotoFolkConfiguration['granularities_quarters'] = [1, 4, 8, 16]

const notonoConfiguration = cloneJSON(globalConfiguration)
notonoConfiguration['osmd'] = false
notonoConfiguration['spectrogram'] = true
notonoConfiguration['app_name'] = 'NOTONO'

if (VITE_ENABLE_ANONYMOUS_MODE) {
  notonoConfiguration['app_name'] = 'VQ-Inpainting'
  notonoConfiguration['display_sony_logo'] = false
  notonoConfiguration['display_ircam_logo'] = false
  document.body.classList.add('anonymous-mode')
}

const availableApplicationModes = VITE_AVAILABLE_APPLICATION_MODES

// TODO(@tbazin, 2021/10/15): move this to index.ts
// TODO(@tbazin, 2021/10/15): remove 'link_channel_prefix' from the editable configuration,
// just store it in LinkClient / LinkServer (but this would involve duplicate definitions...)
// or in a global read-only configuration file in common?
if (VITE_COMPILE_ELECTRON) {
  // window.abletonLinkApi.disable()
  // window.ipcRenderer
  //   .invoke('get-window-id')
  //   .then((windowID: number) => {
  //     window.ipcRenderer.send(
  //       globalConfiguration['link_channel_prefix'] +
  //         windowID.toString() +
  //         'disable'
  //     )
  //   })
  //   .catch((err) => {
  //     throw err
  //   })
}

export class SplashScreen {
  readonly renderPage: (configuration: applicationConfiguration) => void

  startButton: NexusTextButton | null = null

  readonly container: HTMLElement
  readonly scrollContainer: HTMLElement
  readonly scrollbar: SimpleBar

  readonly insertCustomAPIAdressInput: boolean
  readonly useHostedAPIToggle?: BooleanValue
  readonly serverAddressInput?: HTMLInputElement

  readonly insertEulaAccept: boolean
  readonly eulaContainer?: HTMLElement
  readonly eulaScrollbar?: SimpleBar
  readonly eulaAcceptToggle?: BooleanValue = undefined

  get eulaOkay(): boolean {
    if (!this.insertEulaAccept) {
      return true
    } else {
      if (this.eulaAcceptToggle == undefined) {
        throw new Error('EULA acceptance toggle not properly initialized')
      } else {
        return this.eulaAcceptToggle.value
      }
    }
  }

  get useHostedAPI(): boolean {
    return (
      this.serverAddressInput == undefined ||
      (this.useHostedAPIToggle?.value ?? false)
    )
  }

  protected insertEULA(
    eulaContent: string
  ): [BooleanValue, SimpleBar, HTMLElement] {
    const eulaContainer = document.createElement('div')
    eulaContainer.id = 'eula-container'
    this.container.appendChild(eulaContainer)

    const eulaTextScrollContainer = document.createElement('div')
    eulaTextScrollContainer.id = 'eula-text-scroll-container'
    eulaContainer.appendChild(eulaTextScrollContainer)
    const eulaTextContent = document.createElement('div')
    eulaTextContent.innerHTML = eulaContent // eulaContentByParagraphs.join('<br><br>')
    eulaTextContent.id = 'eula-text-content'
    eulaTextScrollContainer.appendChild(eulaTextContent)
    const scrollbar = new SimpleBar(eulaTextScrollContainer)

    const eulaAcceptToggle = new BooleanValue(false)
    const eulaAcceptToggleViewContainer = document.createElement('div')
    eulaAcceptToggleViewContainer.id = 'eula-accept-toggle-container'
    eulaContainer.appendChild(eulaAcceptToggleViewContainer)
    const eulaAcceptToggleView = new CycleSelectEnableDisableFontAwesomeView(
      eulaAcceptToggle
    )
    eulaAcceptToggleViewContainer.appendChild(eulaAcceptToggleView)

    return [eulaAcceptToggle, scrollbar, eulaContainer]
  }

  constructor(
    renderPage: (configuration: applicationConfiguration) => void,
    autostart = false
  ) {
    this.insertEulaAccept =
      globalConfiguration['splash_screen']['insert_eula_agreement_checkbox']
    document.body.classList.add('splash-screen')

    this.renderPage = renderPage

    this.scrollContainer = document.createElement('div')
    this.scrollContainer.classList.add('centeredXY')
    this.scrollContainer.id = 'configuration-selection-container'
    document.body.appendChild(this.scrollContainer)
    this.container = document.createElement('div')
    this.container.id = 'configuration-selection'
    this.scrollContainer.appendChild(this.container)
    this.scrollbar = new SimpleBar(this.scrollContainer, {
      autoHide: true,
    })

    const headerContainer = document.createElement('div')
    headerContainer.classList.add('application-header', 'no-undo-redo')
    this.container.appendChild(headerContainer)
    const insertSignatureInAppTitle = true
    Header.render(
      headerContainer,
      {
        display_sony_logo: true,
        display_ircam_logo: true && !VITE_HIDE_IRCAM_LOGO,
        app_name: startupSplashAppTitle,
      },
      insertSignatureInAppTitle
    )

    this.insertCustomAPIAdressInput =
      !VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT
    if (this.insertCustomAPIAdressInput) {
      const serverConfigurationContainerElement = document.createElement('div')
      serverConfigurationContainerElement.id = 'server-configuration-container'
      this.container.appendChild(serverConfigurationContainerElement)

      const serverConfigurationElement = document.createElement('div')
      serverConfigurationElement.id = 'server-configuration'
      serverConfigurationContainerElement.appendChild(
        serverConfigurationElement
      )

      const serverAddressContainer = document.createElement('div')
      serverAddressContainer.id = 'server-address-container'

      this.serverAddressInput = document.createElement('input')
      this.serverAddressInput.type = 'url'
      this.serverAddressInput.id = 'server-address-input'
      this.serverAddressInput.value =
        VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS ?? ''
      this.serverAddressInput.placeholder =
        VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS ?? ''
      serverAddressContainer.appendChild(this.serverAddressInput)

      const serverSetupHelpIcon = document.createElement('a')
      serverSetupHelpIcon.classList.add('fa-solid', 'fa-circle-question')
      serverSetupHelpIcon.title = 'Setup guide'
      serverSetupHelpIcon.href =
        'https://github.com/SonyCSLParis/music-inpainting-ts#running-the-models-locally'
      serverSetupHelpIcon.rel = 'noopener noreferrer'
      serverSetupHelpIcon.target = '_blank'
      serverAddressContainer.appendChild(serverSetupHelpIcon)

      this.serverAddressInput.addEventListener('input', () => {
        this.serverAddressInput?.classList.remove('wrong-input-setting')
        this.serverAddressInput?.scrollIntoView({ block: 'center' })
      })

      if (
        VITE_REMOTE_INPAINTING_API_ADDRESS_BASE != undefined ||
        VITE_PIA_INPAINTING_API_ADDRESS != undefined
      ) {
        this.useHostedAPIToggle = new BooleanValue(true)
        const useHostedAPIToggleViewContainer = document.createElement('div')
        useHostedAPIToggleViewContainer.id = 'use_remote_api-toggle'
        serverConfigurationElement.appendChild(useHostedAPIToggleViewContainer)
        const useHostedAPIToggleView =
          new CycleSelectEnableDisableFontAwesomeView(this.useHostedAPIToggle)
        useHostedAPIToggleViewContainer.appendChild(useHostedAPIToggleView)

        this.useHostedAPIToggle.on('change', (state: boolean | null) => {
          if (state == null) {
            return
          }
          serverAddressContainer.classList.toggle('hidden', state)
          if (state != null && !state) {
            this.serverAddressInput?.focus()
          } else {
            this.serverAddressInput?.classList.remove('wrong-input-setting')
          }
        })
      }

      serverConfigurationElement.appendChild(serverAddressContainer)
    }

    const modeConfigurationContainerElement = document.createElement('div')
    modeConfigurationContainerElement.id = 'mode-configuration-container'
    this.container.appendChild(modeConfigurationContainerElement)
    const modeConfigurationGridElement = document.createElement('div')
    modeConfigurationGridElement.id = 'mode-configuration'
    modeConfigurationContainerElement.appendChild(modeConfigurationGridElement)

    const applicationModeSelectElement = document.createElement('select')
    applicationModeSelectElement.style.visibility = 'hidden'
    applicationModeSelectElement.id = 'application-mode-select'
    modeConfigurationContainerElement.appendChild(applicationModeSelectElement)

    // TODO(@tbazin, 2021/11/04): should we validate the provided available
    // application modes?
    const applicationModes: ApplicationMode[] = allApplicationModes.filter(
      (mode) => availableApplicationModes.includes(mode)
    )

    // create HTMLOptionElements for all available mode options
    for (
      let applicationModeIndex = 0, numModes = applicationModes.length;
      applicationModeIndex < numModes;
      applicationModeIndex++
    ) {
      const applicationMode = applicationModes[applicationModeIndex]
      const applicationModeOptionElement = document.createElement('option')
      applicationModeOptionElement.value = applicationMode
      applicationModeSelectElement.appendChild(applicationModeOptionElement)
    }

    const applicationModeButtons = new Map<ApplicationMode, NexusTextButton>()

    const applicationModeButtonsLabel: Record<ApplicationMode, string> = {
      pianoto: 'PIANOTO',
      nonoto: 'NONOTO',
      notono: 'NOTONO',
      'nonoto-folk-song': 'NONOTO (Folk songs)',
      'nonoto-leadsheet': 'NONOTO (DeepSheet)',
    }

    const createApplicationModeButton = (
      applicationMode: ApplicationMode
    ): void => {
      const buttonElement: HTMLElement = document.createElement('div')
      const buttonId = applicationMode + '-configuration-button'
      buttonElement.id = buttonId
      buttonElement.classList.add('control-item')
      modeConfigurationGridElement.appendChild(buttonElement)

      const buttonLabel = applicationModeButtonsLabel[applicationMode]
      const button = new Nexus.TextButton(buttonId, {
        size: [150, 50],
        state: true,
        text: buttonLabel,
        alternateText: buttonLabel,
      })
      button.element.classList.add(
        'nexus-text-button',
        'mode-configuration-button'
      )
      button.textElement?.classList.add('mode-configuration-button-text')
      applicationModeButtons.set(applicationMode, button)
    }
    applicationModes.forEach(createApplicationModeButton)

    const selectMode = (applicationMode: ApplicationMode) => {
      const emitting = false
      applicationModeButtons.forEach((button: NexusTextButton) => {
        button.turnOff(emitting)
      })
      applicationModeButtons.get(applicationMode).turnOn(emitting)
      applicationModeSelectElement.value = applicationMode
    }

    applicationModeButtons.forEach(
      (button: NexusTextButton, applicationMode: ApplicationMode) => {
        button.on('change', () => {
          selectMode(applicationMode)
        })
      }
    )

    selectMode(applicationModes[0])
    if (availableApplicationModes.length == 1) {
      modeConfigurationContainerElement.style.display = 'none'
    }

    if (this.insertEulaAccept) {
      // TODO(@tbazin, 2022/04/25): do not return elements, attach them directly
      //  as properties?
      ;[this.eulaAcceptToggle, this.eulaScrollbar, this.eulaContainer] =
        this.insertEULA(localization['eula']['en'])
      this.eulaScrollbar
        .getScrollElement()
        .addEventListener('scroll', (event) => {
          const scrollElement = <HTMLElement>event.target
          const verticalThreshold = 30
          const isScrolledWithinMargin =
            scrollElement.scrollTop + scrollElement.clientHeight >=
            scrollElement.scrollHeight - verticalThreshold
          if (
            this.eulaContainer.classList.contains('is-fully-scrolled') !=
            isScrolledWithinMargin
          ) {
            requestAnimationFrame(() =>
              this.eulaContainer.classList.toggle(
                'is-fully-scrolled',
                isScrolledWithinMargin
              )
            )
          }
        })
    }

    if (globalConfiguration['insert_recaptcha']) {
      this.renderRecaptcha()
    } else {
      this.renderStartButton()
    }

    if (!VITE_COMPILE_ELECTRON) {
      // insert disclaimer
      const disclaimerElement = document.createElement('div')
      disclaimerElement.classList.add('disclaimer')
      this.container.appendChild(disclaimerElement)
      disclaimerElement.innerHTML =
        localization['splash-screen']['disclaimer']['en']
    }

    const footerElement = document.createElement('div')
    footerElement.classList.add('configuration-selection-footer')
    this.container.appendChild(footerElement)
    const githubElement = document.createElement('div')
    githubElement.innerHTML = localization['header']['github']['en']
    githubElement.classList.add('github-link')
    footerElement.appendChild(githubElement)

    if (autostart) {
      this.pressStart()
    }
  }
  protected pressStart(): void {
    const startButtonElement = document.getElementById('start-button')
    startButtonElement?.dispatchEvent(new PointerEvent('pointerup'))
  }

  protected getApiStatusCheckMethod():
    | ((apiAdress: URL) => Promise<boolean>)
    | undefined {
    const applicationMode = this.getSelectedApplicationMode()
    switch (applicationMode) {
      case 'pianoto':
        return PiaInpainter.testAPI.bind(PiaInpainter)
      case 'nonoto':
      case 'nonoto-leadsheet':
      case 'nonoto-folk-song':
      case 'notono':
        return async (apiAddress: URL) => {
          const abortController = new AbortController()
          const timeout = setTimeout(() => {
            abortController.abort()
          }, 10000)
          try {
            const response = await fetch(
              new URL('timerange-change', apiAddress),
              {
                method: 'post',
                signal: abortController.signal,
              }
            )
            return response.ok || response.status == 400
          } catch (reason) {
            log.error(reason)
            return false
          }
        }
    }
  }

  protected getSelectedApplicationMode(): ApplicationMode {
    const applicationModeSelectElement = <HTMLSelectElement>(
      document.getElementById('application-mode-select')
    )
    let applicationMode = applicationModeSelectElement.value as
      | ApplicationMode
      | ''
    if (
      (applicationMode == undefined || applicationMode == '') &&
      availableApplicationModes.length == 1
    ) {
      // HACK(@tbazin, 2022/09/15): attempt at a workaround for the Chrome Mobile soft reload bug
      // that leads to the app not being able to start when the tab is reload after being left in the
      // background for a while, in which case, strangely, `applicationModeSelectElement.value == ''`
      applicationMode = availableApplicationModes[0]
    }
    if (applicationMode == '' || applicationMode == undefined) {
      throw new Error('Cannot retrieve currently selected application mode')
    }
    return applicationMode
  }

  protected getCurrentConfiguration(): applicationConfiguration {
    const applicationMode = this.getSelectedApplicationMode()
    let configuration: applicationConfiguration = { ...defaultConfiguration }
    switch (applicationMode) {
      case 'nonoto':
        configuration = { ...nonotoDeepbachConfiguration }
        break
      case 'nonoto-leadsheet':
        configuration = { ...nonotoLeadsheetConfiguration }
        break
      case 'pianoto':
        configuration = { ...pianotoConfiguration }
        break
      case 'nonoto-folk-song':
        configuration = { ...nonotoFolkConfiguration }
        break
      case 'notono':
        configuration = { ...notonoConfiguration }
        break
    }

    configuration['inpainting_api_address'] =
      this.getServerAddress(configuration)

    return configuration
  }

  protected getServerAddress(configuration?: applicationConfiguration): URL {
    let url: URL | undefined = undefined
    configuration = configuration ?? this.getCurrentConfiguration()

    if (this.useHostedAPI) {
      if (
        configuration != null &&
        configuration['inpainting_api_address'] != undefined
      ) {
        url = new URL(configuration['inpainting_api_address'])
      } else {
        const apiEndpointRoute = applicationModeToAPIEndpointRoute.get(
          this.getSelectedApplicationMode()
        )
        if (apiEndpointRoute == undefined) {
          throw new Error(
            'Could not retrieve applicationMode-specific API endpoint route'
          )
        }
        url = new URL(apiEndpointRoute, VITE_REMOTE_INPAINTING_API_ADDRESS_BASE)
      }
    } else {
      if (this.serverAddressInput == null) {
        throw new Error()
      }
      let address =
        this.serverAddressInput.value.length > 0
          ? this.serverAddressInput.value
          : this.serverAddressInput.placeholder

      // add trailing slash
      address += address.endsWith('/') ? '' : '/'
      try {
        url = new URL(address)
      } catch (reason) {
        log.error(reason)
        this.shakeServerAddressInput(false, true)
      }
    }
    if (url == undefined) {
      throw new Error('Could not retrieve inpainting API address')
    }
    return url
  }

  // TODO(theis, 2021/05/18): check that the address points to a valid API server,
  // through a custom ping-like call
  async checkServerAddress(
    forceRetriggerVisualAnimation: boolean = false
  ): Promise<boolean> {
    const apiCheckMethod = this.getApiStatusCheckMethod()
    if (apiCheckMethod == undefined) {
      return false
    }
    const url = this.getServerAddress()

    let isValidURL: boolean = false
    // taken from https://stackoverflow.com/a/43467144
    try {
      isValidURL = url.protocol === 'http:' || url.protocol === 'https:'
    } catch (_) {
      isValidURL = false
    }

    let serverIsAvailable: boolean = false
    if (isValidURL && url != undefined) {
      try {
        serverIsAvailable = await apiCheckMethod(url)
      } catch (reason) {
        log.error(reason)
      }
    }
    this.shakeServerAddressInput(
      serverIsAvailable,
      forceRetriggerVisualAnimation
    )

    return serverIsAvailable
  }

  protected shakeServerAddressInput(
    serverIsAvailable: boolean,
    forceRetriggerVisualAnimation: boolean = false
  ): void {
    if (this.serverAddressInput == undefined) {
      return
    }
    this.serverAddressInput.classList.toggle('wrong-input-setting', false)
    if (forceRetriggerVisualAnimation) {
      this.serverAddressInput.offsetHeight // trigger reflow
    }
    this.serverAddressInput.classList.toggle(
      'wrong-input-setting',
      !serverIsAvailable
    )
    if (!serverIsAvailable) {
      this.serverAddressInput.scrollIntoView({ block: 'center' })
      this.serverAddressInput.focus()
    }
  }

  protected async checkConfiguration(
    forceRetriggerVisualAnimation: boolean = false
  ): Promise<boolean> {
    if (!VITE_NO_CHECK_API_STATUS) {
      this.startButton.text = 'Checking API status...'
      this.container.classList.add('api-status-check')
      const remoteApiIsValid = await this.checkServerAddress(
        forceRetriggerVisualAnimation
      )
      this.container.classList.remove('api-status-check')
      this.startButton.text = 'Start'
      return remoteApiIsValid
    } else {
      return true
    }
  }

  protected renderStartButton(): void {
    const configurationWindow = document.getElementById(
      'configuration-selection'
    )

    const startButtonElement = document.createElement('div')
    startButtonElement.id = 'start-button'
    startButtonElement.classList.add('control-item')
    configurationWindow.appendChild(startButtonElement)

    this.startButton = new Nexus.TextButton('#start-button', {
      size: [150, 50],
      state: false,
      text: 'Start',
    })
    this.startButton.element.classList.add('nexus-text-button')

    const startCallback = async (): Promise<void> => {
      await Tone.start()
      const context = Tone.context.rawContext
      unmute(context, true)

      await this.disposeAndStart()
    }

    let pulsingTimeout = setTimeout(() => {
      return
    }, 0)
    startButtonElement.addEventListener(
      'pointerup',
      () => {
        if (this.eulaOkay) {
          void startCallback()
        } else {
          clearTimeout(pulsingTimeout)
          this.eulaContainer.classList.remove('pulsing')
          pulsingTimeout = setTimeout(
            () => this.eulaContainer.classList.add('pulsing'),
            15
          )
        }
      },
      true
    )

    if (this.useHostedAPIToggle != undefined) {
      this.useHostedAPIToggle.emitChanged()
    }
  }

  protected async verifyCaptcha(recaptchaResponse: string): Promise<boolean> {
    const currentConfiguration = this.getCurrentConfiguration()
    const recaptchaVerificationIp: string =
      globalConfiguration['recaptcha_verification_ip'] ||
      currentConfiguration['inpainting_api_address']
    const recaptchaVerificationPort: number =
      globalConfiguration['recaptcha_verification_port']
    const recaptchaVerificationCommand: string =
      globalConfiguration['recaptcha_verification_command']
    const recaptchaVerificationUrl = `http://${recaptchaVerificationIp}:${recaptchaVerificationPort}/${recaptchaVerificationCommand}`
    const jsonResponse = await $.post({
      url: recaptchaVerificationUrl,
      data: JSON.stringify({
        recaptchaResponse: recaptchaResponse,
      }),
      contentType: 'application/json',
      dataType: 'json',
    })

    return jsonResponse['success']
  }

  protected async onreceiveRecaptchaResponse(
    recaptchaResponse: string
  ): Promise<void> {
    const recaptchaSuccessful = await this.verifyCaptcha(recaptchaResponse)
    if (recaptchaSuccessful) {
      await this.disposeAndStart()
    }
  }

  protected renderRecaptcha(): void {
    const configurationWindow = document.getElementById(
      'configuration-selection'
    )
    // load recaptcha library asynchronously
    const recaptcha_script: HTMLScriptElement = document.createElement('script')
    recaptcha_script.src = 'https://www.google.com/recaptcha/api.js'
    recaptcha_script.defer = true
    recaptcha_script.async = true
    document.head.appendChild(recaptcha_script)

    const recaptchaElement: HTMLDivElement = document.createElement('div')
    recaptchaElement.id = 'g-recaptcha'
    recaptchaElement.classList.add('g-recaptcha')

    // special all-access development key provided at:
    // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
    const recaptchaDevSitekey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
    const recaptchaSitekey: string = !isDevelopment
      ? globalConfiguration['recaptcha_sitekey']
      : recaptchaDevSitekey
    recaptchaElement.setAttribute('data-sitekey', recaptchaSitekey)

    recaptchaElement.setAttribute('data-theme', 'dark')
    recaptchaElement.setAttribute('data-callback', 'onreceiveRecaptchaResponse')
    window['onreceiveRecaptchaResponse'] =
      this.onreceiveRecaptchaResponse.bind(this)
    configurationWindow.appendChild(recaptchaElement)
  }

  protected async disposeAndStart(): Promise<void> {
    const currentConfiguration = this.getCurrentConfiguration()

    if (!(await this.checkConfiguration(true))) {
      return
    }

    // clean-up the splash screen
    this.dispose()
    this.renderPage(currentConfiguration)
  }

  protected dispose(): void {
    if (document.getElementById('configuration-selection')) {
      document.getElementById('configuration-selection').remove()
      document.body.classList.remove('splash-screen')
    }
  }
}
