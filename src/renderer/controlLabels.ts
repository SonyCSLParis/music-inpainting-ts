const configuration = require('../common/default_config.json');
const localizations = require('../common/localization.json');

export function createLabel(controlElem: HTMLElement, id: string,
        isAdvancedControl: boolean = false,
        localizationId: string | null = null,
        containerElement: HTMLElement = null) {
    let labelElem: HTMLElement = document.createElement('control-label');
    labelElem.id = id;
    if ( localizationId == null ) {
        localizationId = id;
    }
    let controlLabel: string = `${
        localizations['control-labels'][localizationId][configuration["main_language"]]}`;
    const secondary_language = configuration["secondary_language"];
    if (secondary_language && !(secondary_language === "")) {
        controlLabel.concat(`<br><i>${localizations['control-labels'][localizationId][secondary_language]}</i>`)
    }
    labelElem.innerHTML = controlLabel;
    labelElem.classList.toggle('advanced', isAdvancedControl);

    if ( containerElement === null ) {
        const bottomControlsElem: HTMLElement = document.getElementById(
            'bottom-controls');
        containerElement = bottomControlsElem
    }
    containerElement.appendChild(labelElem);
}
