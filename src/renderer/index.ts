// import * as nipplejs from "nipplejs";
import { eOSMD } from './locator';
import { Fraction } from 'opensheetmusicdisplay';
import * as $ from "jquery";
import * as WebMidi from 'webmidi';
import * as MidiConvert from "midiconvert";
import * as Tone from 'tone';
import * as log from 'loglevel';
import * as path from 'path';
let Nexus = require('./nexusColored');

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
import CycleSelect from './cycleSelect';
import { static_correct} from './staticPath';
import * as ControlLabels from './controlLabels';

import 'simplebar';
import 'simplebar/packages/simplebar/src/simplebar.css';

import '../common/styles/osmd.scss'
import '../common/styles/main.scss'
import '../common/styles/controls.scss'

let COMPILE_MUSEUM_VERSION: boolean = true;
if ( COMPILE_MUSEUM_VERSION ) {
    require('../common/styles/museum.scss');
}

// set to true to display the help tour after two minutes of inactivity on the
// interface
let REGISTER_IDLE_STATE_DETECTOR: boolean = false;
if ( DISABLE_MOUSE ) {
    require('../common/styles/disableMouse.scss');
}

declare var ohSnap: any;
let server_config = require('../common/config.json')

let useAdvancedControls: boolean = false;

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

    ControlLabels.createLabel(playbuttonContainerElem, 'play-button-label',
        'Partitur abspielen', 'Score playback');

    PlaybackCommands.render(playbuttonContainerElem)
});

$(() => {renderGranularitySelect()});

// Time-granularity selector
function renderGranularitySelect(): void {
    let iconsBasePath: string = path.join(static_correct, 'icons');
    let granularityIcons: Map<string, string> = new Map([
        ['quarter-note', 'quarter-note.svg'],
        ['half-note', 'half-note.svg'],
        ['whole-note', 'whole.svg']
    ])

    let granularitySelectContainerElem: HTMLElement = document.createElement('control-item');
    granularitySelectContainerElem.id = 'granularity-select-container';
    bottomControlsGridElem.appendChild(granularitySelectContainerElem);

    ControlLabels.createLabel(granularitySelectContainerElem,
        'granularity-select-label',
        'Rekompositionsdauer ändern', 'Change generation duration');

    function granularityOnChange(ev) {
        $('.notebox').removeClass('active');
        $('.' + this.value + '> .notebox').addClass('active');
    };

    let granularitySelect = new CycleSelect(granularitySelectContainerElem,
        'granularity-select',
        {handleEvent: granularityOnChange},
        granularityIcons,
        iconsBasePath
    );
    granularitySelect.value = 'whole-note';
}

let insertLFO: boolean = false;
if (insertLFO) {
    createLFOControls();
}

let titlediv: HTMLDivElement = document.createElement('div')
titlediv.textContent = 'DeepBach'
titlediv.style.alignContent = 'CenterTop'
titlediv.style.width = '100%'
titlediv.style.fontStyle = 'bold'
titlediv.style.fontSize = '64px'

let useLeadsheetMode = false;  // true for leadsheets, false for chorales
let serverPort: number;
if (useLeadsheetMode) {
    serverPort = server_config['leadsheet_port'];
} else {
    serverPort = server_config['chorale_port'];
}
let serverIp: string;
let useLocalServer: boolean = true;
if (useLocalServer) {
    serverIp = 'localhost';
}
else {
    serverIp = server_config['server_ip'];
}
let serverUrl = `http://${serverIp}:${serverPort}/`;

let osmd: eOSMD;

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

let allowOnlyOneFermata: boolean = true;
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
        useLeadsheetMode,
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
//     loadMusicXMLandMidi(serverUrl + argsGenerationUrl,
//         serverUrl + argsMidiUrl);
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
        leadsheet: osmd.isLeadsheet,
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


/**
 * Load a MusicXml file via xhttp request, and display its contents.
 */
function loadMusicXMLandMidi(serverURL: string, generationCommand: string) {
    return new Promise((resolve, _) => {
        disableChanges();

        log.trace('Metadata:');
        log.trace(JSON.stringify(getMetadata()));

        let sequenceDuration_toneTime: Tone.Time;
        $.post({
            url: serverURL + generationCommand,
            data: JSON.stringify(getMetadata()),
            contentType: 'application/json',
            dataType: 'xml',
            success: (xmldata: XMLDocument) => {
                removeMusicXMLHeaderNodes(xmldata);
                osmd.load(xmldata)
                .then(
                    () => {
                        osmd.render(onClickTimestampBoxFactory);
                        enableChanges();
                    },
                    (err) => {log.error(err); enableChanges()}
                );
            }
        }).done(() => {
            $.getJSON(serverURL + 'get-sequence-duration',
            (sequenceDuration: object) => {
                let numMeasures = sequenceDuration['numMeasures']
                let numQuarters = sequenceDuration['numQuarters']
                let numSixteenth = sequenceDuration['numSixteenth']
                sequenceDuration_toneTime = Tone.Time(
                    `${numMeasures}:${numQuarters}:${numSixteenth}`);

                Playback.loadMidi(serverURL + 'get-midi',
                    sequenceDuration_toneTime);
                resolve();
                }
            )
        })

    })
};

$(() => {
    const instrumentsGridElem = document.createElement('div');
    instrumentsGridElem.id = 'instruments-grid';
    instrumentsGridElem.classList.add('two-columns');
    bottomControlsGridElem.appendChild(instrumentsGridElem);

    ControlLabels.createLabel(instrumentsGridElem, 'instruments-grid-label',
        'Instrument ändern', 'Change instrument');

    Instruments.renderInstrumentSelect(instrumentsGridElem);
    if ( useLeadsheetMode ) {
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


import { createWavInput } from './file_upload'
let insertWavInput: boolean = false;
if (insertWavInput) {
    createWavInput(() => loadMusicXMLandMidi(serverUrl, 'get-musicxml'))
};

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
    // Insert help-tour
    // HelpTour.render();
}
);

if (module.hot) { }
