import configuration from '../../common/default_config.json'
import localizations from '../static/localization.json'

export function createLabel(
  controlElement: HTMLElement,
  id: string, // TOTO(theis, 2021/08/02): remove this, unnecessary to set an ID
  isAdvancedControl = false, // FIXME(theis, 2021/08/02): redundant, could be infered from associated controlElement
  localizationId?: string,
  containerElement?: HTMLElement
): HTMLElement {
  const labelElement: HTMLElement = document.createElement('div')
  labelElement.classList.add('control-label')
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

  if (containerElement == undefined) {
    const defaultContainerId = 'bottom-controls'
    const maybeBottomControlsElement =
      document.getElementById(defaultContainerId)
    if (maybeBottomControlsElement == null) {
      throw new EvalError(
        `No container element provided and the of ${defaultContainerId} does not exist on the DOM`
      )
    }
    const bottomControlsElement = maybeBottomControlsElement
    containerElement = bottomControlsElement
  }
  containerElement.appendChild(labelElement)

  return labelElement
}
