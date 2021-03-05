import * as configuration from '../common/default_config.json'
import * as localizations from '../common/localization.json'

export function createLabel(
  controlElement: HTMLElement,
  id: string,
  isAdvancedControl = false,
  localizationId?: string,
  containerElement?: HTMLElement
): void {
  const labelElement: HTMLElement = document.createElement('control-label')
  labelElement.id = id
  if (localizationId == undefined) {
    localizationId = id
  }
  const controlLabel = `${
    localizations['control-labels'][localizationId][
      configuration['main_language']
    ]
  }`
  const secondary_language = configuration['secondary_language']
  if (secondary_language && !(secondary_language === '')) {
    controlLabel.concat(
      `<br><i>${localizations['control-labels'][localizationId][secondary_language]}</i>`
    )
  }
  labelElement.innerHTML = controlLabel
  labelElement.classList.toggle('advanced', isAdvancedControl)

  if (containerElement == undefined) {
    const defaultContainerId = 'bottom-controls'
    const maybeBottomControlsElement = document.getElementById(
      defaultContainerId
    )
    if (maybeBottomControlsElement == null) {
      throw new EvalError(
        `No container element provided and the of ${defaultContainerId} does not exist on the DOM`
      )
    }
    const bottomControlsElement = maybeBottomControlsElement
    containerElement = bottomControlsElement
  }
  containerElement.appendChild(labelElement)
}
