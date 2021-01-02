import $ from "jquery";
import createActivityDetector from 'activity-detector';
import { SpectrogramLocator, Locator } from "./locator";

import "trip.js/dist/trip.css";
import '../common/styles/helpTour.scss';

var Trip = require('trip.js');

const localizations = require('../common/localization.json');
const helpContents = localizations["help"];


export abstract class myTrip {
    protected trip: typeof Trip;
    protected languages: string[];
    readonly locator: Locator;
    protected tripDelay_ms: number = 10000;
    // launches help tour automatically after two minutes of idle state
    readonly inactivityDetectorDelay: number = 2 * 1000 * 60;

    constructor(languages: string[], locator: Locator, inactivityDetectorDelay?: number) {
        this.languages = languages;
        this.locator = locator;
        this.inactivityDetectorDelay = inactivityDetectorDelay;

        const tripContents = this.makeContents();
        this.trip = new Trip(tripContents, this.tripOptions);

        if (!(this.inactivityDetectorDelay === null)) {
            this.registerIdleStateDetector();
        }

        const oldRun = this.trip.run.bind(this.trip);
        this.trip.run = (function() {
            // pushes the <footer> element as last child of the body so as not to
            // disrupt layout, since Trip.start() always recreates the .trip-block element
            // and appends it to the body prior to calling Trip.run()
            $('body').append($('footer'));
            oldRun();
        }).bind(this.trip);
    }

    public start(): void {
        document.body.classList.add('help-tour-on');
        document.body.classList.add('advanced-controls');
        this.locator.refresh();

        $(() => {this.trip.start()});
    }

    protected tripOptions = {
        showSteps: true,
        // onStart: initHideOnClickOutside,
        // onEnd: removeClickListener,
        // onTripStop: removeClickListener,
        overlayZIndex: 100,
        nextLabel: '→',
        prevLabel: '←',
        skipLabel: '',
        finishLabel: 'x',
        // tripTheme: 'white',
        showNavigation : true,
        showCloseBox: true,
        showHeader: true,
        // showCloseBox : true,
        delay : this.tripDelay_ms,
        onEnd: this.tripCleanup.bind(this),
        onTripStart: (tripIndex: number, tripObject: any  // TODO(theis): add proper typing
            ) => {
            if (tripObject.expose && tripObject.hasOwnProperty('exposeContainer') ) {
                const containerElement = document.getElementById(tripObject.exposeContainer)
                this.toggleExpose(containerElement, true)
            }
        },
        onTripEnd: (tripIndex: number, tripObject: any  // TODO(theis): add proper typing
        ) => {
            if (tripObject.expose && tripObject.hasOwnProperty('exposeContainer') ) {
                const containerElement = document.getElementById(tripObject.exposeContainer)
                this.toggleExpose(containerElement, false)
            }
        },
    };

    protected abstract makeContents(): void;

    // clean-up modifications made to the DOM if the trip is exited mid-run
    protected tripCleanup(): void {
        document.body.classList.remove('help-tour-on');
        // this is needed in conjunction with position: sticky for the .trip-block
        // in order to restore the locator's full size if the viewport was resized during the trip
        this.locator.refresh();
    };

    protected toggleExpose(element: HTMLElement, force?: boolean) {
        element.classList.toggle('trip-exposed-container', force)
    }

    protected makeHTMLContent(contents: object) {
        switch (this.languages.length) {
            case 2:
                return `${contents[this.languages[0]]}<br><br><i>${contents[this.languages[1]]}</i><br><br>`
            case 1:
                return `${contents[this.languages[0]]}<br><br>`
            default:
                throw new Error("Unexpected number of languages to use, either 1 or 2 simultaneous languages are supported.");
        }
    }

    get totalTripDuration_ms(): number {
        return this.tripDelay_ms * this.trip.tripContents.length;
    }

    private loopInterval: NodeJS.Timeout;

    public startLoop(): void {
        // starts the help tour in a looping fashion
        const self = this;

        function intervalTripLoop() {
            self.loopInterval = setInterval(() => {
                // if (looping) {
                    this.trip.start();
                    // }
                },
                self.totalTripDuration_ms + 500)
            }
            self.trip.start();
            intervalTripLoop();
    }

    protected stopLoop() {
        // stops the help tour from looping
        clearInterval(this.loopInterval);
    }

    public renderIcon(containerElement: HTMLElement) {
        let helpElem: HTMLAnchorElement = document.createElement('a');
        containerElement.appendChild(helpElem);

        helpElem.id = 'help-icon';
        helpElem.title = 'Help';

        const self = this;
        helpElem.addEventListener('click', function(event) {
            // stops event from trigerring outsideClickListener registered onTripStart
            event.stopPropagation();
            self.start();
        }, true);
    }

    protected outsideClickListener(event) {
        let target: HTMLElement = event.target;
        if (!$(target).closest($('div.trip-block')).length) {
            this.stopLoop();
            this.trip.stop();
        }
    };

    protected initHideOnClickOutside() {
        // Attach an event listener to the whole document that detects clicks
        // out of the containing div and closes the selector in that case
        // Bind this callback when the selector is activated and unbind it when
        // it is closed

        // must add a delay so that the initial click is
        // setTimeout(() => {
            document.addEventListener('click', this.outsideClickListener);
            // },
            // 100);
        };

    protected removeClickListener() {
        document.removeEventListener('click', this.outsideClickListener)
    };


    public registerIdleStateDetector(): void {
        const activityDetector = createActivityDetector({
            timeToIdle: this.inactivityDetectorDelay,
            autoInit: true,
            inactivityEvents: [],
        });

        activityDetector.on('idle', () => {
            console.log('The user is not interacting with the page');
            this.startLoop();
        });

        activityDetector.on('active', () => {
            console.log('The user is interacting with the page');
            this.stopLoop();
        })
    }
}

export class NonotoTrip extends myTrip {
    protected makeContents(): object[] {
        // TODO contents should depend on AnnotationBox type used
        return [
            {
                sel: "#play-button-gridspan",
                content: this.makeHTMLContent(helpContents["general"]["play_button"]),
                position : "e",
                expose: true,
                header: "Playback"
            },
            {
                sel: "#whole-note-0-0-common",
                content: this.makeHTMLContent(helpContents["nonoto"]["note_box"]),
                position : "e",
            },
            {
                sel: "#quarter-note-1-3-common-Fermata",
                content: this.makeHTMLContent(helpContents["nonoto"]["fermata_box"]),
                position : "s",
            },
        ]
    }
}

export class NotonoTrip extends myTrip {
    readonly locator: SpectrogramLocator;

    protected makeContents(): object[] {
        return [
            {
                sel: "#play-button-gridspan",
                content: this.makeHTMLContent(helpContents["general"]["play_button"]),
                position : "e",
                header: "Playback",
                expose: true,
                exposeContainer: 'bottom-controls',
            },
            {
                sel: "#spectrogram-container-shadow-container",
                content: this.makeHTMLContent(helpContents["notono"]["spectrogram_general"]),
                position : "s",
                expose: true,
                header: "Spectrogram 1: General",
                onTripStart: () => {
                    $('#spectrogram-container-interface-container')[0].children[1].classList.add('trip-hide');
                    this.toggleExpose(document.getElementById('main-panel'), true);
                },
                onTripEnd: () => {
                    $('#spectrogram-container-interface-container')[0].children[1].classList.remove('trip-hide');
                    this.toggleExpose(document.getElementById('main-panel'), false);
                }
            },
            {
                sel: "#spectrogram-container-shadow-container",
                content: this.makeHTMLContent(helpContents["notono"]["spectrogram_interaction"]),
                position : "s",
                expose: true,
                header: "Spectrogram transformations",
                onTripStart: () => {
                    this.locator.callToAction();
                    this.toggleExpose(document.getElementById('main-panel'), true);
                },
                onTripEnd: () => {
                    this.toggleExpose(document.getElementById('main-panel'), false);
                }
            },
            {
                sel: "#constraints-gridspan",
                content: this.makeHTMLContent(helpContents["notono"]["constraints"]),
                position : "n",
                header: "Model constraints",
                expose: true,
                exposeContainer: 'bottom-controls',
            },
            {
                sel: "#edit-tools-gridspan",
                content: this.makeHTMLContent(helpContents["notono"]["edit_tools"]),
                position : "n",
                header: "Edit tools",
                expose: true,
                exposeContainer: 'bottom-controls',
            },
            {
                sel: "#download-button-gridspan",
                content: this.makeHTMLContent(helpContents["notono"]["download"]),
                position : "ne",
                header: "Downloading",
                expose: true,
                exposeContainer: 'bottom-controls',
            },
            {
                sel: "#fade-in-control-gridspan",
                content: this.makeHTMLContent(helpContents["notono"]["fade-in"]),
                position : "nw",
                header: "Declick / Fade-In",
                expose: true,
                exposeContainer: 'bottom-controls'
            },
            {
                sel: "#main-panel",
                content: this.makeHTMLContent(helpContents["notono"]["drag-n-drop"]),
                position : "screen-center",
                header: "Audio drag'n'drop",
                animation: "fadeInLeft",
                expose: true,
                exposeContainer: 'bottom-controls'
            },
            {
                sel: "#main-panel",
                content: this.makeHTMLContent(helpContents["general"]["attributions"]),
                position : "screen-center",
                header: "Acknowledgments",
            },
        ]
    }

    // clean-up modifications to the DOM if the trip is exited mid-run
    protected tripCleanup(): void {
        super.tripCleanup();

        $('#spectrogram-container-interface-container')[0].children[1].classList.remove('trip-hide');
    }
}

if (module.hot) {}
