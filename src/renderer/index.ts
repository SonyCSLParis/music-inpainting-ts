// import * as nipplejs from "nipplejs";
import { eOSMD, renderZoomControls } from './locator';
import { Fraction } from 'opensheetmusicdisplay';
import * as $ from "jquery";
import * as WebMidi from 'webmidi';
import * as MidiConvert from "midiconvert";
import * as Tone from 'tone';
import * as log from 'loglevel';
import * as path from 'path';
let Nexus = require('./nexusColored');
import * as url from 'url';

import * as Header from './header';
import * as PlaybackCommands from './playbackCommands';
import * as Playback from './playback';
import * as Instruments from './instruments';
import * as BPM from './bpm';
import LinkClient from './linkClient';
import * as LinkClientCommands from './linkClientCommands';
import * as MidiOut from './midiOut';
import * as HelpTour from './helpTour';
import { createLFOControls } from './lfo';
import { CycleSelect } from './cycleSelect';
import { static_correct} from './staticPath';
import * as ControlLabels from './controlLabels';
import * as GranularitySelect from './granularitySelect';
import { createWavInput } from './file_upload';

import 'simplebar';
import 'simplebar/packages/simplebar/src/simplebar.css';

import '../common/styles/osmd.scss';
import '../common/styles/main.scss';
import '../common/styles/controls.scss';
import '../common/styles/disableMouse.scss';

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;

let configuration = require('../common/config.json');

const granularities_quarters: string[] = (
    (<string[]>configuration['granularities_quarters']).sort(
        (a, b) => {return parseInt(a) - parseInt(b)}));

let COMPILE_MUSEUM_VERSION: boolean = true;

if ( COMPILE_MUSEUM_VERSION ) {
    require('../common/styles/museum.scss');

    if (COMPILE_ELECTRON) {
        var webFrame = require('electron').webFrame;
        webFrame.setVisualZoomLevelLimits(1, 1);
        webFrame.setLayoutZoomLevelLimits(0, 0);
    }
}

// set to true to display the help tour after two minutes of inactivity on the
// interface
let REGISTER_IDLE_STATE_DETECTOR: boolean = configuration["display_help_on_idle"];

// set to true to completely hide the mouse pointer on the interface
// for touchscreens
let DISABLE_MOUSE: boolean = configuration['disable_mouse'];
if ( DISABLE_MOUSE ) {
    document.body.classList.add('disable-mouse');
}

declare var ohSnap: any;

let useAdvancedControls: boolean = configuration['insert_advanced_controls'];
if (useAdvancedControls) {
    document.body.classList.add('advanced-controls');
}

// Tone.context.latencyHint = 'playback';

$(() => {
    let headerGridElem: HTMLElement = document.createElement('header');
    document.body.appendChild(headerGridElem);
    Header.render(headerGridElem);
})

let bottomControlsGridElem: HTMLDivElement;

$(() => {
    bottomControlsGridElem = document.createElement('div');
    bottomControlsGridElem.id = 'bottom-controls';
    document.body.appendChild(bottomControlsGridElem);
});

$(() => {
    let playbuttonContainerElem: HTMLElement = document.createElement('control-item');
    playbuttonContainerElem.id = 'play-button';

    bottomControlsGridElem.appendChild(playbuttonContainerElem);

    ControlLabels.createLabel(playbuttonContainerElem, 'play-button-label');

    PlaybackCommands.render(playbuttonContainerElem);
});


$(() => {
    GranularitySelect.renderGranularitySelect(bottomControlsGridElem,
        granularities_quarters);
});


$(() => {
    let insertLFO: boolean = configuration["insert_variations_lfo"];
    if (insertLFO) {
        createLFOControls();
    }
});


let serverPort: number = configuration['server_port'];
let serverIp: string;
let useLocalServer: boolean = configuration["use_local_server"];
if (useLocalServer) {
    serverIp = 'localhost';
}
else {
    serverIp = configuration['server_ip'];
}
let serverUrl = `http://${serverIp}:${serverPort}/`;


function insertLoadingSpinner(container: HTMLElement): HTMLElement {
    let spinnerElem: HTMLElement = document.createElement('i');
    container.appendChild(spinnerElem);
    spinnerElem.classList.add('fas');
    spinnerElem.classList.add('fa-4x');
    spinnerElem.style.color = 'black';
    spinnerElem.classList.add('fa-spin');
    spinnerElem.classList.add('fa-cog');
    spinnerElem.id = 'osmd-loading-spinner';

    return spinnerElem
}

let osmd: eOSMD;

let allowOnlyOneFermata: boolean = configuration['allow_only_one_fermata'];
/*
 * Create a container element for OpenSheetMusicDisplay...
 */
let osmdContainer: HTMLElement;
$(() => {
    let osmdContainerContainerContainer = <HTMLElement>document.createElement("div");
    osmdContainerContainerContainer.id = 'osmd-container-container-container';
    osmdContainerContainerContainer.classList.add('loading');
    osmdContainerContainerContainer.setAttribute('data-simplebar', "");
    osmdContainerContainerContainer.setAttribute('data-simplebar-auto-hide', "false");
    document.body.appendChild(osmdContainerContainerContainer);

    let spinnerElem = insertLoadingSpinner(osmdContainerContainerContainer);

    let osmdContainerContainer = <HTMLElement>document.createElement("div");
    osmdContainerContainer.id = 'osmd-container-container';
    osmdContainerContainerContainer.appendChild(osmdContainerContainer);
    osmdContainer = <HTMLElement>document.createElement("div");
    osmdContainer.id = 'osmd-container';
    /*
    * ... and attach it to our HTML document's body. The document itself is a HTML5
    * stub created by Webpack, so you won't find any actual .html sources.
    */
    osmdContainerContainer.appendChild(osmdContainer);


    /*
    * Create a new instance of OpenSheetMusicDisplay and tell it to draw inside
    * the container we've created in the steps before. The second parameter tells OSMD
    * not to redraw on resize.
    */

    let autoResize: boolean = true;
    osmd = new eOSMD(osmdContainer,
        {autoResize: autoResize,
         drawingParameters: "compact",
         drawPartNames: false
        },
        granularities_quarters.map((num) => {return parseInt(num, 10);}),
        configuration['annotation_types'],
        allowOnlyOneFermata);
    loadMusicXMLandMidi(serverUrl, 'generate').then(
        () => {
            spinnerElem.style.visibility = 'hidden';
            osmdContainerContainerContainer.classList.remove('loading');
            if ( REGISTER_IDLE_STATE_DETECTOR ) {
                HelpTour.registerIdleStateDetector();
            }
        });
})

// var options = {
//     zone: osmd.renderingBackend.getInnerElement(),
//     color: "blue"
// };
// var manager = nipplejs.create(options);
// var joystick_data: {};
// var last_click = [];
//
// manager.on('start', function(event: Event, joystick) {
//     disableChanges();
// })
//
// manager.on('end', function(event: Event, joystick) {
//     // console.log(joystick_data);
//     // console.log(osmd.boundingBoxes);
//     let clickedDiv = event.target; // FIXME
//     // console.log(clickedDiv);
//     let measureIndex = findMeasureIndex(last_click);
//     // console.log(measureIndex);
//
//     let argsGenerationUrl = ("one-measure-change" +
//         ('?measureIndex=' + measureIndex)
//     );
//     let argsMidiUrl = "get-midi";
//
//     //    url += '?choraleIndex=' + choraleIndex;
//     loadMusicXMLandMidi(url.resolve(serverUrl, argsGenerationUrl),
//         url.resolve(serverUrl, argsMidiUrl));
//     enableChanges();
// }, true);
//
// manager.on('move', function(evt, joystick) {
//     joystick_data = joystick;
//     last_click = joystick.position;
// }, true);


function removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): void{
    // Strip MusicXML document of title/composer tags
    let titleNode = xmlDocument.getElementsByTagName('work-title')[0];
    let movementTitleNode = xmlDocument.getElementsByTagName('movement-title')[0];
    let composerNode = xmlDocument.getElementsByTagName('creator')[0];

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent = "";
}

function getFermatas(): number[] {
    const activeFermataElems = $('.Fermata.active')
    let containedQuarterNotesList = [];
    for (let activeFemataElem of activeFermataElems) {
        containedQuarterNotesList.push(parseInt(
            activeFemataElem.parentElement.getAttribute('containedQuarterNotes')));
    }
    return containedQuarterNotesList;
}

function getChordLabels(): object[] {
    // return a stringified JSON object describing the current chords
    let chordLabels = [];
    for (let chordSelector of osmd.chordSelectors) {
        chordLabels.push(chordSelector.currentChord);
    };
    return chordLabels;
};

function getMetadata() {
    return {
        fermatas: getFermatas(),
        chordLabels: getChordLabels()
    }
}


function onClickTimestampBoxFactory(timeStart: Fraction, timeEnd: Fraction) {
    const [timeRangeStart_quarter, timeRangeEnd_quarter] = ([timeStart, timeEnd].map(
        timeFrac => Math.round(4 * timeFrac.RealValue)))

    const argsGenerationUrl = ("timerange-change" +
        `?time_range_start_quarter=${timeRangeStart_quarter}` +
        `&time_range_end_quarter=${timeRangeEnd_quarter}`
    );

    return (function (this, _) {
        loadMusicXMLandMidi(serverUrl, argsGenerationUrl);
    ;})
}


function toggleBusyClass(toggleBusy: boolean): void {
    let noteboxes = $('.notebox')
    if (toggleBusy) {
        noteboxes.addClass('busy');
        noteboxes.removeClass('available');
    }
    else {
        noteboxes.removeClass('busy');
        noteboxes.addClass('available');
    }
}


function blockall(e) {
    // block propagation of events in bubbling/capturing
    e.stopPropagation();
    e.preventDefault();
}


function disableChanges(): void {
    toggleBusyClass(true);
    $('.timecontainer').addClass('busy');
    $('.timecontainer').each(function() {
        this.addEventListener("click", blockall, true);}
    )
}


function enableChanges(): void {
    $('.timecontainer').each(function() {
        this.removeEventListener("click", blockall, true);}
    )
    $('.timecontainer').removeClass('busy');
    toggleBusyClass(false);
}

// TODO don't create globals like this
const serializer = new XMLSerializer();
const parser = new DOMParser();
let currentXML: XMLDocument;

/**
 * Load a MusicXml file via xhttp request, and display its contents.
 */
function loadMusicXMLandMidi(serverURL: string, generationCommand: string) {
    return new Promise((resolve, _) => {
        disableChanges();

        let payload_object = getMetadata();

        log.trace('Metadata:');
        log.trace(JSON.stringify(getMetadata()));

        if (!generationCommand.includes('generate')) {
            payload_object['sheet'] = serializer.serializeToString(currentXML);
        }

        // register minimal error handler
        $(document).ajaxError((error) => console.log(error));

        $.post({
            url: url.resolve(serverURL, generationCommand),
            data: JSON.stringify(payload_object),
            contentType: 'application/json',
            dataType: 'json',
            success: (jsonResponse: {}) => {
                // update metadata
                // TODO: must check if json HAS the given metadata key first!
                // const new_fermatas = jsonResponse["fermatas"];
                if (!generationCommand.includes('generate')) {
                    // TODO updateFermatas(newFermatas);
                }

                // load the received MusicXML
                const xml_sheet_string = jsonResponse["sheet"];
                let xmldata = parser.parseFromString(xml_sheet_string,
                    "text/xml");
                removeMusicXMLHeaderNodes(xmldata);
                currentXML = xmldata;

                // save current zoom level to restore it after load
                const zoom = osmd.zoom;
                osmd.load(currentXML).then(
                    () => {
                        // restore pre-load zoom level
                        osmd.zoom = zoom;
                        osmd.render(onClickTimestampBoxFactory);
                        enableChanges();

                        console.log(currentXML);
                        resolve();

                        Playback.loadMidi(url.resolve(serverURL, '/musicxml-to-midi'),
                            currentXML,
                            Tone.Time(`0:${osmd.sequenceDuration_quarters}:0`)
                        );
                    },
                    (err) => {log.error(err); enableChanges()}
                );
            }
        }).done(() => {
        })

    })
};

$(() => {
    const instrumentsGridElem = document.createElement('div');
    instrumentsGridElem.id = 'instruments-grid';
    instrumentsGridElem.classList.add('two-columns');
    bottomControlsGridElem.appendChild(instrumentsGridElem);

    ControlLabels.createLabel(instrumentsGridElem, 'instruments-grid-label');

    Instruments.renderInstrumentSelect(instrumentsGridElem);
    if ( configuration['use_chords_instrument'] ) {
        Instruments.renderChordInstrumentSelect(instrumentsGridElem);
    }
    Instruments.renderDownloadButton(instrumentsGridElem);
    }
);

$(() => {
    let useSimpleSlider: boolean = !useAdvancedControls;
    BPM.render(useSimpleSlider);
    // set the initial tempo for the app
    // if (LinkClient.isEnabled()) {
    // // if Link is enabled, use the Link tempo
    //     LinkClient.setBPMtoLinkBPM_async();
    // }
    // else
    { BPM.setBPM(110); }
});

$(() => {
    let insertWavInput: boolean = configuration['insert_wav_input'];
    if (insertWavInput) {
        createWavInput(() => loadMusicXMLandMidi(serverUrl, 'get-musicxml'))
}});


$(() => {
    LinkClient.kill();
    if (useAdvancedControls) {
        // Insert LINK client controls
        LinkClientCommands.render();
        LinkClientCommands.renderDownbeatDisplay();
    }}
);

$(() => {
    if (useAdvancedControls) {
        // Add MIDI-out selector
        MidiOut.render();
    }}
);

$(() => {
    // Insert zoom controls
    const zoomControlsGridElem = document.createElement('div');
    zoomControlsGridElem.id = 'osmd-zoom-controls';
    // zoomControlsGridElem.classList.add('two-columns');
    const osmdContainerContainerContainer = document.getElementById(
        "osmd-container-container-container");
    osmdContainerContainerContainer.appendChild(zoomControlsGridElem);
    renderZoomControls(zoomControlsGridElem, osmd);
}
);

if (module.hot) { }
