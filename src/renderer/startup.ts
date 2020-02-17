// start-up module offering a splash screen in which to select the configuration
import * as Tone from 'tone';
import * as StartAudioContext from 'startaudiocontext';

let Nexus = require('./nexusColored');

import '../common/styles/startupSplash.scss';

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;

// via https://stackoverflow.com/a/17632779/
function cloneJSON(obj: object): object {
    return JSON.parse(JSON.stringify(obj));
}

let defaultConfiguration: object = require('../common/config.json');

// TODO don't create modes like this (goes against 12 Factor App principles)
// should have truely orthogonal configuration options
let osmdConfiguration: object = cloneJSON(defaultConfiguration);
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

let spectrogramConfiguration: object = cloneJSON(defaultConfiguration);
spectrogramConfiguration['osmd'] = false;
spectrogramConfiguration['spectrogram'] = true;

export function render(renderPage: (configuration: object) => void): void {
    let configurationWindow = document.createElement('div');
    configurationWindow.id = 'configuration-selection';
    document.body.appendChild(configurationWindow);

    // let configurationForm: HTMLFormElement = document.createElement('form');

    let serverConfigElem: HTMLDivElement = document.createElement('div');
    serverConfigElem.id = 'server-configuration';
    configurationWindow.appendChild(serverConfigElem);

    let serverIpInput: HTMLInputElement = document.createElement('input');
    serverIpInput.type = 'url';
    serverIpInput.id = 'server-ip-input';
    serverIpInput.placeholder = `Server IP (default: ${defaultConfiguration['server_ip']})`;
    serverConfigElem.appendChild(serverIpInput);

    let serverPortInput: HTMLInputElement = document.createElement('input');
    serverPortInput.type = 'url';
    serverPortInput.id = 'server-port-input';
    serverPortInput.placeholder = `Server port (default: ${defaultConfiguration['server_port']})`;
    serverConfigElem.appendChild(serverPortInput);

    // let serverUrlInputLabel: HTMLLabelElement = document.createElement('label');
    // serverUrlInputLabel.setAttribute('for', 'server-url-input');
    //

    let modeConfigElem: HTMLDivElement = document.createElement('div');
    modeConfigElem.id = 'mode-configuration';
    configurationWindow.appendChild(modeConfigElem);

    let applicationModeSelectElem: HTMLSelectElement = document.createElement('select');
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

    let deepbachButtonElem: HTMLElement = document.createElement('div');
    deepbachButtonElem.id = 'deepbach-configuration-button'
    modeConfigElem.appendChild(deepbachButtonElem);

    let deepbachbutton = new Nexus.TextButton('#deepbach-configuration-button', {
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

    let deepsheetButtonElem: HTMLElement = document.createElement('div');
    deepsheetButtonElem.id = 'deepsheet-configuration-button'
    modeConfigElem.appendChild(deepsheetButtonElem);

    let deepsheetbutton = new Nexus.TextButton('#deepsheet-configuration-button', {
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

    let deepfolkButtonElem: HTMLElement = document.createElement('div');
    deepfolkButtonElem.id = 'deepfolk-configuration-button'
    modeConfigElem.appendChild(deepfolkButtonElem);

    let deepfolkbutton = new Nexus.TextButton('#deepfolk-configuration-button', {
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

    let spectrogrambuttonElem: HTMLElement = document.createElement('div');
    spectrogrambuttonElem.id = 'spectrograms-configuration-button'
    modeConfigElem.appendChild(spectrogrambuttonElem);

    let spectrogrambutton = new Nexus.TextButton('#spectrograms-configuration-button', {
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

    if (COMPILE_ELECTRON && false){
        // open native file system 'open-file' dialog

        let customButtonElem: HTMLElement = document.createElement('div');
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

    let startButtonElem: HTMLElement = document.createElement('div');
    startButtonElem.id = 'start-button';
    configurationWindow.appendChild(startButtonElem);

    let startButton = new Nexus.TextButton('#start-button',{
        'size': [150,50],
        'state': false,
        'text': 'Start',
        'alternateText': true
    });

    StartAudioContext(Tone.context, startButtonElem.id);

    startButton.on('change', () => {
        let applicationMode = applicationModeSelectElem.value;
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
        if (serverIpInput.value.length > 0) {
            configuration['use_local_server'] = false;
            configuration['server_ip'] = serverIpInput.value;
        }
        if (serverPortInput.value.length > 0) {
            configuration['use_local_server'] = false;
            configuration['server_port'] = serverPortInput.value;
        }

        // clean-up the splash screen
        dispose();

        $(() => {
            renderPage(configuration);
        });
    })
}

function dispose() {
    if (document.getElementById("configuration-selection")) {
        document.getElementById("configuration-selection").remove();
    }
}