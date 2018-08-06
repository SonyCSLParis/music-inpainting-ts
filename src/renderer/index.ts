import { ipcRenderer } from 'electron'

let link_channel_prefix: string = 'link/';
let link_initialized: boolean= false;

// import * as nipplejs from "nipplejs";
import { eOSMD } from "./locator";
import { Fraction } from 'opensheetmusicdisplay'
// import { Promise } from 'es6-promise';
import * as $ from "jquery";
import * as WebMidi from 'webmidi'
import * as MidiConvert from "midiconvert";
import {Piano} from 'tone-piano';
import * as Tone from "tone";
import { SampleLibrary } from '../common/tonejs-instruments/Tonejs-Instruments'
import * as Nexus from 'nexusui'
import * as log from 'loglevel'
import * as path from 'path';

import { createLFOControls } from './lfo'

import '../common/styles/osmd.scss'
import '../common/styles/main.scss'

// variable gets created by electron-webpack
declare var __static;

declare var ohSnap: any;
let server_config = require('../common/config.json')

let link_enabled = false;
ipcRenderer.on('numPeers', (numPeers) => {
    // this display is requested in the Ableton-link test-plan
    new Notification('DeepBach/Ableton LINK interface', {
        body: 'Number of peers changed, now ' + numPeers + ' peers'
  })
})


// add Piano methods to Tone.Insutrument objects for duck typing
Tone.Instrument.prototype.keyDown = function() {return this};
Tone.Instrument.prototype.keyUp = function() {return this};
Tone.Instrument.prototype.pedalDown = function() {return this};
Tone.Instrument.prototype.pedalUp = function() {return this};


// let raphaelimport: HTMLScriptElement = document.createElement('script')
// raphaelimport.type = 'text/javascript'
// raphaelimport.src = "https://cdn.jsdelivr.net/npm/wheelnav@1.7.1/js/dist/raphael.min.js"
// document.head.appendChild(raphaelimport)
//
// let wheelimport: HTMLScriptElement = document.createElement('script')
// wheelimport.type = 'text/javascript'
// wheelimport.src = "https://cdn.jsdelivr.net/npm/wheelnav@1.7.1/js/dist/wheelnav.min.js"
// document.head.appendChild(wheelimport)


Nexus.colors.accent = '#ffb6c1';  // '#f40081';  //  light pink
Nexus.colors.fill = '#e5f5fd';  // light blue // '#f0f2ff';  // lilac triadic to '#ffb6c1'

let topControlsGridElem: HTMLDivElement = document.createElement('div')
topControlsGridElem.id = 'top-controls'
document.body.appendChild(topControlsGridElem);

let playbuttonElem: HTMLElement = document.createElement('top-control-item');
playbuttonElem.id = 'play-button'
topControlsGridElem.appendChild(playbuttonElem);

let playbutton = new Nexus.TextButton('#play-button',{
    'size': [150,50],
    'state': false,
    'text': 'Play',
    'alternateText': 'Pause'
})
// playbutton.on('down', (e) => {playbutton.flip()}) //playCallback.bind(playbutton));
playbutton.on('change', playCallback)


let stopbuttonElem: HTMLElement = document.createElement('top-control-item');
stopbuttonElem.id = 'stop-button';
topControlsGridElem.appendChild(stopbuttonElem);

let stopbutton = new Nexus.TextButton('#stop-button',{
    'size': [150,50],
    'state': false,
    'text': 'Stop'
})
stopbutton.on('change', (event) => {
    playbutton.flip(false);
    Tone.Transport.stop();
    nowPlayingCallback(0, 0);  // update the graphics
});

document.addEventListener("keydown", (event) => {
    const keyName = event.key
    switch (keyName) {
        case ' ':
        case 'Spacebar':
        case 'p':
            playbutton.down();
            break;
        case 's':
            stopbutton.down();
            stopbutton.up();
            break
    }});

// document.body.appendChild(document.createElement("br"))

// Time-granularity selector
let granularities = ['quarter-note', 'half-note', 'whole-note']

let granularitySelectElem: HTMLElement = document.createElement('top-control-item');
granularitySelectElem.id = 'select-granularity'
topControlsGridElem.appendChild(granularitySelectElem)

let granularitySelect = new Nexus.Select('#select-granularity', {
    'size': [150, 50],
    'options': granularities,
});
(granularitySelectElem.firstElementChild as HTMLElement).style.fontSize = (
    (playbuttonElem.firstElementChild.firstElementChild as HTMLElement).style.fontSize);
function granularityOnChange(ev) {
    $('.notebox').removeClass('active');
    $('.' + this.value + '> .notebox').addClass('active');
};
granularitySelect.on('change', granularityOnChange.bind(granularitySelect))
const initialGranulatity = granularities.indexOf('whole-note').toString()
granularitySelect.selectedIndex = initialGranulatity

let insertLFO: boolean = true;
if (insertLFO) {
    createLFOControls();
}

let titlediv: HTMLDivElement = document.createElement('div')
// titlediv.classList.add('header')
titlediv.textContent = 'DeepBach'
titlediv.style.alignContent = 'CenterTop'
titlediv.style.width = '100%'
titlediv.style.fontStyle = 'bold'
titlediv.style.fontSize = '64px'
// document.body.appendChild(titlediv)

document.body.appendChild(document.createElement("div"))

let useLeadsheetMode = false;  // true for leadsheets, false for chorales
let serverPort: number
if (useLeadsheetMode) {
    serverPort = server_config['leadsheet_port']
} else {
    serverPort = server_config['chorale_port']
}
let serverIp: string;
let useLocalServer: boolean = false;
if (useLocalServer) {
    serverIp = 'localhost';
}
else {
    serverIp = server_config['server_ip'];
}
let serverUrl = `http://${serverIp}:${serverPort}/`;
// let serverUrl = `http://${server_config['server_ip']}:${serverPort}/`;

let osmd: eOSMD;
/*
 * Create a container element for OpenSheetMusicDisplay...
 */
let osmdContainer: HTMLElement = (
    <HTMLElement>document.createElement("div"));
osmdContainer.classList.add('osmd-container')
/*
 * ... and attach it to our HTML document's body. The document itself is a HTML5
 * stub created by Webpack, so you won't find any actual .html sources.
 */
document.body.appendChild(osmdContainer);
/*
 * Create a new instance of OpenSheetMusicDisplay and tell it to draw inside
 * the container we've created in the steps before. The second parameter tells OSMD
 * not to redraw on resize.
 */
osmd = new eOSMD(osmdContainer, true, useLeadsheetMode);

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

// uncomment the following for testing
//loadMusicXMLandAudio('musicXmlSample.xml', '');
loadMusicXMLandMidi(serverUrl + 'ex', serverUrl + 'get-midi');

function removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): void{
    // Strip MusicXML document of title/composer tags
    let titleNode = xmlDocument.getElementsByTagName('work-title')[0]
    let movementTitleNode = xmlDocument.getElementsByTagName('movement-title')[0]
    let composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent = ""
}

function getFermatas(): number[] {
    const activeFermataElems = $('.Fermata.active')
    let containedQuarterNotesList = [];
    for (let activeFemataElem of activeFermataElems) {
        containedQuarterNotesList.push(parseInt(
            activeFemataElem.parentElement.getAttribute('containedQuarterNotes')))
    }
    // const containedQuarterNotesList = activeFermataElems.map(
    //     function(){return this.parentElement.getAttribute('containedQuarterNotes');}).get()
    return containedQuarterNotesList;
}

function getChordLabels(): object[] {
    // return a stringified JSON object describing the current chords
    let chordLabels = [];
    for (let chordSelector of osmd.chordSelectors) {
        chordLabels.push(chordSelector.currentChord)
    };
    return chordLabels;
};

function getMetadata() {
    return {
        leadsheet: osmd.leadsheet,
        fermatas: getFermatas(),
        chordLabels: getChordLabels()
    }
}

function onClickTimestampBoxFactory(timeStart: Fraction, timeEnd: Fraction) {
    const  [quarternoteStart, quarternoteEnd] = ([timeStart, timeEnd].map(
        timeFrac => Math.round(4 * timeFrac.RealValue)))

    const argsGenerationUrl = ("timerange-change" +
        `?quarternoteStart=${quarternoteStart}` +
        `&quarternoteEnd=${quarternoteEnd}`
    );
    const argsMidiUrl = "get-midi";

    return (function (this, event) {
        loadMusicXMLandMidi(serverUrl + argsGenerationUrl,
          serverUrl + argsMidiUrl);
    ;})
}

function blockall(e) {
    // block propagation of events in bubbling/capturing
    e.stopPropagation();
    e.preventDefault();}

function toggleBusyClass(toggleBusy: boolean): void{
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
function loadMusicXMLandMidi(urlXML: string, urlMidi: string) {
    disableChanges();
    log.debug('Metadata:');
    log.debug(JSON.stringify(getMetadata()));
    $.post({
        url: urlXML,
        data: JSON.stringify(getMetadata()),
        contentType: 'application/json',
        dataType: 'xml',
        success: (xmldata: XMLDocument) => {
            removeMusicXMLHeaderNodes(xmldata);
            osmd.load(xmldata)
                .then(
                    () => {
                        osmd.render(onClickTimestampBoxFactory);
                        enableChanges()
                    },
                    (err) => {log.error(err); enableChanges()}
                );
            loadMidi(urlMidi);
            // loadMidiToPiano(urlMidi);
        }
    });
};

var silentInstrument = new Tone.Instrument()

var piano = new Piano([21, 108], 5);

var chorus = new Tone.Chorus(2, 1.5, 0.5).toMaster();
var reverb = new Tone.Reverb(1.5).connect(chorus);
reverb.generate();

var polysynth = new Tone.PolySynth(12);
polysynth.connect(reverb)

var polysynth_chords = new Tone.PolySynth(24);
polysynth_chords.connect(reverb)

let steelpan = new Tone.PolySynth(12).set({
    "oscillator": {
        "type": "fatcustom",
        "partials" : [0.2, 1, 0, 0.5, 0.1],
        "spread" : 40,
        "count" : 3},
    "envelope": {
        "attack": 0.001,
        "decay": 1.6,
        "sustain": 0,
        "release": 1.6}
    }
);
steelpan.connect(reverb);

// Manual samples loading button, to reduce network usage
let loadSamplesButtonElem: HTMLDivElement = document.createElement('div')
loadSamplesButtonElem.id = 'load-samples-button'
document.body.appendChild(loadSamplesButtonElem)

let loadSamplesButton = new Nexus.TextButton('#load-samples-button',{
    'size': [150,50],
    'state': false,
    'text': 'Load samples',
    'alternateText': 'Samples loading'
})


let sampledInstruments;  // declare variables but do not load samples yet
const sampled_instruments_names = ['organ', 'harmonium', 'xylophone'];
// for (let instrument_name of sampled_instruments_names) {
//     require.context(path.join('tonejs-instruments/samples/', instrument_name),
//         false,
//         /\.ogg$/)
// }
// require.context(path.join('tonejs-instruments/samples/xylophone'),
//     false,
//     /\.ogg$/
// )

// const staticBaseUrl = path.join(__static, 'tonejs-instruments/samples/')
loadSamplesButton.on('change', () => {
    log.info('Start downloading audio samples');
    // must disable pointer events on *child* node to also use cursor property
    (loadSamplesButtonElem.firstElementChild as HTMLElement).style.pointerEvents = 'none';
    loadSamplesButtonElem.style.cursor = 'wait';

    let loadPromises: Promise<any>[] = []
    let sampleLibraryLoadPromise = new Promise((resolve, reject) => {
        sampledInstruments = SampleLibrary.load({
                    instruments: sampled_instruments_names,
                    baseUrl: 'tonejs-instruments/samples/'
                });
        Object.keys(sampledInstruments).forEach(function(instrument_name) {
            sampledInstruments[instrument_name].release = 1.8;
            sampledInstruments[instrument_name].toMaster();
        });
        resolve(sampledInstruments);
    });
    loadPromises.push(sampleLibraryLoadPromise)

    let pianoLoadPromise: Promise<boolean> = piano.load()
    loadPromises.push(pianoLoadPromise)

    Promise.all(loadPromises).then(()=>{
        log.info('Finished downloading');
        loadSamplesButtonElem.remove();
        instrumentSelect.render();
    });
});

function addTriggerAttackRelease_(piano: Piano) {
    // add dummy Instrument method for simple duck typing
    piano.triggerAttackRelease = () => {return piano};
    return piano;
}
addTriggerAttackRelease_(piano)

let instrumentFactories = {
    'PolySynth': () => {return polysynth},
    'Sampled Piano': () => {
        piano.disconnect(0); piano.toMaster(); return piano},
    'Sampled Piano (w/ reverb)':
        () => {piano.disconnect(0); piano.connect(reverb); return piano},
    'Xylophone': () => {return sampledInstruments['xylophone']},
    'Steelpan': () => {return steelpan},
    'None': () => {return silentInstrument}
}

let instrumentSelectElem: HTMLElement = document.createElement('div')
instrumentSelectElem.id = 'instrument-select'
document.body.appendChild(instrumentSelectElem)

let instrumentSelect = new Nexus.Select('#instrument-select', {
    'size': [275, 40],
    'options': Object.keys(instrumentFactories)
})

let current_instrument = polysynth;
function instrumentOnChange() {
    current_instrument = instrumentFactories[this.value]();
};

instrumentSelect.on('change', instrumentOnChange.bind(instrumentSelect));
const initialInstrument = 'PolySynth';
instrumentSelect.value = initialInstrument;

let chordInstrumentSelectElem: HTMLDivElement;
let chordInstrumentFactories;
let chordInstrumentSelect;
let chords_instrument;
const initialChordInstrument = 'PolySynth';
if (osmd.leadsheet) {
    // addSilentPianoMethods_(polysynth_chords);

    // create second instrument selector for chord instrument
    chordInstrumentSelectElem = document.createElement('div')
    chordInstrumentSelectElem.id = 'chord-instrument-select'
    document.body.appendChild(chordInstrumentSelectElem)

    chordInstrumentFactories = {
        'PolySynth': () => {return polysynth_chords},
        'Organ': () => {return sampledInstruments['organ']},
        'Harmonium': () => {return sampledInstruments['harmonium']},
        'None': () => {return silentInstrument}
    }

    chordInstrumentSelect = new Nexus.Select('#chord-instrument-select', {
        'size': [275, 40],
        'options': Object.keys(chordInstrumentFactories)
    })

    chords_instrument = polysynth_chords;
    let chordInstrumentOnChange = function() {
        chords_instrument = chordInstrumentFactories[this.value]();
    };

    chordInstrumentSelect.on('change', chordInstrumentOnChange.bind(chordInstrumentSelect))
    chordInstrumentSelect.value = initialChordInstrument
}

// Create BPM display
let bpmContainerElem: HTMLDivElement = document.createElement('div');
bpmContainerElem.setAttribute('horizontal', '');
bpmContainerElem.setAttribute('layout', '');
bpmContainerElem.setAttribute('display', 'grid');
bpmContainerElem.setAttribute('grid-template-columns', '200px 200px;');

document.body.appendChild(bpmContainerElem);

let bpmNameElem: HTMLElement = document.createElement('div');
bpmNameElem.textContent = 'BPM'
bpmContainerElem.appendChild(bpmNameElem);
let bpmCounterElem: HTMLElement = document.createElement('div');
bpmCounterElem.setAttribute('id', 'bpm-counter');
bpmContainerElem.appendChild(bpmCounterElem);

let minAcceptedBPM = 30
let maxAcceptedBPM = 250
if (maxAcceptedBPM < 2*minAcceptedBPM) {
    throw Error(`BPM range should be at least one tempo octave wide, ie.
        maxAcceptedBPM at least twice as big as minAcceptedBPM`)
}
let currentBPM: number;
let bpmCounter = new Nexus.Number('#bpm-counter', {
    'min': minAcceptedBPM,
    'max': maxAcceptedBPM,
    'step': 0.01
});

bpmCounter.on('change', function(newBPM){
    Tone.Transport.bpm.value = newBPM;
    if (link_enabled) ipcRenderer.send(link_channel_prefix + 'tempo', newBPM);
});
ipcRenderer.on(link_channel_prefix + 'tempo', (event, newBPM) => {
    // ensure the new BPM is in the accepted range
    // this works because the accepted range is at least one octave wide
    while (newBPM > maxAcceptedBPM) newBPM = newBPM / 2
    while (newBPM < minAcceptedBPM) newBPM = 2 * newBPM

    // HACK perform a comparison to avoid messaging loops, since
    // the link update triggers a bpm modification message
    if (Tone.Transport.bpm.value !== newBPM) {
        Tone.Transport.bpm.value = newBPM
        bpmCounter._value.update(newBPM);
        bpmCounter.render()
        }
    }
);

function synchronizeToLinkBPM(): void {
    ipcRenderer.emit(link_channel_prefix + 'get_bpm')
}

// set the initial tempo for the app
if (link_enabled) {
    // if Link is enabled, use the Link tempo
    synchronizeToLinkBPM();
    }
else {bpmCounter.value = 110}

let midiOut;  // will be assigned by Select element

function getTimingOffset(){
    return performance.now() - Tone.now() * 1000
}

function getPlayNoteByMidiChannel(midiChannel){
    function playNote(time, event){
        log.debug(`Play note event @ time ${time}: ` + JSON.stringify(event))
        current_instrument.triggerAttackRelease(event.name, event.duration, time,
            event.velocity);

        midiOut.playNote(event.name, midiChannel,
            {time: time * 1000 + getTimingOffset(),
             duration: event.duration * 1000})
    }
    return playNote
}

function nowPlayingCallback(time, step){
    $('.notebox').removeClass('playing');
    $(`.timecontainer[containedQuarterNotes~='${step}'] .notebox`).addClass('playing');
}

// quarter-note aligned steps
let sequence_duration_tone: Tone.Time;
if (osmd.leadsheet) {sequence_duration_tone = Tone.Time('8m')}  // FIXME hardcoded piece duration
else {sequence_duration_tone = Tone.Time('4m')}
// FIXME could break, should really parse tone js duration
let [seq_dur_measures, seq_dur_quarters, seq_dur_sixteenths] =
    sequence_duration_tone.toBarsBeatsSixteenths().split(':').map(parseFloat)
let sequence_duration_quarters = Math.floor((4*seq_dur_measures +
    seq_dur_quarters + Math.floor(seq_dur_sixteenths / 4)))
let steps = [];
for (let i = 0; i < sequence_duration_quarters; i++) {
    steps.push(i);
}

function scheduleTrackToInstrument(midiTrack, midiChannel=1) {
    let notes = midiTrack.notes;

    let playNote_callback;
    let getInstrument = () => current_instrument;
    playNote_callback = getPlayNoteByMidiChannel(midiChannel)

    let part = new Tone.Part(playNote_callback, notes);
    part.start(0)  // schedule events on the Tone timeline
    part.loop = true;
    part.loopEnd = sequence_duration_tone;

    //schedule the pedal
    let sustain = new Tone.Part((time, event) => {
        if (event.value){
            getInstrument().pedalDown(time)
        } else {
            getInstrument().pedalUp(time)
        }
    }, midiTrack.controlChanges[64]).start(0)

    let noteOffEvents = new Tone.Part((time, event) => {
        getInstrument().keyUp(event.midi, time, event.velocity)
    }, midiTrack.noteOffs).start(0)

    let noteOnEvents = new Tone.Part((time, event) => {
        getInstrument().keyDown(event.midi, time, event.velocity)
    }, midiTrack.notes).start(0)

    log.debug('Midi track content')
    log.debug(midiTrack.noteOffs)
    log.debug(midiTrack.notes)

    // set correct loop points for all tracks and activate infinite looping
    for (let part of [sustain, noteOffEvents, noteOnEvents]) {
        part.loop = true;
        part.loopEnd = sequence_duration_tone;
    }
}

function loadMidi(url: string) {
    MidiConvert.load(url, function(midi) {
        Tone.Transport.cancel()  // remove all scheduled events

        // must set the Transport BPM to that of the midi for proper scheduling
        Tone.Transport.bpm.value = midi.header.bpm;
        Tone.Transport.timeSignature = midi.header.timeSignature;

        let drawCallback = (time, step) => {
                // DOM modifying callback should be put in Tone.Draw scheduler!
                // see: https://github.com/Tonejs/Tone.js/wiki/Performance#syncing-visuals
                Tone.Draw.schedule((time) => {nowPlayingCallback(time, step)}, time);
                }

        // schedule quarter-notes clock
        new Tone.Sequence(drawCallback, steps, '4n').start(0);

        for (let trackIndex_str in midi.tracks){
            let trackIndex = parseInt(trackIndex_str);
            let track = midi.tracks[trackIndex];
            // midiChannels start at 1
            let midiChannel = trackIndex + 1;
            scheduleTrackToInstrument(track, midiChannel);
        }

        // change Transport BPM back to the displayed value
        Tone.Transport.bpm.value = bpmCounter.value;  // WARNING if bpmCounter is a floor'ed value, this is wrong
    })
}

function downbeatStartCallback() {
    Tone.Transport.start("+0.00001", "0:0:0")
}

function playCallback(){
    Tone.context.resume().then(() => {
        if (playbutton.state) {//Tone.Transport.state === "started"){
            if (!(link_enabled)) {
                // start the normal way
                Tone.Transport.start("+0.2");
            } else {
                log.info('LINK: Waiting for `downbeat` message...');
                // wait for Link-socket to give downbeat signal
                ipcRenderer.once('downbeat', () => {
                    log.info('LINK: Received `downbeat` message, starting playback');
                    downbeatStartCallback();
                });
            }
        } else {
            Tone.Transport.stop();  // WARNING! doesn't use pause anymore!
        }
    })
};

let dummyMidiOut = new Tone.Instrument();
dummyMidiOut.playNote = () => {};

let midiOutSelectElem: HTMLElement = document.createElement("div");
midiOutSelectElem.id = 'select-midiout';
document.body.appendChild(midiOutSelectElem);
let midiOutSelect: any;  // declare placeholder variable for midiOut selector
WebMidi.enable(function (err) {
    if (err) log.error(err);

    let midiOutSelect = new Nexus.Select('#select-midiout', {
        'size': [150, 50],
        'options': ['No Output'].concat(WebMidi.outputs.map((output) => output.name)),
    });
    function midiOutOnChange(ev) {
        if (this.value !== 'No Output') {
                midiOut = WebMidi.getOutputByName(this.value);
        }
        else {
                midiOut = dummyMidiOut;
        }
        log.info('Selected MIDI out: ' + this.value);
    };
    midiOutSelect.on('change', midiOutOnChange.bind(midiOutSelect));
    midiOutSelect.value = 'No Output';
});

let linkbuttonElem: HTMLElement = document.createElement('top-control-item');
linkbuttonElem.id = 'link-button'
topControlsGridElem.appendChild(linkbuttonElem);

let linkbutton = new Nexus.TextButton('#link-button',{
    'size': [150,50],
    'state': false,
    'text': 'Enable LINK',
    'alternateText': 'Disable LINK'
})

let linkdisplayElem: HTMLElement = document.createElement('top-control-item');
linkdisplayElem.id = 'link-display'
topControlsGridElem.appendChild(linkdisplayElem);

let linkdisplayButton = new Nexus.Button('#link-display',{
    'size': [40, 40],
    'state': false,
    'mode': 'button'
})

let linkDisplayTimeout;
ipcRenderer.on(link_channel_prefix + 'downbeat', () => {
    linkdisplayButton.down();
    if (linkDisplayTimeout) clearTimeout(linkDisplayTimeout);
    linkDisplayTimeout = setTimeout(() => linkdisplayButton.up(), 100)}
)

ipcRenderer.on(link_channel_prefix + 'enable-success', (enable_succeeded) => {
        if (enable_succeeded) {
            link_enabled = true;
            synchronizeToLinkBPM();
            log.info('Succesfully enabled Link');
        }
        else {log.error('Failed to enable Link')}
    }
)

ipcRenderer.on(link_channel_prefix + 'disable-success', (disable_succeeded) => {
        if (disable_succeeded) {
            link_enabled = false;
            log.info('Succesfully disabled Link');
        }
        else {log.error('Failed to disable Link')}
    }
)

async function link_enable_callback(enable_value) {
    if (enable_value) {
        if (!link_initialized) {
            // hang asynchronously on this call
            await ipcRenderer.send(link_channel_prefix + 'init')
            link_initialized = true
        }
        ipcRenderer.send(link_channel_prefix + 'enable')
    }
    else {
        ipcRenderer.send(link_channel_prefix + 'disable')
    }
}

linkbutton.on('change', link_enable_callback)

import { createWavInput } from './file_upload'
createWavInput(() => loadMusicXMLandMidi(serverUrl + 'get-musicxml',
  serverUrl + 'get-midi'))
