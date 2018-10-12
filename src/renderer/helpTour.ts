import * as $ from "jquery";

import "trip.js/dist/trip.css";

var Trip = require('trip.js');

let noteboxHelp_german: string = "Tippe auf die <b>blauen Kästen</b> des \
Notenblattes, um die darunter liegenden Teile der Partitur neu <b>generieren</b> zu lassen"
let noteboxHelp_english: string = "Touch the <b>blue boxes</b> to trigger a \
<b>regeneration</b> of the underlying portion of the score"

let fermataboxHelp_german: string = 'Tippe auf die <b>gestrichelten Kästchen</b>, um \
<b>Fermatas</b> ein- und auszuschalten';
let fermataboxHelp_english: string = 'Touch the <b>dotted boxes</b> to impose or remove <b>fermatas</b>'

function makeHTMLContent(german: string, english: string) {
    return `${german}<br><br><i>${english}</i><br><br>`
}

let trip = new Trip([
        // div[id$='-note-0-0']
        { sel: "#whole-note-0-0-common",
          content: makeHTMLContent(noteboxHelp_german, noteboxHelp_english),
          position : "e",
            // expose: true
        },
        { sel: "#quarter-note-3-0-common-Fermata",
          content: makeHTMLContent(fermataboxHelp_german, fermataboxHelp_english),
          position : "s",
            // expose: true,
        },
        // { sel: '#app-title', content: "Press play to listen to the generated music!",
        //     position: 'n'}
    ],
    {
        showSteps: true,
        onTripStart: initHideOnClickOutside,
        onTripEnd: removeClickListener,
        onTripStop: removeClickListener,
        overlayZIndex: 0,
        nextLabel: '→',
        prevLabel: '←',
        skipLabel: '',
        finishLabel: '',
        tripTheme: 'white',
        showNavigation : true,
        // showCloseBox : true,
        delay : 10000,
  }
);

function outsideClickListener(event) {
    let target: HTMLElement = event.target
    if (!$(target).closest($('div.trip-block')).length) {
        trip.stop()
    }
};

 function initHideOnClickOutside() {
     // Attach an event listener to the whole document that detects clicks
     // out of the containing div and closes the selector in that case
     // Bind this callback when the selector is activated and unbind it when
     // it is closed

     // must add a delay so that the initial click is
     // setTimeout(() => {
        document.addEventListener('click', outsideClickListener);
     // },
     // 100);
 };

 function removeClickListener() {
     document.removeEventListener('click', outsideClickListener)
 };

export function render(containerElement: HTMLElement) {
    let helpElem: HTMLAnchorElement = document.createElement('a');
    containerElement.appendChild(helpElem);

    helpElem.id = 'help-icon';
    helpElem.textContent = 'Help';

    helpElem.addEventListener('click', function(event) {
        // stops event from trigerring outsideClickListener registered onTripStart
        event.stopPropagation();

        trip.start()
    }, true);
}
// function tourManagerCallback(): void {
// }

if (module.hot) {}
