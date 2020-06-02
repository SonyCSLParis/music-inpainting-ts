// import * as nipplejs from "nipplejs";
import { Spectrogram } from './locator';
import { Fraction } from 'opensheetmusicdisplay';
import * as $ from "jquery";
import 'jquery-awesome-cursor';
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
import { SpectrogramPlaybackManager, renderFadeInControl } from './spectrogramPlayback';
import { NumberControl, BPMControl } from './numberControl';
// import LinkClient from './linkClient';
// import * as LinkClientCommands from './linkClientCommands';
import { DownloadButton } from './downloadCommand';
import * as HelpTour from './helpTour';
import { createLFOControls } from './lfo';
import { CycleSelect } from './cycleSelect';
import { static_correct} from './staticPath';
import * as ControlLabels from './controlLabels';
import { createWavInput } from './file_upload';
import * as SplashScreen from './startup';

// import 'simplebar';
// import 'simplebar/packages/simplebar/src/simplebar.css';

import '../common/styles/osmd.scss';
import '../common/styles/spectrogram.scss';
import '../common/styles/main.scss';
import '../common/styles/controls.scss';
import '../common/styles/disableMouse.scss';

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;

declare var ohSnap: any;

let defaultConfiguration = require('../common/default_config.json');

let playbackManager: PlaybackManager;
let spectrogramPlaybackManager: SpectrogramPlaybackManager;
let bpmControl: BPMControl;
let pitchControl: NumberControl;
let instrumentSelect: CycleSelect;
let vqvaeLayerSelect: CycleSelect;
let downloadButton: DownloadButton;

function toggleBusyClass(state: boolean): void {
    $('body').toggleClass('busy', state);
    $('.notebox').toggleClass('busy', state);
    $('.notebox').toggleClass('available', !state);
    $('#spectrogram-container').toggleClass('busy', state);
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

async function render(configuration=defaultConfiguration) {
    disableChanges();

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
        let vqvaeLayerIcons: Map<string, string> = new Map([
                ['bottom-brush', 'paint-brush-small.svg'],
                ['top-brush', 'paint-roller.svg'],
                ['top-eraser', 'edit-tools.svg']
            ])

        let vqvaeLayerDimensions: Map<string, [number, number]> = new Map([
            ['bottom', [64, 8]],
            ['top', [32, 4]]
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
    });


    $(() => {
        let insertLFO: boolean = configuration["insert_variations_lfo"];
        if (insertLFO) {
            createLFOControls();
        }
    });

    let serverPort: number = configuration['server_port'];
    let serverIp: string = configuration['server_ip'];
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

    $(() => {
        let mainPanel = <HTMLElement>document.createElement("div");
        mainPanel.id = 'main-panel';
        document.body.appendChild(mainPanel);

        let spinnerElem = insertLoadingSpinner(mainPanel);

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
        PlaybackCommands.setPlaybackManager(spectrogramPlaybackManager);

        vqvaeLayerSelect.value = 'top-brush';  // trigger correct rendering of the spectrogram grid
        const sendCodesWithRequest = false;
        const initial_command = ('?pitch=' + pitchControl.value.toString()
            + '&instrument_family_str=' + instrumentSelect.value
            + '&layer=' + vqvaeLayerSelect.value.split('-')[0]
            + '&temperature=1');

        loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
            'sample-from-dataset' + initial_command, sendCodesWithRequest).then(
                () => {
                    enableChanges();
                    if ( REGISTER_IDLE_STATE_DETECTOR ) {
                        HelpTour.registerIdleStateDetector();
                    };
                }
            );
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
                    let command: string;
                    switch ( split_tool_select.length ) {
                        case 1: {  throw EvalError; };
                        case 2: {
                            switch ( split_tool_select[1] ) {
                                case 'eraser': {
                                    command = 'erase';
                                    break;
                                };
                                case 'brush': {
                                    command = 'timerange-change';
                                    break;
                                };
                            };
                            break;
                        };
                        default: { throw EvalError; };
                    }
                    loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                        command + generationParameters, sendCodesWithRequest, mask);
                }
            )
            spectrogramPlaybackManager.spectrogramLocator.registerCallback(regenerationCallback);
        });
    };

    $(() => {
        $(() => {
            let playbuttonContainerElem: HTMLElement = document.createElement('control-item');
            playbuttonContainerElem.id = 'play-button';

            bottomControlsGridElem.appendChild(playbuttonContainerElem);

            ControlLabels.createLabel(playbuttonContainerElem, 'play-button-label');

            PlaybackCommands.render(playbuttonContainerElem);
        });
    });

    // TODO don't create globals like this
    let currentCodes_top: number[][];
    let currentCodes_bottom: number[][];
    let currentConditioning_top: Map<string, (number|string)[][]>;
    let currentConditioning_bottom: Map<string, (number|string)[][]>;
    let currentXML: XMLDocument;

    function loadNewMap(newConditioningMap: Map<string, (number|string)[][]>
            ): Map<string, (number|string)[][]> {
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

    async function updateAudio(audioBlob: Blob): Promise<void> {
        // clear previous blob URL
        downloadButton.revokeBlobURL();

        // allocate new local blobURL for the received audio
        const blobUrl = URL.createObjectURL(audioBlob);

        return spectrogramPlaybackManager.loadAudio(blobUrl).then(() => {
            log.debug("Tone.js Player audio succesfully loaded!");
            downloadButton.targetURL = blobUrl;
        });
    };

    async function updateSpectrogramImage(imageBlob: Blob): Promise<void> {
        return new Promise((resolve, _) => {
            const blobUrl = URL.createObjectURL(imageBlob);
            const spectrogramImageElem: HTMLImageElement = (
                <HTMLImageElement>document.getElementById('spectrogram-image'));
            spectrogramImageElem.src = blobUrl;
            $(() => {URL.revokeObjectURL(blobUrl); resolve();})
        });
    };

    async function updateAudioAndImage(audioPromise: Promise<Blob>,
            spectrogramImagePromise: Promise<Blob>): Promise<void> {
        return await Promise.all([audioPromise, spectrogramImagePromise]).then(
            // unpack the received results and update the interface
            ([audioBlob, spectrogramImageBlob]: [Blob, Blob]) => {
                updateAudio(audioBlob);
                updateSpectrogramImage(spectrogramImageBlob);
            }
        );
    };

    /**
     * Load a MusicXml file via xhttp request, and display its contents.
     */
    async function loadAudioAndSpectrogram(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, generationCommand: string, sendCodesWithRequest: boolean,
            mask: number[][] = null): Promise<void> {
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

        let newCodes_top: number[][];
        let newCodes_bottom: number[][];
        let newConditioning_top: Map<string, (string | number)[][]>;
        let newConditioning_bottom: Map<string, (string | number)[][]>;

        try {
            const jsonResponse = await $.post({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                contentType: 'application/json',
                dataType: 'json',
            })

            newCodes_top = jsonResponse['top_code']
            newCodes_bottom = jsonResponse['bottom_code']
            newConditioning_top = loadNewMap(
                jsonResponse['top_conditioning'])
            newConditioning_bottom = loadNewMap(
                jsonResponse['bottom_conditioning'])

            const audioPromise = getAudioRequest(spectrogramPlaybackManager, serverURL,
                newCodes_top, newCodes_bottom);
            const spectrogramImagePromise = getSpectrogramImageRequest(
                spectrogramPlaybackManager, serverURL, newCodes_top, newCodes_bottom);

            await updateAudioAndImage(audioPromise, spectrogramImagePromise);
        }
        catch(e) {
            console.log(e);
            spectrogramPlaybackManager.spectrogramLocator.clear();
            enableChanges();
            return
        }

        currentCodes_top = newCodes_top;
        currentCodes_bottom = newCodes_bottom;
        currentConditioning_top = newConditioning_top;
        currentConditioning_bottom = newConditioning_bottom;

        spectrogramPlaybackManager.spectrogramLocator.clear();
        enableChanges();
    };

    function dropHandler(e: DragEvent) {
        // Prevent default behavior (Prevent file from being opened)
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (var i = 0; i < e.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (e.dataTransfer.items[i].kind === 'file') {
                var file = e.dataTransfer.items[i].getAsFile();
                console.log('... file[' + i + '].name = ' + file.name);
                const generationParameters = (
                    '?pitch=' + pitchControl.value.toString()
                    + '&instrument_family_str=' + instrumentSelect.value);
                sendAudio(file, spectrogramPlaybackManager, serverUrl,
                    'analyze-audio' + generationParameters);
                return  // only send the first file
            }
            }
        } else {
            // Use DataTransfer interface to access the file(s)
            for (var i = 0; i < e.dataTransfer.files.length; i++) {
                console.log('... file[' + i + '].name = ' + e.dataTransfer.files[i].name);
            }
        }
    };

    async function sendAudio(audioBlob: Blob, spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, generationCommand: string) {
        disableChanges();

        let payload_object = {};

        let form = new FormData();
        form.append('audio', audioBlob);

        let newCodes_top: number[][];
        let newCodes_bottom: number[][];
        let newConditioning_top: Map<string, (string | number)[][]>;
        let newConditioning_bottom: Map<string, (string | number)[][]>;

        try {
            const jsonResponse = await $.post({
                url: url.resolve(serverURL, generationCommand),
                data: form,
                contentType: false,
                dataType: 'json',
                processData: false,
            })

            newCodes_top = jsonResponse['top_code']
            newCodes_bottom = jsonResponse['bottom_code']
            newConditioning_top = loadNewMap(
                jsonResponse['top_conditioning'])
            newConditioning_bottom = loadNewMap(
                jsonResponse['bottom_conditioning'])

            const audioPromise = getAudioRequest(spectrogramPlaybackManager, serverURL,
                newCodes_top, newCodes_bottom);
            const spectrogramImagePromise = getSpectrogramImageRequest(
                spectrogramPlaybackManager, serverURL, newCodes_top, newCodes_bottom);

            await updateAudioAndImage(audioPromise, spectrogramImagePromise);
        }
        catch(e) {
            console.log(e);
            spectrogramPlaybackManager.spectrogramLocator.clear();
            enableChanges();
            return
        }

        currentCodes_top = newCodes_top;
        currentCodes_bottom = newCodes_bottom;
        currentConditioning_top = newConditioning_top;
        currentConditioning_bottom = newConditioning_bottom;

        spectrogramPlaybackManager.spectrogramLocator.clear();
        enableChanges();
    };

    async function getAudioRequest(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, top_code: number[][], bottom_code: number[][]): Promise<Blob> {
        let payload_object = {};
        payload_object['top_code'] = top_code;
        payload_object['bottom_code'] = bottom_code;

        const generationCommand: string = '/get-audio';
        return $.post({
                url: url.resolve(serverURL, generationCommand),
                data: JSON.stringify(payload_object),
                xhrFields: {
                    responseType: 'blob'
                },
                contentType: 'application/json'
            })
    }

    async function getSpectrogramImageRequest(spectrogramPlaybackManager: SpectrogramPlaybackManager,
            serverURL: string, top_code: number[][], bottom_code: number[][]): Promise<Blob> {
        let payload_object = {};

        payload_object['top_code'] = top_code;
        payload_object['bottom_code'] = bottom_code;

        const generationCommand: string = '/get-spectrogram-image';
        return $.post({
            url: url.resolve(serverURL, generationCommand),
            data: JSON.stringify(payload_object),
            xhrFields: {
                responseType: 'blob'
            },
            contentType: 'application/json',
        })
    }

    $(() => {
        let insertWavInput: boolean = configuration['insert_wav_input'];
        if (insertWavInput) {
            // createWavInput(() => loadMusicXMLandMidi(sheetPlaybackManager, osmd, serverUrl, 'get-musicxml'))
    }});

    $(() => {
        let bottomControlsGridElem = document.getElementById('bottom-controls')
        downloadButton = new DownloadButton(bottomControlsGridElem,
            configuration);
    });

    $(() => {
        // LinkClient.kill();
        // if (useAdvancedControls) {
        //     // Insert LINK client controls
        //     LinkClientCommands.render();
        //     LinkClientCommands.renderDownbeatDisplay();
        // }
    }
    );

    // $(() => {
    //     if ( useAdvancedControls ) {
    //         // Add manual Link-Sync button
    //         const bottomControlsGridElem = document.getElementById('bottom-controls')
    //         PlaybackCommands.renderSyncButton(bottomControlsGridElem);
    //     }}
    // );

    $(() => {
        // register file drop handler
        document.body.addEventListener('drop', dropHandler);
    })

    $(() => {
        let bottomControlsGridElem = document.getElementById('bottom-controls');
        let fadeInControlElement: HTMLElement = document.createElement('control-item');
        fadeInControlElement.id = 'fade-in-control';
        bottomControlsGridElem.appendChild(fadeInControlElement);
        renderFadeInControl(fadeInControlElement, spectrogramPlaybackManager);
    });
}

$(() => {
    // register minimal error handler
    $(document).ajaxError((error) => console.log(error));

    SplashScreen.render(render);
});

$(() => {
    // disable drop events on whole window
    window.addEventListener("dragover", function(e) {
        e.preventDefault(); e.stopPropagation();}, false);
    window.addEventListener("drop", function(e) {
        e.preventDefault(); e.stopPropagation();}, false);
})

if (module.hot) { }
