// import * as nipplejs from "nipplejs";
import { eOSMD, renderZoomControls, Spectrogram } from './locator';
import { Fraction } from 'opensheetmusicdisplay';
import * as $ from "jquery";
import * as WebMidi from 'webmidi';
import * as MidiConvert from "midiconvert";
import * as Tone from 'tone';
import * as log from 'loglevel';
import * as path from 'path';
let Nexus = require('./nexusColored');
import * as url from 'url';
import * as JSZIP from 'jszip';

import * as Header from './header';
import * as PlaybackCommands from './playbackCommands';
import { PlaybackManager } from './playback';
import { SheetPlaybackManager } from './sheetPlayback';
import { SpectrogramPlaybackManager } from './spectrogramPlayback';
import * as Instruments from './instruments';
import { NumberControl, BPMControl } from './numberControl';
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
import * as SplashScreen from './startup';

import 'simplebar';
import 'simplebar/packages/simplebar/src/simplebar.css';

import '../common/styles/osmd.scss';
import '../common/styles/spectrogram.scss';
import '../common/styles/main.scss';
import '../common/styles/controls.scss';
import '../common/styles/disableMouse.scss';

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;

declare var ohSnap: any;

let defaultConfiguration = require('../common/config.json');

let playbackManager: PlaybackManager;
let sheetPlaybackManager: SheetPlaybackManager;
let spectrogramPlaybackManager: SpectrogramPlaybackManager;
let bpmControl: BPMControl;
let pitchControl: NumberControl;

function render(configuration=defaultConfiguration) {
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
    $(() => {
        if ( DISABLE_MOUSE ) {
            document.body.classList.add('disable-mouse');
        }
    });


    let useAdvancedControls: boolean = configuration['insert_advanced_controls'];
    $(() => {
        if (useAdvancedControls) {
            document.body.classList.add('advanced-controls');
        }
    });

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

        PlaybackCommands.render(playbuttonContainerElem, playbackManager);
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
    let spectrogram: Spectrogram;
    let mainPanel = <HTMLElement>document.createElement("div");
    mainPanel.id = 'main-panel';
    mainPanel.classList.add('loading');
    document.body.appendChild(mainPanel);

    let spinnerElem = insertLoadingSpinner(mainPanel);

    if (configuration['osmd']) {
        mainPanel.setAttribute('data-simplebar', "");
        mainPanel.setAttribute('data-simplebar-auto-hide', "false");
        let allowOnlyOneFermata: boolean = configuration['allow_only_one_fermata'];
        /*
        * Create a container element for OpenSheetMusicDisplay...
        */
        let osmdContainer: HTMLElement;
        $(() => {
            let osmdContainerContainer = <HTMLElement>document.createElement("div");
            osmdContainerContainer.id = 'osmd-container-container';
            mainPanel.appendChild(osmdContainerContainer);
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

            function copyTimecontainerContent(origin: HTMLElement, target: HTMLElement) {
                // retrieve quarter-note positions for origin and target
                function getContainedQuarters(timecontainer: HTMLElement): number[] {
                    return timecontainer.getAttribute('containedQuarterNotes')
                        .split(', ')
                        .map((x) => parseInt(x, 10))
                }
                const originContainedQuarters: number[] = getContainedQuarters(origin);
                const targetContainedQuarters: number[] = getContainedQuarters(target);

                const originStart_quarter: number = originContainedQuarters[0];
                const targetStart_quarter: number = targetContainedQuarters[0];
                const originEnd_quarter: number = originContainedQuarters.pop();
                const targetEnd_quarter: number = targetContainedQuarters.pop();

                const generationCommand: string = ('/copy' +
                    `?origin_start_quarter=${originStart_quarter}` +
                    `&origin_end_quarter=${originEnd_quarter}` +
                    `&target_start_quarter=${targetStart_quarter}` +
                    `&target_end_quarter=${targetEnd_quarter}`);
                loadMusicXMLandMidi(sheetPlaybackManager, osmd, serverUrl, generationCommand);
            }

            let autoResize: boolean = true;
            osmd = new eOSMD(osmdContainer,
                {autoResize: autoResize,
                drawingParameters: "compact",
                drawPartNames: false
                },
                granularities_quarters.map((num) => {return parseInt(num, 10);}),
                configuration['annotation_types'],
                allowOnlyOneFermata,
                copyTimecontainerContent);
            // TODO(theis): check proper way of enforcing subtype
            sheetPlaybackManager = new SheetPlaybackManager();
            playbackManager = sheetPlaybackManager;

            if (configuration['use_chords_instrument']) {
                sheetPlaybackManager.scheduleChordsPlayer(osmd,
                    configuration['chords_midi_channel']);
            }
        });
    } else if (configuration['spectrogram']) {
        let spectrogramContainerElem = document.createElement('div');
        spectrogramContainerElem.id = 'spectrogram-container';
        mainPanel.appendChild(spectrogramContainerElem);

        let spectrogramImageElem = document.createElement('img');
        spectrogramImageElem.id = 'spectrogram-image';
        spectrogramContainerElem.appendChild(spectrogramImageElem);

        console.log("WARNING: sloppy implementation here!!! CHECK PARAMETERS")
        spectrogram = new Spectrogram(spectrogramContainerElem, {}, [1], () => {});
        spectrogram.render(onClickTimestampBoxFactory);

        let spectrogramPlaybackManager = new SpectrogramPlaybackManager(4.,
            spectrogram);
        playbackManager = spectrogramPlaybackManager;

        // requesting the initial sheet, so can't send any sheet along
        const sendCodesWithRequest = false;
        const initial_command = '?pitch=64&instrument_family=string&temperature=1';

        loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                                'test-generate' + initial_command, sendCodesWithRequest).then(
            () => {
                spinnerElem.style.visibility = 'hidden';
                mainPanel.classList.remove('loading');
                if ( REGISTER_IDLE_STATE_DETECTOR ) {
                    HelpTour.registerIdleStateDetector();
                }
            });
    }

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

    function getChordLabels(osmd: eOSMD): object[] {
        // return a stringified JSON object describing the current chords
        let chordLabels = [];
        for (let chordSelector of osmd.chordSelectors) {
            chordLabels.push(chordSelector.currentChord);
        };
        return chordLabels;
    };

    function getMetadata(osmd: eOSMD) {
        return {
            fermatas: getFermatas(),
            chordLabels: getChordLabels(osmd)
        }
    }


    function onClickTimestampBoxFactory(osmd: eOSMD, timeStart: Fraction, timeEnd: Fraction) {
        // FIXME(theis) hardcoded 4/4 time-signature
        const [timeRangeStart_quarter, timeRangeEnd_quarter] = ([timeStart, timeEnd].map(
            timeFrac => Math.round(4 * timeFrac.RealValue)))

        const argsGenerationUrl = ("timerange-change" +
            `?time_range_start_quarter=${timeRangeStart_quarter}` +
            `&time_range_end_quarter=${timeRangeEnd_quarter}`
        );

        if ( configuration['osmd'] ) {
            return (function (this, _) {
                loadMusicXMLandMidi(sheetPlaybackManager, osmd, serverUrl, argsGenerationUrl);});
        } else if ( configuration['spectrogram'] ) {
            const sendCodesWithRequest: boolean = true;
            return (function (this, _) {
                loadAudioAndSpectrogram(spectrogramPlaybackManager,
                    serverUrl, argsGenerationUrl, sendCodesWithRequest);
                });
        }

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
    let currentCodes_top: Int32Array;
    let currentCodes_bottom: Int32Array;
    let currentXML: XMLDocument;

    /**
     * Load a MusicXml file via xhttp request, and display its contents.
     */
    function loadAudioAndSpectrogram(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, generationCommand: string, sendCodesWithRequest: boolean) {
        return new Promise((resolve, _) => {
            disableChanges();

            let payload_object = {};

            // log.trace('Metadata:');
            // log.trace(JSON.stringify(getMetadata()));

            if (sendCodesWithRequest) {
                payload_object['top_codes'] = currentCodes_top;
                payload_object['bottom_codes'] = currentCodes_bottom;
            }

            // register minimal error handler
            $(document).ajaxError((error) => console.log(error));

            $.get({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                contentType: 'application/json',
                dataType: 'json',
                success: (jsonResponse: {}) => {
                    const audioUrl = jsonResponse['audio']
                    const spectrogramUrl = jsonResponse['spectrogram']

                    spectrogramPlaybackManager.loadAudio(audioUrl).then(() => {
                        log.debug("Tone.js Player audio succesfully loaded!");
                        console.log("Tone.js Player audio succesfully loaded!");
                        currentCodes_top = jsonResponse['top_codes'];
                        currentCodes_bottom = jsonResponse['bottom_codes'];

                        spectrogram.render(onClickTimestampBoxFactory);

                        enableChanges();
                        resolve();
                    }
                    )

                    const spectrogramImageElem: HTMLImageElement = (
                        <HTMLImageElement>document.getElementById('spectrogram-image'));
                    spectrogramImageElem.src = spectrogramUrl;
                }
            }).done(() => {
            })

        })
    };


    /**
     * Load a MusicXml file via xhttp request, and display its contents.
     */
    function loadMusicXMLandMidi(playbackManager: SheetPlaybackManager, osmd: eOSMD,
            serverURL: string, generationCommand: string,
            sendSheetWithRequest: boolean = true) {
        return new Promise((resolve, _) => {
            disableChanges();

            let payload_object = getMetadata(osmd);

            log.trace('Metadata:');
            log.trace(JSON.stringify(getMetadata(osmd)));

            if (sendSheetWithRequest) {
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
                            resolve();

                            let sequenceDuration: Tone.Time = Tone.Time(
                                `0:${osmd.sequenceDuration_quarters}:0`)
                            playbackManager.loadMidi(url.resolve(serverURL, '/musicxml-to-midi'),
                                currentXML,
                                sequenceDuration,
                                bpmControl
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
        if ( configuration['osmd'] ) {
            const instrumentsGridElem = document.createElement('div');
            instrumentsGridElem.id = 'instruments-grid';
            instrumentsGridElem.classList.add('two-columns');
            bottomControlsGridElem.appendChild(instrumentsGridElem);

            ControlLabels.createLabel(instrumentsGridElem, 'instruments-grid-label');

            Instruments.renderInstrumentSelect(instrumentsGridElem);
            if ( configuration['use_chords_instrument'] ) {
                Instruments.renderChordInstrumentSelect(instrumentsGridElem);
            }
            Instruments.renderDownloadButton(instrumentsGridElem,
                configuration['use_chords_instrument']);
            }
        }

    if ( configuration['osmd'] ) {
    $(() => {
        let useSimpleSlider: boolean = !useAdvancedControls;
            bpmControl = new BPMControl(bottomControlsGridElem, 'bpm-control');
            bpmControl.render(useSimpleSlider);

            // link the Ableton-Link client to the BPM controller
            LinkClient.setBPMControl(bpmControl);

        // set the initial tempo for the app
        // if (LinkClient.isEnabled()) {
        // // if Link is enabled, use the Link tempo
        //     LinkClient.setBPMtoLinkBPM_async();
        // }
        // else
            { bpmControl.value  = 110; }
    });
    }

    $(() => {
        let insertWavInput: boolean = configuration['insert_wav_input'];
        if (insertWavInput) {
            createWavInput(() => loadMusicXMLandMidi(sheetPlaybackManager, osmd, serverUrl, 'get-musicxml'))
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
        if ( useAdvancedControls && configuration['osmd'] ) {
            // Add MIDI-out selector
            MidiOut.render(configuration["use_chords_instrument"]);

            // Add manual Link-Sync button
            PlaybackCommands.renderSyncButton(playbackManager);
        }}
    );

    if ( configuration['osmd'] ) {
        $(() => {
            // Insert zoom controls
            const zoomControlsGridElem = document.createElement('div');
            zoomControlsGridElem.id = 'osmd-zoom-controls';
            // zoomControlsGridElem.classList.add('two-columns');
            const mainPanel = document.getElementById(
                "main-panel");
            mainPanel.appendChild(zoomControlsGridElem);
            renderZoomControls(zoomControlsGridElem, osmd);
        }
        );
    }
}


$(() => {
    SplashScreen.render(render);
});


if (module.hot) { }
