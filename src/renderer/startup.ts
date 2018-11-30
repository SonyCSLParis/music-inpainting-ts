// start-up module offering a splash screen inj which to select the configuration
let Nexus = require('./nexusColored')

// defined at compile-time via webpack.DefinePlugin
declare var COMPILE_ELECTRON: boolean;

// via https://stackoverflow.com/a/17632779/
function cloneJSON(obj: object): object {
    return JSON.parse(JSON.stringify(obj));
}

let defaultConfiguration: object = require('../common/config.json');

// TODO don't create modes like this (goes again 12 Factor App principles)
// should have truely orthogonal configuration options
let choraleConfiguration: object = cloneJSON(defaultConfiguration);
choraleConfiguration["use_chords_instrument"] = false;
choraleConfiguration["annotation_types"] = ["fermata"];

let leadsheetConfiguration: object = cloneJSON(defaultConfiguration);
leadsheetConfiguration["use_chords_instrument"] = true;
leadsheetConfiguration["annotation_types"] = ["chord_selector"];

export function render(renderPage: (configuration: object) => void): void {
    let configurationWindow = document.createElement('div');
    configurationWindow.id = 'configuration-selection';
    document.body.appendChild(configurationWindow);

    // let configurationForm: HTMLFormElement = document.createElement('form');

    let serverIpInput: HTMLInputElement = document.createElement('input');
    serverIpInput.type = 'url';
    serverIpInput.id = 'server-ip-input';
    serverIpInput.placeholder = `Server IP (default: ${defaultConfiguration['server_ip']})`;
    configurationWindow.appendChild(serverIpInput);

    let serverPortInput: HTMLInputElement = document.createElement('input');
    serverPortInput.type = 'url';
    serverPortInput.id = 'server-port-input';
    serverPortInput.placeholder = `Server port (default: ${defaultConfiguration['server_port']})`;
    configurationWindow.appendChild(serverPortInput);

    // let serverUrlInputLabel: HTMLLabelElement = document.createElement('label');
    // serverUrlInputLabel.setAttribute('for', 'server-url-input');
    //

    let deepbachButtonElem: HTMLElement = document.createElement('div');
    deepbachButtonElem.id = 'deepbach-configuration-button'
    configurationWindow.appendChild(deepbachButtonElem);

    let applicationModeSelectElem: HTMLSelectElement = document.createElement('select');
    applicationModeSelectElem = document.createElement('select');
    applicationModeSelectElem.style.visibility = 'hidden';
    applicationModeSelectElem.id = 'application-mode-select';
    configurationWindow.appendChild(applicationModeSelectElem);

    let applicationModes: string[] = ['chorale', 'leadsheet'];
    for (let applicationModeIndex=0, numModes=applicationModes.length;
        applicationModeIndex<numModes; applicationModeIndex++) {
        const applicationMode = applicationModes[applicationModeIndex];
        let applicationModeOptionElem = document.createElement('option');
        applicationModeOptionElem.value = applicationMode;
        applicationModeSelectElem.appendChild(applicationModeOptionElem);
    }

    let deepbachbutton = new Nexus.TextButton('#deepbach-configuration-button', {
        'size': [150,50],
        'state': true,
        'text': 'Chorales',
        'alternateText': 'Chorales',
        // 'alternate': true
    });

    deepbachbutton.on('change', () => {
        deepbachbutton.turnOn(false);
        deepsheetbutton.turnOff(false);
        applicationModeSelectElem.value = 'chorale';
    });

    let deepsheetButtonElem: HTMLElement = document.createElement('div');
    deepsheetButtonElem.id = 'deepsheet-configuration-button'
    configurationWindow.appendChild(deepsheetButtonElem);

    let deepsheetbutton = new Nexus.TextButton('#deepsheet-configuration-button', {
        'size': [150,50],
        'state': false,
        'text': 'Leadsheets',
        'alternateText': 'Leadsheets',
        // 'alternate': true
    });

    deepsheetbutton.on('change', () => {
        deepsheetbutton.turnOn(false);
        deepbachbutton.turnOff(false);
        applicationModeSelectElem.value = 'leadsheet';
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
        }
        if (serverIpInput.value.length > 0) {
            configuration['use_local_server'] = false;
            configuration['server_ip'] = serverIpInput.value;
        }
        if (serverPortInput.value.length > 0) {
            configuration['use_local_server'] = false;
            configuration['server_port'] = serverPortInput.value;
        }

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
