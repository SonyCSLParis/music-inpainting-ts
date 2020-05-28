let configuration = require('../common/default_config.json');
let localizations = require('../common/localization.json');

export function createLabel(controlElem: HTMLElement, id: string) {
    let labelElem: HTMLElement = document.createElement('control-item');
    labelElem.id = id;
    let controlLabel: string = `<b>${
        localizations['control-labels'][id][configuration["main_language"]]}</b>`;
    const secondary_language = configuration["secondary_language"];
    if (secondary_language && !(secondary_language === "")) {
        controlLabel.concat(`<br><i>${localizations['control-labels'][id][secondary_language]}</i>`)
    }
    labelElem.innerHTML = controlLabel;

    let bottomControlsElem: HTMLElement = document.getElementById(
        'bottom-controls');
    bottomControlsElem.appendChild(labelElem);
}
