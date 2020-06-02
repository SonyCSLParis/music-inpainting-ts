import * as Path from 'path';
import * as screenfull from 'screenfull';

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


export function render(containerElement: HTMLElement, configuration) {
    let logoLinkElem = document.createElement('div');
    logoLinkElem.id = 'csl-logo';
    logoLinkElem.classList.add('header-item-left');
    // logoLinkElem.href = "https://www.sonycsl.co.jp/";
    //
    // // open in new tab
    // logoLinkElem.target = '_blank';
    // // securely open tab, cf. https://stackoverflow.com/a/15551842
    // logoLinkElem.rel = "noopener noreferrer";

    containerElement.appendChild(logoLinkElem);

    let logoElem = document.createElement('img');
    logoElem.src = Path.join(static_correct, '/icons/sonycsl-logo.svg');
    logoElem.alt = 'Sony CSL Logo';
    logoLinkElem.appendChild(logoElem);

    logoElem.addEventListener('click', () => {
        if (screenfull.isEnabled) {
            screenfull.request();
        }
    });

    let nameElem: HTMLElement = document.createElement('div');
    nameElem.id = 'app-title';
    nameElem.innerText = configuration['app_name'];

    containerElement.appendChild(nameElem);


    if ( configuration['add_acids_logo'] ) {
        let acidsLogoLinkElem = document.createElement('div');
        acidsLogoLinkElem.id = 'acids-logo';
        acidsLogoLinkElem.classList.add('header-item-right');

        containerElement.appendChild(acidsLogoLinkElem);

        let acidsLogoElem = document.createElement('img');
        acidsLogoElem.src = Path.join(static_correct, '/icons/acids-flat-logo.png');
        acidsLogoElem.alt = 'ACIDS Team Logo';
        acidsLogoLinkElem.appendChild(acidsLogoElem);
    }



    if (configuration["insert_help"]) {
        HelpTour.render(containerElement);
    }
}

if (module.hot) {}
