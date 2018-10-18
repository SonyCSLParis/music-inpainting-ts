import * as $ from "jquery";
import createActivityDetector from 'activity-detector';

import "trip.js/dist/trip.css";

var Trip = require('trip.js');

let noteboxHelp_german: string = "Tippen Sie auf die <b>blauen Kästen</b> des \
Notenblattes, um die darunter liegenden Teile der Partitur neu <b>generieren</b> zu lassen"
let noteboxHelp_english: string = "Touch the <b>blue boxes</b> to trigger a \
<b>regeneration</b> of the underlying portion of the score"

let fermataboxHelp_german: string = 'Tippen Sie auf die <b>gestrichelten Kästchen</b>, um \
eine <b>Fermata</b> zu setzen. Damit kann die Struktur des Chorales kontrolliert werden';
let fermataboxHelp_english: string = 'Touch the <b>dotted boxes</b> to position an intermediate <b>fermata</b>. It allows to structure the chorale'

function makeHTMLContent(german: string, english: string) {
    return `${german}<br><br><i>${english}</i><br><br>`
}

// TODO contents should depend on AnnotationBox type used
const tripContents: object[] = [
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
    ]

const tripDelay_ms: number = 10000;

const totalTripDuration_ms: number = tripDelay_ms * tripContents.length;

const trip = new Trip(tripContents,
    {
        showSteps: true,
        onStart: initHideOnClickOutside,
        onEnd: removeClickListener,
        onTripStop: removeClickListener,
        overlayZIndex: 0,
        nextLabel: '→',
        prevLabel: '←',
        skipLabel: '',
        finishLabel: 'x',
        tripTheme: 'white',
        showNavigation : true,
        // showCloseBox : true,
        delay : 10000,
  }
);

let tripLoopInterval: any;

function startTripLoop() {
    // starts the help tour in a looping fashion

    function intervalTripLoop() {
        tripLoopInterval = setInterval(() => {
            // if (looping) {
                trip.start();
            // }
        },
        totalTripDuration_ms + 500)
    }
    trip.start();
    intervalTripLoop();
}

function stopTripLoop() {
    // stops the help tour from looping
    clearInterval(tripLoopInterval);
}


function outsideClickListener(event) {
    let target: HTMLElement = event.target;
    if (!$(target).closest($('div.trip-block')).length) {
        stopTripLoop();
        trip.stop();
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

export function registerIdleStateDetector(): void {
    const activityDetector = createActivityDetector({
        timeToIdle: 2 * 1000 * 60,  // launch after 2 minutes of inactivity
        autoInit: true,
        inactivityEvents: [],
    });

    activityDetector.on('idle', () => {
    	console.log('The user is not interacting with the page');
        startTripLoop();
    });

    activityDetector.on('active', () => {
        console.log('The user is interacting with the page');
        stopTripLoop();
    })
}

if (module.hot) {}
