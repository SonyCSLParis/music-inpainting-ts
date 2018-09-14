import * as Path from 'path';

import '../common/styles/main.scss';

import { static_correct } from './staticPath';

import * as HelpTour from './helpTour';

declare var COMPILE_ELECTRON: boolean;
if (COMPILE_ELECTRON) {
    var shell = require('electron').shell;

    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(this: HTMLAnchorElement, event) {
        event.preventDefault();
        shell.openExternal(this.href);
    });
}


export function render(containerElement: HTMLElement) {
    let logoLinkElem = document.createElement('a');
    logoLinkElem.id = 'csl-logo-elem';
    logoLinkElem.classList.add('header-item-left');
    logoLinkElem.href = "https://www.sonycsl.co.jp/";

    // open in new tab
    logoLinkElem.target = '_blank';
    // securely open tab, cf. https://stackoverflow.com/a/15551842
    logoLinkElem.rel = "noopener noreferrer";

    containerElement.appendChild(logoLinkElem);

    let logoElem = document.createElement('img');
    logoElem.src = Path.join(static_correct, '/icons/sonycsl-logo.svg');
    logoElem.alt = 'Sony CSL Logo';
    logoLinkElem.appendChild(logoElem);

    let nameElem: HTMLElement = document.createElement('div');
    nameElem.id = 'app-title';
    nameElem.innerText = 'DeepBach';
    containerElement.appendChild(nameElem);

    HelpTour.render(containerElement);
}

if (module.hot) {}