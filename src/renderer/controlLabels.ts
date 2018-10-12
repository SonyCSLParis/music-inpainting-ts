

export function createLabel(controlElem: HTMLElement,
    id: string,
    labelContent_main: string,
    labelContent_secondary: string,
    ) {
    let labelElem: HTMLElement = document.createElement('control-item');
    labelElem.id = id;
    labelElem.innerHTML = `<b>${labelContent_main}</b><br><i>${labelContent_secondary}</i>`;

    let bottomControlsElem: HTMLElement = document.getElementById(
        'bottom-controls');
    bottomControlsElem.appendChild(labelElem);
}
