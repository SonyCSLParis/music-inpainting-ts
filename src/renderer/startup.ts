// start-up module offering a splash screen in which to select the configuration
// this menu also allows to properly start the AudioContext upon the user
// clicking on the start button
import * as Tone from 'tone'

import Nexus from './nexusColored'

import '../common/styles/startupSplash.scss'

enum ApplicationMode {
  Chorale = 'chorale',
  Leadsheet = 'leadsheet',
  Folk = 'folk',
  Spectrogram = 'spectrogram',
}

// defined at compile-time via webpack.DefinePlugin
declare let COMPILE_ELECTRON: boolean
declare const DEFAULT_INPAINTING_API_ADDRESS: string
declare const SPECTROGRAM_ONLY: boolean
declare const ENABLE_ANONYMOUS_MODE: boolean
const isDevelopment: boolean = process.env.NODE_ENV !== 'production'

// via https://stackoverflow.com/a/17632779/
function cloneJSON<T>(obj: T): T {
  return <T>JSON.parse(JSON.stringify(obj))
}

import defaultConfiguration from '../common/default_config.json'
type applicationConfiguration = typeof defaultConfiguration
import customConfiguration from '../../config.json'
const globalConfiguration: applicationConfiguration = {
  ...defaultConfiguration,
  ...customConfiguration,
}

// fallback to Webpack globals if no value defined in the JSON configuration
globalConfiguration['inpainting_api_address'] =
  globalConfiguration['inpainting_api_address'] ||
  DEFAULT_INPAINTING_API_ADDRESS

// TODO(theis) don't create modes like this (goes against 12 Factor App principles)
// should have truly orthogonal configuration options
const osmdConfiguration = cloneJSON(globalConfiguration)
osmdConfiguration['osmd'] = true
osmdConfiguration['app_name'] = 'nonoto'
osmdConfiguration['spectrogram'] = false

const choraleConfiguration = cloneJSON(osmdConfiguration)
choraleConfiguration['use_chords_instrument'] = false
choraleConfiguration['annotation_types'] = ['fermata']

const leadsheetConfiguration = cloneJSON(osmdConfiguration)
leadsheetConfiguration['use_chords_instrument'] = true
leadsheetConfiguration['annotation_types'] = ['chord_selector']

const folkConfiguration = cloneJSON(osmdConfiguration)
folkConfiguration['use_chords_instrument'] = false
folkConfiguration['annotation_types'] = []
folkConfiguration['granularities_quarters'] = ['1', '4', '8', '16']

const spectrogramConfiguration = cloneJSON(globalConfiguration)
spectrogramConfiguration['osmd'] = false
spectrogramConfiguration['spectrogram'] = true
spectrogramConfiguration['app_name'] = 'notono'
spectrogramConfiguration['display_ircam_logo'] = true

if (ENABLE_ANONYMOUS_MODE) {
  spectrogramConfiguration['app_name'] = 'VQ-Inpainting'
  spectrogramConfiguration['display_sony_logo'] = false
  spectrogramConfiguration['display_ircam_logo'] = false
  document.body.classList.add('anonymous-mode')
}

const spectrogramOnlyMode: boolean =
  SPECTROGRAM_ONLY || globalConfiguration['spectrogram_only']

export function render(
  renderPage: (configuration: applicationConfiguration) => void
): void {
  document.body.classList.add('splash-screen')

  const configurationWindow = document.createElement('div')
  configurationWindow.classList.add('centeredXY', 'glow-shadow')
  configurationWindow.id = 'configuration-selection'
  document.body.appendChild(configurationWindow)

  if (!globalConfiguration['disable_inpainting_api_parameters_input']) {
    const serverConfigElement = document.createElement('div')
    serverConfigElement.id = 'server-configuration'
    configurationWindow.appendChild(serverConfigElement)

    const serverAddressContainer = document.createElement('div')
    serverAddressContainer.id = 'server-address-container'
    serverConfigElement.appendChild(serverAddressContainer)

    const serverAddressInput = document.createElement('input')
    serverAddressInput.type = 'url'
    serverAddressInput.id = 'server-address-input'
    serverAddressInput.value = `${globalConfiguration['inpainting_api_address']}`
    serverAddressInput.placeholder = `${globalConfiguration['inpainting_api_address']}`
    serverAddressContainer.appendChild(serverAddressInput)

    serverAddressInput.addEventListener('input', () => {
      checkServerAddress()
    })
  }

  if (!spectrogramOnlyMode) {
    const modeConfigElement = document.createElement('div')
    modeConfigElement.id = 'mode-configuration'
    configurationWindow.appendChild(modeConfigElement)

    const applicationModeSelectElement = document.createElement('select')
    applicationModeSelectElement.style.visibility = 'hidden'
    applicationModeSelectElement.id = 'application-mode-select'
    configurationWindow.appendChild(applicationModeSelectElement)

    const applicationModes: ApplicationMode[] = [
      ApplicationMode.Chorale,
      ApplicationMode.Leadsheet,
      ApplicationMode.Folk,
      ApplicationMode.Spectrogram,
    ]
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

    const applicationModeButtons = new Map<ApplicationMode, Nexus.TextButton>()

    const applicationModeButtonsLabel: Record<ApplicationMode, string> = {
      chorale: 'Chorales',
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
      modeConfigElement.appendChild(buttonElement)

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
      applicationModeButtons.forEach((button: Nexus.TextButton) => {
        button.turnOff(emitting)
      })
      applicationModeButtons.get(applicationMode).turnOn(emitting)
      applicationModeSelectElement.value = applicationMode
    }

    applicationModeButtons.forEach(
      (button: Nexus.TextButton, applicationMode: ApplicationMode) => {
        button.on('change', () => {
          selectMode(applicationMode)
        })
      }
    )

    selectMode(applicationModes[0])
  }

  if (COMPILE_ELECTRON && false) {
    // open native file system 'open-file' dialog

    const customButtonElement = document.createElement('div')
    customButtonElement.id = 'custom-configuration-button'
    customButtonElement.classList.add('control-item')
    configurationWindow.appendChild(customButtonElement)

    // create HTML element to upload configuration file
    const customConfigurationInput: HTMLInputElement = document.createElement(
      'input'
    )
    customConfigurationInput.type = 'file'
    customConfigurationInput.id = 'configuration-input'
    customConfigurationInput.accept = 'application/json'
    configurationWindow.appendChild(customConfigurationInput)

    const custombutton = new Nexus.TextButton('#custom-configuration-button', {
      size: [150, 50],
      state: false,
      text: 'Custom (load json) (check GitHub repository for example JSON)',
      alternateText: false,
    })

    custombutton.on('change', () => {
      customConfigurationInput.click()
    })
  }

  if (globalConfiguration['insert_recaptcha']) {
    renderRecaptcha(renderPage)
  } else {
    renderStartButton(renderPage)
  }
}

function getCurrentConfiguration(): applicationConfiguration {
  const applicationModeSelectElement = <HTMLSelectElement>(
    document.getElementById('application-mode-select')
  )
  let applicationMode: ApplicationMode
  if (!spectrogramOnlyMode) {
    applicationMode = applicationModeSelectElement.value as ApplicationMode
  } else {
    applicationMode = ApplicationMode.Spectrogram
  }
  let configuration: applicationConfiguration
  switch (applicationMode) {
    case 'chorale':
      configuration = choraleConfiguration
      break
    case 'leadsheet':
      configuration = leadsheetConfiguration
      break
    case 'folk':
      configuration = folkConfiguration
      break
    case 'spectrogram':
      configuration = spectrogramConfiguration
      break
  }

  const serverAddressInput = <HTMLInputElement>(
    document.getElementById('server-address-input')
  )
  if (!globalConfiguration['disable_inpainting_api_parameters_input']) {
    if (serverAddressInput.value.length > 0) {
      configuration['inpainting_api_address'] = serverAddressInput.value
    }
  }

  return configuration
}

// TODO(theis, 2021/05/18): check that the address points to a valid API server,
// through a custom ping-like call
function checkServerAddress(configuration?: applicationConfiguration): boolean {
  const serverAddressInput = <HTMLInputElement>(
    document.getElementById('server-address-input')
  )
  let address: string
  if (
    configuration != null &&
    (configuration['disable_inpainting_api_parameters_input'] ||
      serverAddressInput == null)
  ) {
    address = configuration['inpainting_api_address']
  } else {
    address =
      serverAddressInput.value.length > 0
        ? serverAddressInput.value
        : serverAddressInput.placeholder
  }

  // taken from https://stackoverflow.com/a/43467144
  let url: URL
  let isValid: boolean
  try {
    url = new URL(address)

    isValid = url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_) {
    isValid = false
  }

  if (serverAddressInput !== null) {
    // apply visual feedback
    if (!isValid) {
      serverAddressInput.style.borderColor = 'red'
      serverAddressInput.style.color = 'red'
    } else {
      serverAddressInput.style.borderColor = 'initial'
      serverAddressInput.style.color = 'initial'
    }
  }

  return isValid
}

// TODO(theis, 2021/05/18): add a shake effect on error
function checkConfiguration(configuration: applicationConfiguration): boolean {
  return checkServerAddress(configuration)
}

function renderStartButton(
  renderPage: (configuration: applicationConfiguration) => void
) {
  const configurationWindow = document.getElementById('configuration-selection')

  const startButtonElement = document.createElement('div')
  startButtonElement.id = 'start-button'
  startButtonElement.classList.add('control-item')
  configurationWindow.appendChild(startButtonElement)

  new Nexus.TextButton('#start-button', {
    size: [150, 50],
    state: false,
    text: 'Start',
  })

  const startCallback = async (v = true): Promise<void> => {
    if (v) {
      Tone.setContext(
        new Tone.Context({
          lookAhead: 0,
        })
      )
      await Tone.start()

      disposeAndStart(renderPage)
    }
  }

  startButtonElement.addEventListener(
    'pointerup',
    () => {
      void startCallback()
    },
    true
  )
}

function renderRecaptcha(
  renderPage: (configuration: applicationConfiguration) => void
) {
  const configurationWindow = document.getElementById('configuration-selection')

  // load recaptcha library asynchronously
  const recaptcha_script: HTMLScriptElement = document.createElement('script')
  recaptcha_script.src = 'https://www.google.com/recaptcha/api.js'
  recaptcha_script.defer = true
  recaptcha_script.async = true
  document.head.appendChild(recaptcha_script)

  async function onreceiveRecaptchaResponse(recaptchaResponse: string) {
    const jsonResponse = await verifyCaptcha(recaptchaResponse)
    if (jsonResponse['success']) {
      disposeAndStart(renderPage)
    }
  }

  async function verifyCaptcha(recaptchaResponse: string) {
    const currentConfiguration = getCurrentConfiguration()
    const recaptchaVerificationIp =
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

    return jsonResponse
  }

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
  window['onreceiveRecaptchaResponse'] = onreceiveRecaptchaResponse.bind(this)
  configurationWindow.appendChild(recaptchaElement)
}

function disposeAndStart(
  renderPage: (configuration: applicationConfiguration) => void
): void {
  const currentConfiguration = getCurrentConfiguration()

  if (!checkConfiguration(currentConfiguration)) {
    return
  }

  // clean-up the splash screen
  dispose()
  renderPage(currentConfiguration)
}

function dispose(): void {
  if (document.getElementById('configuration-selection')) {
    document.getElementById('configuration-selection').remove()
    document.body.classList.remove('splash-screen')
  }
}
