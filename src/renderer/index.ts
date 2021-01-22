// import * as nipplejs from "nipplejs";
import { SheetLocator, renderZoomControls, SpectrogramLocator, registerZoomTarget, Locator } from './locator';
import { Fraction } from 'opensheetmusicdisplay';
import $ from "jquery";
import * as Tone from 'tone';
import * as log from 'loglevel';
import * as path from 'path';
import Nexus from './nexusColored';
import * as url from 'url';

import * as Header from './header';

import * as PlaybackCommands from './playbackCommands';
import { PlaybackManager } from './playback';
import SheetPlaybackManager from './sheetPlayback';
import { SpectrogramPlaybackManager } from './spectrogramPlayback';
import * as SpectrogramPlayback from './spectrogramPlayback';

import * as Instruments from './instruments';
import { NumberControl, BPMControl } from './numberControl';
import LinkClient from './ableton_link/linkClient';
// import * as LinkClientCommands from './linkClientCommands';
import { DownloadButton, filename as filenameType } from './downloadCommand';
import * as MidiOut from './midiOut';
import * as MidiIn from './midiIn';

import { myTrip, NonotoTrip, NotonoTrip } from './helpTour';

import { createLFOControls } from './lfo';
import { CycleSelect } from './cycleSelect';
import { static_correct} from './staticPath';
import * as ControlLabels from './controlLabels';
import * as GranularitySelect from './granularitySelect';
import { createWavInput } from './file_upload';
import * as SplashScreen from './startup';

import 'simplebar';
import 'simplebar/src/simplebar.css';
import '../common/styles/simplebar.scss';

import '../common/styles/osmd.scss';
import '../common/styles/spectrogram.scss';
import '../common/styles/main.scss';
import '../common/styles/controls.scss';
import '../common/styles/disableMouse.scss';

import colors from '../common/styles/mixins/_colors.module.scss';

declare var ohSnap: any;
declare var COMPILE_ELECTRON: boolean;

let defaultConfiguration = require('../common/default_config.json');

let appConfiguration: any;
let locator: Locator;
let playbackManager: PlaybackManager<Locator>;
let sheetPlaybackManager: SheetPlaybackManager;
let spectrogramPlaybackManager: SpectrogramPlaybackManager;
let bpmControl: BPMControl;
let pitchRootSelect: Nexus.Select;
let octaveControl: NumberControl;
let instrumentSelect: CycleSelect;
let vqvaeLayerSelect: CycleSelect;
let downloadButton: DownloadButton;
let helpTrip: myTrip;

function getMidiPitch(): number {
    return (pitchRootSelect.selectedIndex) + 12 * (octaveControl.value);
}

function triggerInterfaceRefresh(): void {
    vqvaeLayerSelect.value = vqvaeLayerSelect.value;
};

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
    appConfiguration = configuration;

    if ( configuration['osmd'] ) {
        document.body.classList.add('nonoto');
        Nexus.colors.accent = colors.millenial_pink_active_control;
        Nexus.colors.fill = colors.millenial_pink_idle_control;
    }
    else if ( configuration['spectrogram'] ) {
        document.body.classList.add('notono')
    }

    if ( document.getElementById('header') ) {
        // do nothing if the app has already been rendered
        return;
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

    const granularities_quarters: string[] = (
        (<string[]>configuration['granularities_quarters']).sort(
            (a, b) => {return parseInt(a) - parseInt(b)}));

    $(() => {
        let headerGridElem: HTMLElement = document.createElement('header');
        headerGridElem.id = 'header';
        document.body.appendChild(headerGridElem);

        let mainPanel = <HTMLElement>document.createElement('div');
        mainPanel.id = 'main-panel';
        document.body.appendChild(mainPanel);

        let bottomControlsGridElem: HTMLElement;
        bottomControlsGridElem = document.createElement('footer');
        bottomControlsGridElem.id = 'bottom-controls';
        document.body.appendChild(bottomControlsGridElem);
    });

    $(() => {
        let headerGridElem = document.getElementById('header');
        Header.render(headerGridElem, configuration);
    })

    $(() => {
        let bottomControlsGridElem = document.getElementById('bottom-controls');
        let bottomControlsExpandTabElem = document.createElement('div');
        bottomControlsExpandTabElem.id = 'bottom-controls-expand';
        bottomControlsExpandTabElem.classList.add('expand-tab');
        bottomControlsGridElem.appendChild(bottomControlsExpandTabElem);
        bottomControlsExpandTabElem.addEventListener('click', function () {
            document.body.classList.toggle('advanced-controls');
            locator.refresh();
        });

        const playbackCommandsGridspan = document.createElement('div');
        playbackCommandsGridspan.id = "playback-commands-gridspan";
        playbackCommandsGridspan.classList.add('gridspan');
        bottomControlsGridElem.appendChild(playbackCommandsGridspan);

        if ( configuration['spectrogram'] ) {
            // create element for highlighting control grid spans in help
            const constraintsSpanElem = document.createElement('div');
            constraintsSpanElem.id = "constraints-gridspan";
            constraintsSpanElem.classList.add('gridspan');
            constraintsSpanElem.classList.add('multi-column-gridspan');
            bottomControlsGridElem.appendChild(constraintsSpanElem);

            const editToolsGridspanElem = document.createElement('div');
            editToolsGridspanElem.id = "edit-tools-gridspan";
            editToolsGridspanElem.classList.add('gridspan');
            bottomControlsGridElem.appendChild(editToolsGridspanElem);
        }
    });

    $(() => {
        let bottomControlsGridElem = document.getElementById('bottom-controls');
        if ( configuration['osmd'] ) {
            GranularitySelect.renderGranularitySelect(bottomControlsGridElem,
                granularities_quarters);
        }
        else if ( configuration['spectrogram'] ) {
            let vqvaeLayerIcons: Map<string, string> = new Map([
                ['top-brush', 'paint-roller.svg'],
                ['bottom-brush', 'paint-brush-small.svg'],
                ['top-brush-random', 'paint-roller-random.svg'],
                ['bottom-brush-random', 'paint-brush-small-random.svg'],
                ['top-eraser', 'edit-tools.svg'],
            ])

            let vqvaeLayerDimensions: Map<string, [number, number]> = new Map([
                ['bottom', [64, 8]],
                ['top', [32, 4]]
            ])

            let iconsBasePath: string = path.join(static_correct, 'icons');

            let granularitySelectContainerElem: HTMLElement = document.createElement('control-item');
            granularitySelectContainerElem.id = 'edit-tool-select-container';
            let bottomControlsGridElem = document.getElementById('bottom-controls');
            bottomControlsGridElem.appendChild(granularitySelectContainerElem);

            ControlLabels.createLabel(granularitySelectContainerElem,
                'edit-tool-select-label');

            function vqvaeLayerOnChange(ev) {
                const tool: string = this.value;
                const newLayer: string = <string>tool.split('-')[0];
                const [newNumRows, newNumColumns] = vqvaeLayerDimensions.get(newLayer);
                const [_, numColumnsTop] = vqvaeLayerDimensions.get('top');
                spectrogramPlaybackManager.Locator.render(newNumRows, newNumColumns,
                    numColumnsTop);
                    spectrogramPlaybackManager.Locator.container.classList.toggle(
                        'eraser', tool.includes('eraser'))
            };

            vqvaeLayerSelect = new CycleSelect(granularitySelectContainerElem,
                'edit-tool-select',
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

    let serverIp: string = configuration['server_ip'];
    if (serverIp.charAt(serverIp.length-1) == '/') {
        // strip irrelevant slash at end of IP or address
        serverIp = serverIp.substring(0, serverIp.length-1);
    }
    let serverPort: number = configuration['server_port'];
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
            const constraintsGridspanElem = document.getElementById('constraints-gridspan');

            const instrumentSelectGridspanElem: HTMLElement = document.createElement('div');
            instrumentSelectGridspanElem.id = 'instrument-select-gridspan';
            instrumentSelectGridspanElem.classList.add('gridspan');
            constraintsGridspanElem.appendChild(instrumentSelectGridspanElem);
            const instrumentSelectElem: HTMLElement = document.createElement('control-item');
            instrumentSelectElem.id = 'instrument-control';
            instrumentSelectGridspanElem.appendChild(instrumentSelectElem);
            instrumentSelect = new Nexus.Select('#instrument-control', {
                    'size': [120, 50],
                    'options': ['bass', 'brass', 'flute',
                    'guitar', 'keyboard', 'mallet', 'organ',
                    'reed', 'string', 'synth_lead', 'vocal'
                ],
                'value': 'organ',
            });
            ControlLabels.createLabel(instrumentSelectElem, 'instrument-control-label', false,
                null, instrumentSelectGridspanElem);

            const pitchSelectGridspanElem = document.createElement('div');
            pitchSelectGridspanElem.id = 'pitch-control-gridspan';
            pitchSelectGridspanElem.classList.add('gridspan');
            constraintsGridspanElem.appendChild(pitchSelectGridspanElem);

            const pitchSelectContainer = document.createElement('control-item');
            pitchSelectContainer.id = 'pitch-control-root-select';
            pitchSelectGridspanElem.appendChild(pitchSelectContainer);
            // TODO(theis): clean this!
            pitchRootSelect = new Nexus.Select(
                '#pitch-control-root-select', {
                    'size': [20,30],
                    'options': [
                        'C', 'C♯', 'D', 'E♭', 'E',
                        'F', 'F♯', 'G', 'A♭', 'A',
                        'B♭', 'B',
                    ]
                }
            );
            pitchSelectContainer.style.width = ''
            pitchSelectContainer.style.height = ''
            ControlLabels.createLabel(pitchSelectContainer, 'pitch-control-root-select-label',
                false, null, pitchSelectGridspanElem);

            octaveControl = new NumberControl(pitchSelectGridspanElem,
                'pitch-control-octave-control', [2, 7], 5);
            const useSimpleSlider = false;
            const elementWidth_px = 40;
            octaveControl.render(useSimpleSlider, elementWidth_px);
        });
    };

    $(() => {
        // HACK(theis): delayed import necessary to avoid
        // failure on startup if the browser does not support the Web MIDI API
        const midiOutImplementation: typeof MidiOut = require('./midiOut');
        const midiInImplementation: typeof MidiIn = require('./midiIn');
        if ( configuration['insert_advanced_controls'] && configuration['osmd'] ) {
            midiOutImplementation.render();
        }
        else if ( configuration['insert_advanced_controls'] && configuration['spectrogram'] ) {
            midiInImplementation.render();
        }}
    );

    let sheetLocator: SheetLocator;
    $(() => {
        let mainPanel = document.getElementById('main-panel');

        let spinnerElem = insertLoadingSpinner(mainPanel);

        if (configuration['osmd']) {

            let allowOnlyOneFermata: boolean = configuration['allow_only_one_fermata'];
            /*
            * Create a container element for OpenSheetMusicDisplay...
            */
            let osmdContainerContainer = <HTMLElement>document.createElement("div");
            osmdContainerContainer.id = 'osmd-container-container';
            osmdContainerContainer.setAttribute('data-simplebar', "");
            osmdContainerContainer.setAttribute('data-simplebar-auto-hide', "false");
            mainPanel.appendChild(osmdContainerContainer);
            let osmdContainer: HTMLElement;
            osmdContainer = <HTMLElement>document.createElement("div");
            osmdContainer.id = 'osmd-container';
            osmdContainerContainer.appendChild(osmdContainer);
            $(() => {
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
                    loadMusicXMLandMidi(sheetPlaybackManager, sheetLocator, serverUrl, generationCommand);
                }

                let autoResize: boolean = false;
                sheetLocator = new SheetLocator(osmdContainer,
                    {autoResize: autoResize,
                        drawingParameters: "compact",
                        drawPartNames: false
                    },
                    granularities_quarters.map((num) => {return parseInt(num, 10);}),
                    configuration['annotation_types'],
                    allowOnlyOneFermata,
                    onClickTimestampBoxFactory,
                    copyTimecontainerContent
                );
                locator = sheetLocator;
                // TODO(theis): check proper way of enforcing subtype
                sheetPlaybackManager = new SheetPlaybackManager(sheetLocator);
                playbackManager = sheetPlaybackManager;
                PlaybackCommands.setPlaybackManager(sheetPlaybackManager);
                registerZoomTarget(sheetLocator);

                if (configuration['use_chords_instrument']) {
                sheetPlaybackManager.scheduleChordsPlayer(sheetLocator,
                    configuration['chords_midi_channel']);
                }
                $(() => {
                    // requesting the initial sheet, so can't send any sheet along
                    const sendSheetWithRequest = false;
                    loadMusicXMLandMidi(sheetPlaybackManager, sheetLocator, serverUrl,
                    'generate', sendSheetWithRequest).then(() => {
                        spinnerElem.style.visibility = 'hidden';
                        mainPanel.classList.remove('loading');
                    });
                });
            });
        }
        else if (configuration['spectrogram']) {
            let spectrogramContainerElem = document.createElement('div');
            spectrogramContainerElem.id = 'spectrogram-container';
            mainPanel.appendChild(spectrogramContainerElem);

            let spectrogramImageContainerElem = document.createElement('div');
            spectrogramImageContainerElem.id = 'spectrogram-image-container';
            spectrogramImageContainerElem.toggleAttribute('data-simplebar', true);
            spectrogramImageContainerElem.setAttribute('data-simplebar-click-on-track', "false");
            // spectrogramImageContainerElem.setAttribute('data-simplebar-auto-hide', "false");
            // spectrogramImageContainerElem.setAttribute('force-visible', 'x');
            spectrogramContainerElem.appendChild(spectrogramImageContainerElem);

            let spectrogramPictureElem = document.createElement('picture');
            spectrogramPictureElem.id = 'spectrogram-picture';
            spectrogramImageContainerElem.appendChild(spectrogramPictureElem);
            let spectrogramImageElem = document.createElement('img');
            spectrogramImageElem.id = 'spectrogram-image';
            spectrogramPictureElem.appendChild(spectrogramImageElem);
            let spectrogramSnapPointsElem = document.createElement('div');
            spectrogramSnapPointsElem.id = 'snap-points';
            spectrogramPictureElem.appendChild(spectrogramSnapPointsElem);

            let spectrogramLocator = new SpectrogramLocator(spectrogramContainerElem);

            spectrogramPlaybackManager = new SpectrogramPlaybackManager(spectrogramLocator);
            playbackManager = spectrogramPlaybackManager;
            locator = spectrogramLocator;
            PlaybackCommands.setPlaybackManager(spectrogramPlaybackManager);

            const sendCodesWithRequest = false;
            const initial_command = ('?pitch=' + getMidiPitch().toString()
                + '&instrument_family_str=' + instrumentSelect.value
                + '&layer=' + vqvaeLayerSelect.value.split('-')[0]
                + '&temperature=1'
                + '&duration_top=4');

            loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                'sample-from-dataset' + initial_command, sendCodesWithRequest)
                .then(() => {
                    enableChanges();
                    mapTouchEventsToMouseSimplebar();
                    // HACK, TODO(theis): should not be necessary, since there is already
                    // a refresh operation at the end of the loadAudioAndSpectrogram method
                    // but this has to be done on the initial call since the SpectrogramLocator
                    // only gets initialized in that call
                    // should properly initialize the SpectrogramLocator on instantiation
                    spectrogramPlaybackManager.Locator.refresh();
                });
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
        newConditioning_value.set('pitch', getMidiPitch())
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

    function getCurrentSpectrogramPositionTopLayer(): number {
        const spectrogramImageContainerElem = document.getElementById('spectrogram-image-container');
        const scrollElem = spectrogramImageContainerElem.getElementsByClassName('simplebar-content-wrapper')[0];
        const isScrollable: boolean = (scrollElem.scrollWidth - scrollElem.clientWidth) > 0;
        if (!isScrollable) {
            return 0
        }
        else {
            const currentScrollRatio = scrollElem.scrollLeft / (scrollElem.scrollWidth - scrollElem.clientWidth);
            const numSnapElems: number = document.getElementById('snap-points').getElementsByTagName('snap').length;
            // snaps happen on <snap>'s left boundaries
            const numSnapLocations: number = numSnapElems - 1;
            return Math.round(currentScrollRatio * numSnapLocations);
        }
    }

    if ( configuration['spectrogram'] ) {
        $(() => {
            let regenerationCallback = (
                (v) => {
                    let mask = spectrogramPlaybackManager.Locator.mask;
                    let startIndexTop: number = getCurrentSpectrogramPositionTopLayer();

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
                    let generationParameters = ('?pitch=' + getMidiPitch().toString()
                        + '&instrument_family_str=' + instrumentSelect.value
                        + '&layer=' + vqvaeLayerSelect.value.split('-')[0]
                        + '&temperature=1'
                        + '&eraser_amplitude=0.1'
                        + '&start_index_top=' + startIndexTop);
                    const split_tool_select = vqvaeLayerSelect.value.split('-')
                    let command: string;
                    if ( split_tool_select.length >= 2 ) {
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
                    }
                    else {
                        throw EvalError;
                    }

                    generationParameters += '&uniform_sampling=' + (
                        ( split_tool_select.length == 3 && split_tool_select[2] == 'random' )
                    ).toString();

                    loadAudioAndSpectrogram(spectrogramPlaybackManager, serverUrl,
                        command + generationParameters, sendCodesWithRequest, mask);
                }
            )
            spectrogramPlaybackManager.Locator.registerCallback(regenerationCallback);
        });
    };

    $(() => {
        const playbackCommandsGridspan = document.getElementById('playback-commands-gridspan')
        PlaybackCommands.render(playbackCommandsGridspan);
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

    function getChordLabels(sheetLocator: SheetLocator): object[] {
        // return a stringified JSON object describing the current chords
        let chordLabels = [];
        for (let chordSelector of sheetLocator.chordSelectors) {
            chordLabels.push(chordSelector.currentChord);
        };
        return chordLabels;
    };

    function getMetadata(sheetLocator: SheetLocator) {
        return {
            fermatas: getFermatas(),
            chordLabels: getChordLabels(sheetLocator)
        }
    }


    function onClickTimestampBoxFactory(timeStart: Fraction, timeEnd: Fraction) {
        // FIXME(theis) hardcoded 4/4 time-signature
        const [timeRangeStart_quarter, timeRangeEnd_quarter] = ([timeStart, timeEnd].map(
            timeFrac => Math.round(4 * timeFrac.RealValue)))

        const argsGenerationUrl = ("timerange-change" +
            `?time_range_start_quarter=${timeRangeStart_quarter}` +
            `&time_range_end_quarter=${timeRangeEnd_quarter}`
        );

        if ( configuration['osmd'] ) {
            return (function (this, _) {
                loadMusicXMLandMidi(sheetPlaybackManager, sheetLocator, serverUrl, argsGenerationUrl);});
        } else if ( configuration['spectrogram'] ) {
            const sendCodesWithRequest: boolean = true;
            return (function (this, _) {
                loadAudioAndSpectrogram(spectrogramPlaybackManager,
                    serverUrl, argsGenerationUrl, sendCodesWithRequest);
                });
        }
    }

    // TODO don't create globals like this
    const serializer = new XMLSerializer();
    const parser = new DOMParser();
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
        downloadButton.content = audioBlob;

        return spectrogramPlaybackManager.loadAudio(blobUrl).then(() => {
            downloadButton.targetURL = blobUrl;
        });
    };

    async function updateSpectrogramImage(imageBlob: Blob): Promise<void> {
        return new Promise((resolve, _) => {
            const blobUrl = URL.createObjectURL(imageBlob);
            downloadButton.imageContent = imageBlob;
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
            spectrogramPlaybackManager.Locator.clear();
            enableChanges();
            return
        }

        currentCodes_top = newCodes_top;
        currentCodes_bottom = newCodes_bottom;
        currentConditioning_top = newConditioning_top;
        currentConditioning_bottom = newConditioning_bottom;

        spectrogramPlaybackManager.Locator.vqvaeTimestepsTop = currentCodes_top[0].length;
        triggerInterfaceRefresh();
        spectrogramPlaybackManager.Locator.clear();
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
                    '?pitch=' + getMidiPitch().toString()
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
            spectrogramPlaybackManager.Locator.clear();
            enableChanges();
            return
        }

        currentCodes_top = newCodes_top;
        currentCodes_bottom = newCodes_bottom;
        currentConditioning_top = newConditioning_top;
        currentConditioning_bottom = newConditioning_bottom;

        spectrogramPlaybackManager.Locator.vqvaeTimestepsTop = currentCodes_top[0].length;
        triggerInterfaceRefresh();
        spectrogramPlaybackManager.Locator.clear();
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

    /**
     * Load a MusicXml file via xhttp request, and display its contents.
     */
    function loadMusicXMLandMidi(playbackManager: SheetPlaybackManager,
            sheetLocator: SheetLocator,
            serverURL: string, generationCommand: string,
            sendSheetWithRequest: boolean = true) {
        return new Promise<void>((resolve, _) => {
            disableChanges();

            let payload_object = getMetadata(sheetLocator);

            log.trace('Metadata:');
            log.trace(JSON.stringify(getMetadata(sheetLocator)));

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
                    const zoom = sheetLocator.sheet.Zoom;
                    sheetLocator.sheet.load(currentXML).then(
                        async () => {
                            // restore pre-load zoom level
                            sheetLocator.sheet.Zoom = zoom;
                            sheetLocator.render();

                            let sequenceDuration = Tone.Time(
                                `0:${sheetLocator.sequenceDuration_quarters}:0`)
                            const midiBlobURL = await playbackManager.loadMidi(url.resolve(serverURL, '/musicxml-to-midi'),
                                currentXML,
                                Tone.Time(sequenceDuration),
                                bpmControl
                            );
                            downloadButton.revokeBlobURL();
                            downloadButton.targetURL = midiBlobURL;

                            enableChanges();
                            resolve();
                        },
                        (err) => {log.error(err); enableChanges()}
                    );
                }
            }
            ).done(() => {}
            ).fail((err) => {log.error(err); enableChanges()})

        })
    };

    if ( configuration['osmd'] ) {
        $(() => {
            const bottomControlsGridElem = document.getElementById('bottom-controls');
            const instrumentsGridElem = document.createElement('div');
            instrumentsGridElem.id = 'instruments-grid';
            instrumentsGridElem.classList.add('two-columns');
            bottomControlsGridElem.appendChild(instrumentsGridElem);

            ControlLabels.createLabel(instrumentsGridElem, 'instruments-grid-label');

            Instruments.initializeInstruments();
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
                let useSimpleSlider: boolean = !configuration['insert_advanced_controls'];
                const bottomControlsGridElem = document.getElementById('bottom-controls');
                bpmControl = new BPMControl(bottomControlsGridElem, 'bpm-control');
                bpmControl.render(useSimpleSlider, 200);

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
            createWavInput(() => loadMusicXMLandMidi(
                sheetPlaybackManager, sheetLocator, serverUrl, 'get-musicxml'))
    }});

    $(() => {
        let isAdvancedControl = true;
        let bottomControlsGridElem = document.getElementById('bottom-controls')
        let defaultFilename: filenameType;
        if ( configuration['spectrogram'] ) {
            defaultFilename = {name: 'notono', extension: '.wav'}
        }
        else if ( configuration['osmd'] ) {
            defaultFilename = {name: 'nonoto', extension: '.mid'}
        }

        const downloadCommandsGridspan = document.createElement('div');
        downloadCommandsGridspan.id = 'download-button-gridspan';
        downloadCommandsGridspan.classList.add('gridspan');
        downloadCommandsGridspan.classList.toggle('advanced', isAdvancedControl);
        bottomControlsGridElem.appendChild(downloadCommandsGridspan);
        downloadButton = new DownloadButton(
            downloadCommandsGridspan, defaultFilename, isAdvancedControl);

        if ( COMPILE_ELECTRON ) {
            ControlLabels.createLabel(bottomControlsGridElem, 'download-button-label',
                isAdvancedControl, 'download-button-label-with-native-drag',
                downloadButton.container);
            }
        else {
            ControlLabels.createLabel(bottomControlsGridElem, 'download-button-label',
                isAdvancedControl, null, downloadButton.container);
        }
    });

    $(() => {
        }
    }
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
            renderZoomControls(zoomControlsGridElem,
                new Promise((resolve) => {resolve(sheetLocator)}));
        }
        );
    }

    $(() => {
        // register file drop handler
        document.body.addEventListener('drop', dropHandler);
    })

    $(() => {
        if (configuration['spectrogram'] ) {
            const isAdvancedControl: boolean = true;
            const bottomControlsGridElem = document.getElementById('bottom-controls');
            const volumeControlsGridElement: HTMLElement = document.createElement('div');
            volumeControlsGridElement.id = 'volume-controls-gridspan'
            volumeControlsGridElement.classList.add('gridspan');
            volumeControlsGridElement.classList.toggle('advanced', isAdvancedControl);
            bottomControlsGridElem.appendChild(volumeControlsGridElement);

            const fadeInControlElement: HTMLElement = document.createElement('control-item');
            fadeInControlElement.id = 'fade-in-control';
            fadeInControlElement.classList.toggle('advanced', isAdvancedControl);
            volumeControlsGridElement.appendChild(fadeInControlElement);
            SpectrogramPlayback.renderFadeInControl(fadeInControlElement,
                spectrogramPlaybackManager);
            ControlLabels.createLabel(fadeInControlElement, 'fade-in-control-label',
                isAdvancedControl, null, volumeControlsGridElement);

            const gainControlElement: HTMLElement = document.createElement('control-item');
            gainControlElement.id = 'gain-control';
            gainControlElement.classList.toggle('advanced', isAdvancedControl);
            volumeControlsGridElement.appendChild(gainControlElement);
            SpectrogramPlayback.renderGainControl(gainControlElement,
                spectrogramPlaybackManager);
            ControlLabels.createLabel(gainControlElement, 'gain-control-label',
                isAdvancedControl, null, volumeControlsGridElement);
        }
    });

    $(() => {
        if (configuration["insert_help"]) {
            let helpTrip: myTrip;
            if  (configuration["spectrogram"]) {
                // initialize help menu
                helpTrip = new NotonoTrip(
                    [configuration["main_language"]],
                    spectrogramPlaybackManager.Locator,
                    REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : null
                );
            }
            else if (configuration["osmd"]) {
                // initialize help menu
                helpTrip = new NonotoTrip(
                    [configuration["main_language"]],
                    sheetLocator,
                    REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : null
                );
            }

            helpTrip.renderIcon(document.getElementById('main-panel'));
        }
    })
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
});

function mapTouchEventsToMouseSimplebar(): void {
    // enables using touch events to drag the simplebar scrollbar
    // tweaked version of this initial proposition:
    // https://github.com/Grsmto/simplebar/issues/156#issuecomment-376137543
    const target = $('[data-simplebar]')[0];
    function mapTouchEvents(event: TouchEvent, simulatedType: string) {
        //Ignore any mapping if more than 1 fingers touching
        if(event.changedTouches.length>1){return;}

        const touch = event.changedTouches[0];

        const eventToSimulate = new MouseEvent(simulatedType,
            {
                bubbles: true,
                cancelable: false,
                view: window,
                detail: 1,
                screenX: touch.screenX,
                screenY: touch.screenY,
                clientX: touch.clientX,
                clientY: touch.clientY,
                ctrlKey: false,
                altKey: false,
                shiftKey: false,
                metaKey: false,
                button: 0
            }
        );

        touch.target.dispatchEvent(eventToSimulate);
    }

    const addEventListenerOptions: AddEventListenerOptions = {
        capture: true
    };
    target.addEventListener('touchstart', function(e){
            // required to trigger an update of the mouse position stored by simplebar,
            // emulates moving the mouse onto the scrollbar THEN clicking,
            // otherwise simplebar uses the last clicked/swiped position, usually outside of the
            // scrollbar and therefore considers that the click happened outside of the bar
            mapTouchEvents(e, 'mousemove');
            mapTouchEvents(e, 'mousedown');
        },
        addEventListenerOptions
    );
    target.addEventListener('touchmove', function(e){
            mapTouchEvents(e, 'mousemove');
        },
        addEventListenerOptions
    );
    target.addEventListener('touchend', function(e){
            mapTouchEvents(e, 'mouseup');
        },
        addEventListenerOptions
    );
    target.addEventListener('touchcancel', function(e){
            mapTouchEvents(e, 'mouseup');
        },
        addEventListenerOptions
    );
}

if ( module.hot ) {
    module.hot.accept('./sheetPlayback', () => {
        if ( appConfiguration['osmd'] ) {
            const newSheetPlaybackManager: typeof SheetPlaybackManager = require('./sheetPlayback').default
            console.log("Accepting new SheetPlayback Manager")
            sheetPlaybackManager.dispose().then(() => {
                sheetPlaybackManager = new newSheetPlaybackManager(<SheetLocator>locator);
            })
        }
    })

}
