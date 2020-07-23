import $ from "jquery";
import createActivityDetector from 'activity-detector';

import "trip.js/dist/trip.css";
import '../common/styles/helpTour.scss';

var Trip = require('trip.js');

const localizations = require('../common/localization.json');
const helpContents = localizations["help"];


// TODO move helpTour to localizations file
let noteboxHelp_german: string = "Tippen Sie auf die <b>blauen Kästen</b> des \
Notenblattes, um die darunter liegenden Teile der Partitur neu <b>generieren</b> zu lassen"
let noteboxHelp_english: string = "Touch the <b>blue boxes</b> to trigger a \
<b>regeneration</b> of the underlying portion of the score"

let fermataboxHelp_german: string = 'Tippen Sie auf die <b>gestrichelten Kästchen</b>, um \
eine <b>Fermata</b> zu setzen. Damit kann die Struktur des Chorales kontrolliert werden';
let fermataboxHelp_english: string = 'Touch the <b>dotted boxes</b> to position an intermediate <b>fermata</b>. It allows to structure the chorale'

function makeMultilingualHTMLContent(contents: object, languages: string[]) {
    switch (languages.length) {
        case 2:
            return `${contents[languages[0]]}<br><br><i>${contents[languages[1]]}</i><br><br>`
        case 1:
            return `${contents[languages[0]]}<br><br>`
        default:
            throw new Error("Unexpected number of languages to use, either 1 or 2 simultaneous languages are supported.");
    }
}

// TODO contents should depend on AnnotationBox type used
// const tripContents_nonoto: object[] = [
//         // div[id$='-note-0-0']
//         {
//             sel: "#whole-note-0-0-common",
//             content: makeMultilingualHTMLContent(noteboxHelp_german, noteboxHelp_english),
//             position : "e",
//             // expose: true
//         },
//         {
//             sel: "#quarter-note-1-3-common-Fermata",
//             content: makeMultilingualHTMLContent(fermataboxHelp_german, fermataboxHelp_english),
//             position : "s",
//             // expose: true,
//         },
//         // { sel: '#app-title', content: "Press play to listen to the generated music!",
//         //     position: 'n'}
//     ]

function makeMultilingualTripContents_notono(languages: string[]): object[] {
    return [
        {
            sel: "#spectrogram-container-shadow-container",
            content: makeMultilingualHTMLContent(helpContents["notono"]["spectrogram_interaction"],
                languages),
            position : "s",
            expose: true
        },
        {
            sel: "#constraints-gridspan",
            content: makeMultilingualHTMLContent(helpContents["notono"]["constraints"],
                languages),
            position : "n",
            expose: true
        },
        {
            sel: "#edit-tools-gridspan",
            content: makeMultilingualHTMLContent(helpContents["notono"]["edit_tools"],
                languages),
            position : "n",
            expose: true
        },
    ]
}

const tripDelay_ms: number = 10000;

function getTotalTripDuration_ms(tripContents: object[]): number {
    return tripDelay_ms * tripContents.length;
}

const tripOptions = {
    showSteps: true,
    // onStart: initHideOnClickOutside,
    // onEnd: removeClickListener,
    // onTripStop: removeClickListener,
    overlayZIndex: 100,
    nextLabel: '→',
    prevLabel: '←',
    skipLabel: '',
    finishLabel: 'x',
    tripTheme: 'white',
    showNavigation : true,
    // showCloseBox : true,
    delay : 10000,
};

export const trip = new Trip(makeMultilingualTripContents_notono(["en"]), tripOptions);

let tripLoopInterval: any;

function startTripLoop(trip: typeof Trip) {
    // starts the help tour in a looping fashion

    function intervalTripLoop() {
        tripLoopInterval = setInterval(() => {
            // if (looping) {
                trip.start();
            // }
        },
        getTotalTripDuration_ms(trip.tripData) + 500)
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
    helpElem.title = 'Help';

    helpElem.addEventListener('click', function(event) {
        // stops event from trigerring outsideClickListener registered onTripStart
        event.stopPropagation();

        trip.start()
    }, true);
}

export function registerIdleStateDetector(trip: typeof Trip): void {
    const activityDetector = createActivityDetector({
        timeToIdle: 2 * 1000 * 60,  // launch after 2 minutes of inactivity
        autoInit: true,
        inactivityEvents: [],
    });

    activityDetector.on('idle', () => {
        console.log('The user is not interacting with the page');
        startTripLoop(trip);
    });

    activityDetector.on('active', () => {
        console.log('The user is interacting with the page');
        stopTripLoop();
    })
}

if (module.hot) {}
