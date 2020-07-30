const configuration = require('../common/default_config.json');
const localizations = require('../common/localization.json');

export function createLabel(controlElem: HTMLElement, id: string,
        isAdvancedControl: boolean = false) {
    let labelElem: HTMLElement = document.createElement('control-label');
    labelElem.id = id;
    let controlLabel: string = `${
        localizations['control-labels'][id][configuration["main_language"]]}`;
    const secondary_language = configuration["secondary_language"];
    if (secondary_language && !(secondary_language === "")) {
        controlLabel.concat(`<br><i>${localizations['control-labels'][id][secondary_language]}</i>`)
    }
    labelElem.innerHTML = controlLabel;
    labelElem.classList.toggle('advanced', isAdvancedControl);

    let bottomControlsElem: HTMLElement = document.getElementById(
        'bottom-controls');
    bottomControlsElem.appendChild(labelElem);
}
