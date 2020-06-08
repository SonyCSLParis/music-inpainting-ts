// start-up module offering a splash screen in which to select the configuration
// this menu also allows to properly start the AudioContext upon the user
// clicking on the start button
import * as Tone from 'tone';

let Nexus = require('./nexusColored');

import '../common/styles/startupSplash.scss';

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;
declare const DEFAULT_SERVER_IP: string;
declare const DEFAULT_SERVER_PORT: string;
declare const ENABLE_ANONYMOUS_MODE: boolean;

// via https://stackoverflow.com/a/17632779/
function cloneJSON(obj: object): object {
    return JSON.parse(JSON.stringify(obj));
}

import defaultConfiguration from '../common/default_config.json';
defaultConfiguration['server_ip'] = DEFAULT_SERVER_IP;
defaultConfiguration['server_port'] = DEFAULT_SERVER_PORT;
import customConfiguration from '../../config.json';
let globalConfiguration = {...defaultConfiguration, ...customConfiguration};

// TODO don't create modes like this (goes against 12 Factor App principles)
// should have truly orthogonal configuration options
let osmdConfiguration: object = cloneJSON(globalConfiguration);
osmdConfiguration['osmd'] = true;
osmdConfiguration['spectrogram'] = false;

let choraleConfiguration: object = cloneJSON(osmdConfiguration);
choraleConfiguration["use_chords_instrument"] = false;
choraleConfiguration["annotation_types"] = ["fermata"];

let leadsheetConfiguration: object = cloneJSON(osmdConfiguration);
leadsheetConfiguration["use_chords_instrument"] = true;
leadsheetConfiguration["annotation_types"] = ["chord_selector"];

let folkConfiguration: object = cloneJSON(osmdConfiguration);
folkConfiguration["use_chords_instrument"] = false;
folkConfiguration["annotation_types"] = [];
folkConfiguration["granularities_quarters"] = ["1", "4", "8", "16"];

let spectrogramConfiguration: object = cloneJSON(globalConfiguration);
spectrogramConfiguration['osmd'] = false;
spectrogramConfiguration['spectrogram'] = true;
spectrogramConfiguration['app_name'] = 'notono';
spectrogramConfiguration['acids_logo'] = true;


if ( ENABLE_ANONYMOUS_MODE ) {
    spectrogramConfiguration['app_name'] = 'VQ-Inpainting';
    spectrogramConfiguration['sony_logo'] = false;
    spectrogramConfiguration['acids_logo'] = false;
    document.body.classList.add('anonymous-mode');
}


export function render(renderPage: (configuration: object) => void): void {
    let configurationWindow = document.createElement('div');
    configurationWindow.classList.add('centeredXY');
    configurationWindow.id = 'configuration-selection';
    document.body.appendChild(configurationWindow);

    let serverConfigElem: HTMLDivElement;
    let serverIpContainer: HTMLDivElement;
    let serverIpInput: HTMLInputElement;
    let serverPortContainer: HTMLDivElement;
    let serverPortInput: HTMLInputElement;
    if ( !globalConfiguration['disable_server_parameters_input'] ) {
        serverConfigElem = document.createElement('div');
        serverConfigElem.id = 'server-configuration';
        configurationWindow.appendChild(serverConfigElem);

        serverIpContainer = document.createElement('div');
        serverIpContainer.id = 'server-ip-container';
        serverConfigElem.appendChild(serverIpContainer);
        serverIpInput = document.createElement('input');
        serverIpInput.type = 'url';
        serverIpInput.id = 'server-ip-input';
        serverIpInput.placeholder = `${globalConfiguration['server_ip']}`;
        serverIpContainer.appendChild(serverIpInput);

        serverPortContainer = document.createElement('div');
        serverPortContainer.id = 'server-port-container';
        serverConfigElem.appendChild(serverPortContainer);
        serverPortInput = document.createElement('input');
        serverPortInput.type = 'url';
        serverPortInput.id = 'server-port-input';
        serverPortInput.placeholder = `${globalConfiguration['server_port']}`;
        serverPortContainer.appendChild(serverPortInput);
    }

    // let serverUrlInputLabel: HTMLLabelElement = document.createElement('label');
    // serverUrlInputLabel.setAttribute('for', 'server-url-input');
    //

    let modeConfigElem: HTMLDivElement;
    let applicationModeSelectElem: HTMLSelectElement;
    if (!globalConfiguration['spectrogram_only']) {
        modeConfigElem = document.createElement('div');
        modeConfigElem.id = 'mode-configuration';
        configurationWindow.appendChild(modeConfigElem);

        applicationModeSelectElem = document.createElement('select');
        applicationModeSelectElem.style.visibility = 'hidden';
        applicationModeSelectElem.id = 'application-mode-select';
        configurationWindow.appendChild(applicationModeSelectElem);

        let applicationModes: string[] = ['chorale', 'leadsheet', 'folk', 'spectrogram'];
        for (let applicationModeIndex=0, numModes=applicationModes.length;
            applicationModeIndex<numModes; applicationModeIndex++) {
            const applicationMode = applicationModes[applicationModeIndex];
            let applicationModeOptionElem = document.createElement('option');
            applicationModeOptionElem.value = applicationMode;
            applicationModeSelectElem.appendChild(applicationModeOptionElem);
        }

        let deepbachbutton;
        let deepfolkbutton;
        let deepsheetbutton;
        let spectrogrambutton;

        let deepbachButtonElem: HTMLElement = document.createElement('control-item');
        deepbachButtonElem.id = 'deepbach-configuration-button'
        modeConfigElem.appendChild(deepbachButtonElem);

        deepbachbutton = new Nexus.TextButton('#deepbach-configuration-button', {
            'size': [150,50],
            'state': true,
            'text': 'Chorales',
            'alternateText': 'Chorales'
        });

        deepbachbutton.on('change', () => {
            deepbachbutton.turnOn(false);
            deepsheetbutton.turnOff(false);
            deepfolkbutton.turnOff(false);
            spectrogrambutton.turnOff(false);
            applicationModeSelectElem.value = 'chorale';
        });

        let deepsheetButtonElem: HTMLElement = document.createElement('control-item');
        deepsheetButtonElem.id = 'deepsheet-configuration-button'
        modeConfigElem.appendChild(deepsheetButtonElem);

        deepsheetbutton = new Nexus.TextButton('#deepsheet-configuration-button', {
            'size': [150,50],
            'state': false,
            'text': 'Leadsheets',
            'alternateText': 'Leadsheets'
        });

        deepsheetbutton.on('change', () => {
            deepsheetbutton.turnOn(false);
            deepbachbutton.turnOff(false);
            deepfolkbutton.turnOff(false);
            spectrogrambutton.turnOff(false);
            applicationModeSelectElem.value = 'leadsheet';
        });

        let deepfolkButtonElem: HTMLElement = document.createElement('control-item');
        deepfolkButtonElem.id = 'deepfolk-configuration-button'
        modeConfigElem.appendChild(deepfolkButtonElem);

        deepfolkbutton = new Nexus.TextButton('#deepfolk-configuration-button', {
            'size': [150,50],
            'state': false,
            'text': 'Folk songs',
            'alternateText': 'Folk songs'
        });

        deepfolkbutton.on('change', () => {
            deepfolkbutton.turnOn(false);
            deepsheetbutton.turnOff(false);
            deepbachbutton.turnOff(false);
            spectrogrambutton.turnOff(false);
            applicationModeSelectElem.value = 'folk';
        });

        let spectrogrambuttonElem: HTMLElement = document.createElement('control-item');
        spectrogrambuttonElem.id = 'spectrograms-configuration-button'
        modeConfigElem.appendChild(spectrogrambuttonElem);

        spectrogrambutton = new Nexus.TextButton('#spectrograms-configuration-button', {
            'size': [150,50],
            'state': false,
            'text': 'Spectrograms',
            'alternateText': 'Spectrograms'
        });

        spectrogrambutton.on('change', () => {
            spectrogrambutton.turnOn(false);
            deepfolkbutton.turnOff(false);
            deepsheetbutton.turnOff(false);
            deepbachbutton.turnOff(false);
            applicationModeSelectElem.value = 'spectrogram';
        });
    }

    if (COMPILE_ELECTRON && false){
        // open native file system 'open-file' dialog

        let customButtonElem: HTMLElement = document.createElement('control-item');
        customButtonElem.id = 'custom-configuration-button'
        configurationWindow.appendChild(customButtonElem);

        // create HTML element to upload configuration file
        let customConfigurationInput: HTMLInputElement = document.createElement('input');
        customConfigurationInput.type = 'file';
        customConfigurationInput.id = 'configuration-input';
        customConfigurationInput.accept = 'application/json';
        configurationWindow.appendChild(customConfigurationInput);

        let custombutton = new Nexus.TextButton('#custom-configuration-button',{
            'size': [150,50],
            'state': false,
            'text': 'Custom (load json) (check GitHub repository for example JSON)',
            'alternateText': false
        });

        custombutton.on('change', () => {
            customConfigurationInput.click();
        });
    }

    function getCurrentConfiguration() {
        let applicationMode: string;
        if (!globalConfiguration['spectrogram_only']) {
            applicationMode = applicationModeSelectElem.value;
        }
        else {
            applicationMode = 'spectrogram';
        }
        let configuration;
        switch (applicationMode) {
            case 'chorale':
                configuration = choraleConfiguration;
                break;
            case 'leadsheet':
                configuration = leadsheetConfiguration;
                break;
            case 'folk':
                configuration = folkConfiguration;
                break;
            case 'spectrogram':
                configuration = spectrogramConfiguration;
                break;
        }
        if ( !globalConfiguration['disable_server_input'] ) {
            if ( serverIpInput.value.length > 0 ) {
                configuration['server_ip'] = serverIpInput.value;
            };
            if ( serverPortInput.value.length > 0 ) {
                configuration['server_port'] = serverPortInput.value;
            };
        }

        return configuration;
    }

    function disposeAndStart() {
        // clean-up the splash screen
        dispose();
        renderPage(getCurrentConfiguration());
    }

    async function renderStartButton() {
        let startButtonElem: HTMLElement = document.createElement('control-item');
        startButtonElem.id = 'start-button';
        configurationWindow.appendChild(startButtonElem);

        let startButton = new Nexus.TextButton('#start-button', {
            'size': [150,50],
            'state': false,
            'text': 'Start',
            // required to put the button in 'toggle' mode
            'alternateText': 'Start',
        });

        startButton.on('change', async () => {
            await Tone.start();
            disposeAndStart();
        });
    }

    if ( globalConfiguration['insert_recaptcha'] ) {
        // load recaptcha library asynchronously
        let recaptcha_script: HTMLScriptElement = document.createElement('script');
        recaptcha_script.src = "https://www.google.com/recaptcha/api.js";
        recaptcha_script.defer = true;
        recaptcha_script.async = true;
        document.head.appendChild(recaptcha_script);

        async function onreceiveRecaptchaResponse(recaptchaResponse: string) {
            const jsonResponse = await verifyCaptcha(recaptchaResponse);
            if ( jsonResponse['success'] ) {
                disposeAndStart();
            }
        }

        async function verifyCaptcha(recaptchaResponse: string) {
            const jsonResponse = await $.post({
                url: globalConfiguration['recaptcha_verification_address'],
                data: JSON.stringify({
                    'recaptchaResponse': recaptchaResponse
                }),
                contentType: 'application/json',
                dataType: 'json',
            })

            return jsonResponse
        }

        let recaptchaElem: HTMLDivElement = document.createElement('div');
        recaptchaElem.id = 'g-recaptcha';
        recaptchaElem.classList.add("g-recaptcha");
        recaptchaElem.setAttribute('data-sitekey', globalConfiguration['recaptcha_sitekey']);
        recaptchaElem.setAttribute('data-theme', 'light');
        recaptchaElem.setAttribute('data-callback', 'onreceiveRecaptchaResponse');
        window['onreceiveRecaptchaResponse'] = onreceiveRecaptchaResponse.bind(this);
        configurationWindow.appendChild(recaptchaElem);
    }
    else {
        renderStartButton();
    }
}

function dispose() {
    if (document.getElementById("configuration-selection")) {
        document.getElementById("configuration-selection").remove();
    }
}
