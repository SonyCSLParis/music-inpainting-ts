import * as $ from "jquery";

import "trip.js/dist/trip.css";

var Trip = require('trip.js');

let noteboxHelp_german: string = "Tippen Sie auf die <b>blauen Kästen</b> des \
Notenblattes, um die darunter liegenden Teile der Partitur neu <b>generieren</b> zu lassen"
let noteboxHelp_english: string = "Touch the <b>blue boxes</b> to trigger a \
<b>regeneration</b> of the underlying portion of the score"

let fermataboxHelp_german: string = 'Tippen Sie auf die <b>gestrichelten Kästchen</b>, um \
eine <b>Fermata</b> zu setzen. Damit kann die Struktur des Chorales kontrolliert werden';
let fermataboxHelp_english: string = 'Touch the <b>dotted boxes</b> to position an intermediate <b>fermata</b>. It helps to structure the chorale'

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
        { sel: "#quarter-note-1-3-common-Fermata",
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
    helpElem.innerHTML = 'Hilfe / <i>Help</i>';

    helpElem.addEventListener('click', function(event) {
        // stops event from trigerring outsideClickListener registered onTripStart
        event.stopPropagation();

        trip.start()
    }, true);
}
// function tourManagerCallback(): void {
// }

if (module.hot) {}
