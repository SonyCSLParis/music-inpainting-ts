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
let instrumentSelect: CycleSelect;
let vqvaeLayerSelect: CycleSelect;

async function render(configuration=defaultConfiguration) {
    await Tone.start();

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
        Header.render(headerGridElem, configuration);
    });

    let bottomControlsGridElem: HTMLDivElement;

    $(() => {
        bottomControlsGridElem = document.createElement('div');
        bottomControlsGridElem.id = 'bottom-controls';
        document.body.appendChild(bottomControlsGridElem);
    });

    $(() => {
        if ( configuration['osmd'] ) {
            GranularitySelect.renderGranularitySelect(bottomControlsGridElem,
                granularities_quarters);
        }
        else if ( configuration['spectrogram'] ) {
            let vqvaeLayerIcons: Map<string, string> = new Map([
                ['bottom', 'paint-brush-small.svg'],
                ['top', 'paint-roller.svg'],
                ['top-eraser', 'edit-tools.svg']
            ])

            let vqvaeLayerDimensions: Map<string, [number, number]> = new Map([
                ['bottom', [64, 8]],
                ['top', [32, 4]],
                ['eraser-top', [32, 4]]
            ])

            let iconsBasePath: string = path.join(static_correct, 'icons');

            let granularitySelectContainerElem: HTMLElement = document.createElement('control-item');
            granularitySelectContainerElem.id = 'vqvae-layer-select-container';
            bottomControlsGridElem.appendChild(granularitySelectContainerElem);

            ControlLabels.createLabel(granularitySelectContainerElem,
                'vqvae-layer-select-label');

            function vqvaeLayerOnChange(ev) {
                let newLayer: string = <string>this.value.split('-')[0];
                let [newNumRows, newNumColumns] = vqvaeLayerDimensions.get(newLayer);
                spectrogramPlaybackManager.spectrogramLocator.render(newNumRows, newNumColumns);
            };

            vqvaeLayerSelect = new CycleSelect(granularitySelectContainerElem,
                'vqvae-layer-select',
                {handleEvent: vqvaeLayerOnChange},
                vqvaeLayerIcons,
                iconsBasePath);
        }
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

    if ( configuration['spectrogram'] ) {
        $(() => {
            let bottomControlsGridElem = document.getElementById('bottom-controls');
            pitchControl = new NumberControl(bottomControlsGridElem,
                'pitch-control', [24, 84], 60);
            pitchControl.render();

            let instrumentSelectElem: HTMLElement = document.createElement('control-item');
            instrumentSelectElem.id = 'instrument-control';
            bottomControlsGridElem.appendChild(instrumentSelectElem);
            instrumentSelect = new Nexus.Select('#instrument-control', {
                'size': [150, 50],
                'options': ['bass', 'brass', 'flute',
                    'guitar', 'keyboard', 'mallet', 'organ',
                    'reed', 'string', 'synth_lead', 'vocal'
                ],
                'value': 'organ',
            });
            ControlLabels.createLabel(instrumentSelectElem, 'instrument-control-label');
        });
    };

    let osmd: eOSMD;
    $(() => {
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
                    copyTimecontainerContent
                );
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
            let spectrogram = new Spectrogram(spectrogramContainerElem, {}, [1], () => {});

            spectrogramPlaybackManager = new SpectrogramPlaybackManager(4.,
                spectrogram);
            playbackManager = spectrogramPlaybackManager;

            vqvaeLayerSelect.value = 'top';  // trigger correct rendering of the spectrogram grid
            const sendCodesWithRequest = false;
            const initial_command = ('?pitch=' + pitchControl.value.toString()
                + '&instrument_family_str=' + instrumentSelect.value
                + '&layer=' + vqvaeLayerSelect.value.split('-')[0]
                + '&temperature=1');

            loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                'test-generate' + initial_command, sendCodesWithRequest).then(
                    () => {
                spinnerElem.style.visibility = 'hidden';
                mainPanel.classList.remove('loading');
                if ( REGISTER_IDLE_STATE_DETECTOR ) {
                    HelpTour.registerIdleStateDetector();
                }
            });
            // });
        };
    })

    // TODO(theis): could use a more strict type-hint (number[][]|string[][])
    // but this has the TS type-schecker fail, considering the map method (which
    // receives a union type itself) non-callable
    // see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
    function updateConditioningMap(mask: number[][],
            currentConditioningMap: Map<string, (number|string)[][]>
            ): Map<string, (number|string)[][]> {
        // retrieve up-to-date user-selected conditioning
        const newConditioning_value = new Map()
        newConditioning_value.set('pitch', pitchControl.value)
        newConditioning_value.set('instrument_family_str', instrumentSelect.value)

        for (const [ modality, conditioning_map ] of currentConditioningMap.entries()) {
            currentConditioningMap.set(modality, (
                conditioning_map.map((row: (number|string)[], row_index: number) => {
                    return row.map((currentConditioning_value: number|string, column_index: number) => {
                        if ( mask[row_index][column_index] == 1 ) {
                            return newConditioning_value.get(modality)
                        }
                        else {
                            return currentConditioning_value
                        }
                    })
                })))
        };

        return currentConditioningMap
    }

    if ( configuration['spectrogram'] ) {
        $(() => {
            let regenerationCallback = (
                (v) => {
                    let mask = spectrogramPlaybackManager.spectrogramLocator.mask;
                    switch ( vqvaeLayerSelect.value ) {
                        case "top": {
                            currentConditioning_top = updateConditioningMap(
                                mask, currentConditioning_top
                            );
                            break;
                        };
                        case "bottom": {
                            currentConditioning_bottom = updateConditioningMap(
                                mask, currentConditioning_bottom
                            );
                            break;
                        }
                    }

                    let sendCodesWithRequest = true;
                    const generationParameters = ('?pitch=' + pitchControl.value.toString()
                        + '&instrument_family_str=' + instrumentSelect.value
                        + '&layer=' + vqvaeLayerSelect.value.split('-')[0]
                        + '&temperature=1'
                        + '&eraser_amplitude=0.1');
                    const split_tool_select = vqvaeLayerSelect.value.split('-')
                    let command;
                    switch ( split_tool_select.length ) {
                        case 1: {command = 'timerange-change'; break;};
                        case 2: {if ( split_tool_select[1] == 'eraser') {
                            command = 'erase'}
                            else { throw EvalError };
                            break;};
                        default: { throw EvalError; };
                    }
                    loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                        command + generationParameters, sendCodesWithRequest, mask);
                }
            )
            // spectrogramPlaybackManager.spectrogramLocator.registerCallback(regenerationCallback);

            let spectrogramContainerElem = document.getElementById('spectrogram-container');
            spectrogramContainerElem.addEventListener('click', regenerationCallback);

            let regeneratebuttonContainerElem: HTMLElement = document.createElement('control-item');
            regeneratebuttonContainerElem.id = 'regenerate-button';
            bottomControlsGridElem.appendChild(regeneratebuttonContainerElem);

            $(() => {
                let regeneratebutton = new Nexus.TextButton('#regenerate-button', {
                    'size': [150,50],
                    'text': 'Regenerate',
                });

                regeneratebutton.on('change', (enable) => {
                    if ( enable ) {
                        regenerationCallback(enable);
                    }});
            })
        });
    };

    $(() => {
        let playbuttonContainerElem: HTMLElement = document.createElement('control-item');
        playbuttonContainerElem.id = 'play-button';

        bottomControlsGridElem.appendChild(playbuttonContainerElem);

        ControlLabels.createLabel(playbuttonContainerElem, 'play-button-label');

        PlaybackCommands.render(playbuttonContainerElem, playbackManager);
    });


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
    let currentConditioning_top: Map<string, (number|string)[][]>;
    let currentConditioning_bottom: Map<string, (number|string)[][]>;
    let currentXML: XMLDocument;

    function loadNewMap(newConditioningMap): Map<string, (number|string)[][]> {
        let conditioning_map = new Map();
        conditioning_map.set('pitch', newConditioningMap['pitch']);
        conditioning_map.set('instrument_family_str', newConditioningMap['instrument_family_str']);
        return conditioning_map
    }

    function mapToObject(conditioning_map: Map<string, (number|string)[][]>) {
        return {
            'pitch': conditioning_map.get('pitch'),
            'instrument_family_str': conditioning_map.get('instrument_family_str')
        };
    };

    /**
     * Load a MusicXml file via xhttp request, and display its contents.
     */
    function loadAudioAndSpectrogram(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, generationCommand: string, sendCodesWithRequest: boolean,
            mask: number[][] = null) {
        return new Promise((resolve, _) => {
            disableChanges();

            let payload_object = {};

            if (sendCodesWithRequest) {
                payload_object['top_code'] = currentCodes_top;
                payload_object['bottom_code'] = currentCodes_bottom;
                payload_object['top_conditioning'] = mapToObject(
                    currentConditioning_top);
                payload_object['bottom_conditioning'] = mapToObject(
                    currentConditioning_bottom);
            }
            if ( mask !== null ) {
                // send the mask with low-frequencies first
                payload_object['mask'] = mask.reverse();
            };

            $.post({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                contentType: 'application/json',
                dataType: 'json',
                success: (jsonResponse: {}) => {
                    const newCodes_top = jsonResponse['top_code']
                    const newCodes_bottom = jsonResponse['bottom_code']
                    const newConditioning_top = loadNewMap(
                        jsonResponse['top_conditioning'])
                    const newConditioning_bottom = loadNewMap(
                        jsonResponse['bottom_conditioning'])

                    const audioPromise = getAudioRequest(spectrogramPlaybackManager, serverURL,
                        newCodes_top, newCodes_bottom);
                    const spectrogramImagePromise = getSpectrogramImageRequest(
                        spectrogramPlaybackManager, serverURL, newCodes_top, newCodes_bottom);

                    Promise.all([audioPromise, spectrogramImagePromise]).then(() => {
                        currentCodes_top = newCodes_top;
                        currentCodes_bottom = newCodes_bottom;
                        currentConditioning_top = newConditioning_top;
                        currentConditioning_bottom = newConditioning_bottom;

                        enableChanges();
                        resolve();
                    });
                }
            }).done(() => {
            })

        })
    };

    function getAudioRequest(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, top_code: number[][], bottom_code: number[][]) {
        return new Promise((resolve, _) => {
            let payload_object = {};

            payload_object['top_code'] = top_code;
            payload_object['bottom_code'] = bottom_code;

            const generationCommand: string = '/get-audio';
            $.post({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                xhrFields: {
                    responseType: 'blob'
                },
                contentType: 'application/json',
                success: (blob: Blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    spectrogramPlaybackManager.loadAudio(blobUrl).then(() => {
                        log.debug("Tone.js Player audio succesfully loaded!");

                        vqvaeLayerSelect.value = vqvaeLayerSelect.value;

                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    });
                }
            }).done(() => {})
        })
    }

    function getSpectrogramImageRequest(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, top_code: number[][], bottom_code: number[][]) {
        return new Promise((resolve, _) => {
            let payload_object = {};

            payload_object['top_code'] = top_code;
            payload_object['bottom_code'] = bottom_code;

            const generationCommand: string = '/get-spectrogram-image';
            $.post({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                xhrFields: {
                    responseType: 'blob'
                },
                contentType: 'application/json',
                success: (blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    const spectrogramImageElem: HTMLImageElement = (
                        <HTMLImageElement>document.getElementById('spectrogram-image'));
                    spectrogramImageElem.src = blobUrl;
                    $(() => {URL.revokeObjectURL(blobUrl);})
                    resolve();
                }
            }).done(() => {
            })
        })
    }

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

    if ( configuration['osmd'] ) {
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
            Instruments.renderDownloadButton(instrumentsGridElem,
                configuration['use_chords_instrument']);
        });
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
    // register minimal error handler
    $(document).ajaxError((error) => console.log(error));

    SplashScreen.render(render);
});


if (module.hot) { }
