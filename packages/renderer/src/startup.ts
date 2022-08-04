// start-up module offering a splash screen in which to select the configuration
// this menu also allows to properly start the AudioContext upon the user
// clicking on the start button
import * as Tone from 'tone'
import SimpleBar from 'simplebar'

import Nexus from './nexusColored'
import { NexusTextButton } from 'nexusui'
import * as Header from './header'
import {
  BooleanValue,
  CycleSelectEnableDisableFontAwesomeView,
} from './cycleSelect'

import localizations from '../static/localization.json'
import defaultConfiguration from '../../common/default_config.json'
import customConfiguration from '../../../config.json'

import '../styles/startupSplash.scss'
import { setBackgroundColorElectron } from './utils/display'
import colors from '../styles/mixins/_colors.module.scss'

export type applicationConfiguration = typeof defaultConfiguration

// TODO(@tbazin, 2021/11/04): merge all symbolic modes
// and auto-detect sheet layout in app
enum ApplicationMode {
  Pia = 'pia',
  Chorale = 'chorale',
  Leadsheet = 'leadsheet',
  Folk = 'folk',
  Spectrogram = 'spectrogram',
}
const allApplicationModes = [
  ApplicationMode.Pia,
  ApplicationMode.Chorale,
  ApplicationMode.Leadsheet,
  ApplicationMode.Folk,
  ApplicationMode.Spectrogram,
]

const applicationModeToAPIResourceName: Map<ApplicationMode, string> = new Map([
  [ApplicationMode.Pia, 'pia/'],
  [ApplicationMode.Chorale, 'deepbach/'],
  [ApplicationMode.Spectrogram, 'notono/'],
])

const VITE_COMPILE_ELECTRON: boolean =
  import.meta.env.VITE_COMPILE_ELECTRON != undefined
const VITE_APP_TITLE: string | undefined = import.meta.env.VITE_APP_TITLE
const VITE_REMOTE_INPAINTING_API_ADDRESS: string | undefined = import.meta.env
  .VITE_REMOTE_INPAINTING_API_ADDRESS
const VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS: string | undefined =
  import.meta.env.VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS
const VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT: boolean =
  import.meta.env.VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT !=
  undefined
const VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX: boolean =
  import.meta.env.VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX != undefined
const VITE_ENABLE_ANONYMOUS_MODE: boolean =
  import.meta.env.VITE_ENABLE_ANONYMOUS_MODE != undefined
const isDevelopment: boolean = process.env.NODE_ENV !== 'production'

const defaultApplicationModes: ApplicationMode[] = [
  ApplicationMode.Chorale,
  ApplicationMode.Spectrogram,
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

globalConfiguration['splash_screen']['insert_eula_agreement_checkbox'] =
  globalConfiguration['splash_screen']['insert_eula_agreement_checkbox'] ||
  VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX

globalConfiguration['inpainting_api_address'] =
  VITE_REMOTE_INPAINTING_API_ADDRESS

// TODO(theis) don't create modes like this (goes against 12 Factor App principles)
// should have truly orthogonal configuration options
const osmdConfiguration = cloneJSON(globalConfiguration)
osmdConfiguration['osmd'] = true
osmdConfiguration['app_name'] = 'nonoto'
osmdConfiguration['spectrogram'] = false

const piaConfiguration = cloneJSON(globalConfiguration)
piaConfiguration['osmd'] = false
piaConfiguration['spectrogram'] = false
piaConfiguration['piano_roll'] = true
piaConfiguration['app_name'] = 'pianoto'

const choraleConfiguration = cloneJSON(osmdConfiguration)
choraleConfiguration['use_chords_instrument'] = false
choraleConfiguration['annotation_types'] = ['fermata']

const leadsheetConfiguration = cloneJSON(osmdConfiguration)
leadsheetConfiguration['use_chords_instrument'] = true
leadsheetConfiguration['annotation_types'] = ['chord_selector']

const folkConfiguration = cloneJSON(osmdConfiguration)
folkConfiguration['use_chords_instrument'] = false
folkConfiguration['annotation_types'] = []
folkConfiguration['granularities_quarters'] = [1, 4, 8, 16]

const spectrogramConfiguration = cloneJSON(globalConfiguration)
spectrogramConfiguration['osmd'] = false
spectrogramConfiguration['spectrogram'] = true
spectrogramConfiguration['app_name'] = 'notono'

if (VITE_ENABLE_ANONYMOUS_MODE) {
  spectrogramConfiguration['app_name'] = 'VQ-Inpainting'
  spectrogramConfiguration['display_sony_logo'] = false
  spectrogramConfiguration['display_ircam_logo'] = false
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
    Header.render(headerContainer, {
      display_sony_logo: true,
      display_ircam_logo: true,
      app_name:
        VITE_APP_TITLE != null ? VITE_APP_TITLE.toLowerCase() : 'notono',
    })

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

      this.useHostedAPIToggle = new BooleanValue(true)
      const useHostedAPIToggleViewContainer = document.createElement('div')
      useHostedAPIToggleViewContainer.id = 'use_remote_api-toggle'
      serverConfigurationElement.appendChild(useHostedAPIToggleViewContainer)
      const useHostedAPIToggleView =
        new CycleSelectEnableDisableFontAwesomeView(this.useHostedAPIToggle)
      useHostedAPIToggleViewContainer.appendChild(useHostedAPIToggleView)

      const serverAddressContainer = document.createElement('div')
      serverAddressContainer.id = 'server-address-container'
      serverConfigurationElement.appendChild(serverAddressContainer)

      this.serverAddressInput = document.createElement('input')
      this.serverAddressInput.type = 'url'
      this.serverAddressInput.id = 'server-address-input'
      this.serverAddressInput.value = VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS
      this.serverAddressInput.placeholder =
        VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS
      serverAddressContainer.appendChild(this.serverAddressInput)

      this.serverAddressInput.addEventListener('input', () => {
        this.checkServerAddress()
      })

      this.useHostedAPIToggle.on('change', (state: boolean | null) => {
        if (state == null) {
          return
        }
        serverAddressContainer.classList.toggle('hidden', state)
        if (state != null && !state) {
          this.checkServerAddress(this.getCurrentConfiguration(), true)
          this.serverAddressInput?.focus()
        }
      })
      this.useHostedAPIToggle.emitChanged()
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
      pia: 'PIA',
      chorale: 'DeepBach',
      leadsheet: 'Leadsheets',
      folk: 'Folk songs',
      spectrogram: 'Spectrogram',
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
        this.insertEULA(localizations['eula']['en'])
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
      disclaimerElement.id = 'splash-screen-disclaimer'
      this.container.appendChild(disclaimerElement)
      disclaimerElement.innerHTML =
        localizations['splash-screen-disclaimer']['en']
    }

    if (autostart) {
      this.pressStart()
    }
  }
  protected pressStart(): void {
    const startButtonElement = document.getElementById('start-button')
    startButtonElement?.dispatchEvent(new PointerEvent('pointerup'))
  }

  protected getCurrentConfiguration(): applicationConfiguration {
    const applicationModeSelectElement = <HTMLSelectElement>(
      document.getElementById('application-mode-select')
    )
    const applicationMode =
      applicationModeSelectElement.value as ApplicationMode
    let configuration: applicationConfiguration
    switch (applicationMode) {
      case 'chorale':
        configuration = choraleConfiguration
        break
      case 'leadsheet':
        configuration = leadsheetConfiguration
        break
      case 'pia':
        configuration = piaConfiguration
        break
      case 'folk':
        configuration = folkConfiguration
        break
      case 'spectrogram':
        configuration = spectrogramConfiguration
        break
    }

    if (!this.useHostedAPI) {
      if (this.serverAddressInput.value.length > 0) {
        configuration['inpainting_api_address'] = this.serverAddressInput.value
      }
    } else {
      const resourceName = applicationModeToAPIResourceName.get(applicationMode)
      configuration['inpainting_api_address'] = new URL(
        resourceName,
        VITE_REMOTE_INPAINTING_API_ADDRESS
      ).toString()
    }

    return configuration
  }

  // TODO(theis, 2021/05/18): check that the address points to a valid API server,
  // through a custom ping-like call
  async checkServerAddress(
    configuration?: applicationConfiguration,
    forceRetriggerVisualAnimation: boolean = false
  ): Promise<boolean> {
    let address: string
    if (
      configuration != null &&
      (configuration['disable_inpainting_api_parameters_input'] ||
        this.serverAddressInput == null)
    ) {
      address = configuration['inpainting_api_address']
    } else {
      address =
        this.serverAddressInput.value.length > 0
          ? this.serverAddressInput.value
          : this.serverAddressInput.placeholder
    }

    // taken from https://stackoverflow.com/a/43467144
    let url: URL | null = null
    let isValidURL: boolean = false
    try {
      url = new URL(address)

      isValidURL = url.protocol === 'http:' || url.protocol === 'https:'
    } catch (_) {
      isValidURL = false
    }

    let serverIsAvailable: boolean = false
    if (isValidURL && url != undefined) {
      try {
        await fetch(new URL('timerange-change', url), {
          method: 'post',
        })
        serverIsAvailable = true
      } catch (_) {}
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
    this.serverAddressInput?.classList.toggle('wrong-input-setting', false)
    if (forceRetriggerVisualAnimation) {
      this.serverAddressInput?.offsetHeight // trigger reflow
    }
    this.serverAddressInput?.classList.toggle(
      'wrong-input-setting',
      !serverIsAvailable
    )
  }

  // TODO(theis, 2021/05/18): add a shake effect on error
  protected async checkConfiguration(
    configuration: applicationConfiguration,
    forceRetriggerVisualAnimation: boolean = false
  ): Promise<boolean> {
    return (
      this.useHostedAPI ||
      (await this.checkServerAddress(
        configuration,
        forceRetriggerVisualAnimation
      ))
    )
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

    const startCallback = async (): Promise<void> => {
      await Tone.start()

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

    if (!(await this.checkConfiguration(currentConfiguration, true))) {
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
