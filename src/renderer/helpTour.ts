export function render(containerElement: HTMLElement) {
    let helpElem: HTMLAnchorElement = document.createElement('a');
    containerElement.appendChild(helpElem);

    helpElem.id = 'help-icon';
    helpElem.textContent = 'Help';

    helpElem.addEventListener('click', tourManagerCallback)
}
function tourManagerCallback(): void {
}

if (module.hot) {}
