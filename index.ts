import * as nipplejs from "nipplejs";
import { eOSMD } from "./locator";
import { Fraction } from 'opensheetmusicdisplay'
import * as $ from "jquery";
import * as MidiConvert from "midiconvert";
import {Piano} from 'tone-piano';
import * as Tone from "tone";
import { SampleLibrary } from './tonejs-instruments/Tonejs-Instruments'
import * as Nexus from 'nexusui'

import './styles/osmd.scss'
// import './styles/main.scss'


let playbuttonElem: HTMLElement = <HTMLElement>document.createElement('div');
playbuttonElem.id = 'play-button'
document.body.appendChild(playbuttonElem);

let playbutton = new Nexus.TextButton('#play-button',{
    // 'size': [150,50],
    'state': false,
    'text': 'Play',
    'alternateText': 'Pause'
})
playbutton.on('mousedown', (e) => {playbutton.flip()}) //playCallback.bind(playbutton));
playbutton.on('change', playCallback)


let stopbuttonElem: HTMLElement = <HTMLElement>document.createElement("div");
stopbuttonElem.id = 'stop-button';
document.body.appendChild(stopbuttonElem);

let stopbutton = new Nexus.TextButton('#stop-button',{
    // 'size': [150,50],
    'state': false,
    'text': 'Stop'
})
stopbutton.on('change', (event) => {
    playbutton.flip(false);
    Tone.Transport.stop();
    nowPlayingCallback(0, 0);
});

document.addEventListener("keydown", (event) => {
    const keyName = event.key
    switch (keyName) {
        case 'p': {playbutton.down(); break}
        case 's': {stopbutton.down(); stopbutton.up(); break}
    }});

document.body.appendChild(document.createElement("br"))

// Time-granularity selector
let granularities = ['quarter-note', 'half-note', 'whole-note']

let granularitySelectElem: HTMLElement = document.createElement("div");
granularitySelectElem.id = 'select-granularity'
document.body.appendChild(granularitySelectElem)

let granularitySelect = new Nexus.Select('#select-granularity', {
    'size': [150, 40],
    'options': granularities,
    })

function granularityOnChange(ev) {
    $('.notebox').removeClass('active');
    $('.' + this.value).addClass('active');
};
granularitySelect.on('change', granularityOnChange.bind(granularitySelect))
const initialGranulatity = granularities.indexOf('whole-note').toString()
granularitySelect.selectedIndex = initialGranulatity



let titlediv: HTMLDivElement = document.createElement('div')
// titlediv.classList.add('header')
titlediv.textContent = 'DeepBach'
titlediv.style.alignContent = 'CenterTop'
titlediv.style.width = '100%'
titlediv.style.fontStyle = 'bold'
titlediv.style.fontSize = '64px'
// document.body.appendChild(titlediv)

document.body.appendChild(document.createElement("div"))

// let serverUrl = 'http://0.0.0.0:5000/';
let serverUrl = 'http://10.0.1.122:5000/';

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
osmd = new eOSMD(osmdContainer, true);

var options = {
    zone: osmd.renderingBackend.getInnerElement(),
    color: "blue"
};
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

function formatFermatas(): string {
    const activeFermataElems = $('.fermata.active')
    const containedQuarterNotesList = activeFermataElems.map(
        function(){return this.getAttribute('containedQuarterNotes');}).get()
    return containedQuarterNotesList.toString()
}

function onClickTimestampBoxFactory(timeStart: Fraction, timeEnd: Fraction) {
    const  [sixteenthnoteStart, sixteenthnoteEnd] = ([timeStart, timeEnd].map(
        timeFrac => Math.round(16 * timeFrac.RealValue)))

    const argsGenerationUrl = ("timerange-change" +
        `?sixteenthnoteStart=${sixteenthnoteStart}` +
        `&sixteenthnoteEnd=${sixteenthnoteEnd}`
    );
    const argsMidiUrl = "get-midi";

    return (function (this, event) {
        // this.style.opacity = '0.3';
        const fermatasString = formatFermatas()
        const argsGenerationUrlWithFermatas = (argsGenerationUrl +
            '&fermatas=' + fermatasString)
        loadMusicXMLandMidi(serverUrl + argsGenerationUrlWithFermatas,
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
    $('.notebox').each(function() {
        this.addEventListener("click", blockall, true);}
    )
}

function enableChanges(): void {
    $('.notebox').each(function() {
        this.removeEventListener("click", blockall, true);}
    )
    toggleBusyClass(false);
}


/**
 * Load a MusicXml file via xhttp request, and display its contents.
 */
function loadMusicXMLandMidi(urlXML: string, urlMidi: string) {
    disableChanges();
    $.get({
        url: urlXML,
        success: (xmldata: XMLDocument) => {
            removeMusicXMLHeaderNodes(xmldata);
            osmd.load(xmldata)
                .then(
                    () => {
                        osmd.render(onClickTimestampBoxFactory);
                        enableChanges()
                    },
                    (err) => {console.log(err); enableChanges()}
                );
            loadMidi(urlMidi);
            // loadMidiToPiano(urlMidi);
        }
    });
}


var piano = new Piano([21, 108], 5);

var samples = SampleLibrary.load({
            instruments: ['organ'],
            baseUrl: "tonejs-instruments/samples/"
        })
var organ = samples['organ']
organ.release = 1.8
organ.toMaster();

var chorus = new Tone.Chorus(2, 1.5, 0.5).toMaster();
var reverb = new Tone.Reverb(1.5).connect(chorus);
reverb.generate();

var polysynth = new Tone.PolySynth(12);
polysynth.connect(reverb)

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

piano.load().then(()=>{
	//make the button active on load
	// let button = document.querySelector('button')
	// button.classList.add('active')
	// document.querySelector('#loading').remove()
})

function addSilentPianoMethods_(instrument: Tone.Instrument) {
    // add dummy Piano methods for simple duck typing
    instrument.keyDown = () => {return instrument};
    instrument.keyUp = () => {return instrument};
    instrument.pedalDown = () => {return instrument};
    instrument.pedalUp = () => {return instrument};
    instrument.pedalDown = () => {return instrument};
    return instrument
}

function addTriggerAttackRelease_(piano: Piano) {
    // add dummy Instrument method for simple duck typing
    piano.triggerAttackRelease = () => {return piano};
    return piano;
}

let instruments = [polysynth, steelpan, organ]
for (let instrument of instruments) {
    addSilentPianoMethods_(instrument);
}
addTriggerAttackRelease_(piano)

let instrumentFactories = {
    'PolySynth': () => {return polysynth},
    'Sampled Piano': () => {
        piano.disconnect(0); piano.toMaster(); return piano},
    'Sampled Piano (w/ reverb)':
        () => {piano.disconnect(0); piano.connect(reverb); return piano},
    'Organ': () => {return organ},
    'Steelpan': () => {return steelpan},
}

let instrumentSelectElem: HTMLElement = document.createElement('div')
instrumentSelectElem.id = 'instrument-select'
document.body.appendChild(instrumentSelectElem)

let instrumentSelect = new Nexus.Select('#instrument-select', {
    'size': [275, 40],
    'options': Object.keys(instrumentFactories)
})

let current_instrument = polysynth;
function instrumentOnChange(ev) {
    current_instrument = instrumentFactories[this.value]();
};

instrumentSelect.on('change', instrumentOnChange.bind(instrumentSelect))
const initialInstrument = 'PolySynth'
instrumentSelect.value = initialInstrument

// Create BPM slider
let bpmContainerElem: HTMLDivElement = document.createElement('div');
bpmContainerElem.setAttribute('horizontal', '');
bpmContainerElem.setAttribute('layout', '');
bpmContainerElem.setAttribute('display', 'grid');
bpmContainerElem.setAttribute('grid-template-columns', '200px 200px;');

document.body.appendChild(bpmContainerElem);

let bpmSliderElem: HTMLElement = document.createElement('div');
bpmSliderElem.setAttribute('id', 'bpm-slider');
bpmContainerElem.appendChild(bpmSliderElem);
let bpmCounterElem: HTMLElement = document.createElement('div');
bpmCounterElem.setAttribute('id', 'bpm-counter');
bpmCounterElem.style.pointerEvents = 'none';
bpmContainerElem.appendChild(bpmCounterElem);

let bpmSlider = new Nexus.Slider('#bpm-slider', {
    'size':[200, 40],
    'min': 80,
    'max': 130,
    'step': 1
});
let bpmCounter = new Nexus.Number('#bpm-counter', {
    'min': 80,
    'max': 130,
    'step': 1
});
bpmSlider.on('change', function(value){
    Tone.Transport.bpm.value = value
});
bpmCounter.link(bpmSlider);

bpmSlider.value = 110


// function playNotePiano(time, event){
//     current_instrument.keyDown(event.note, event.velocity, time)
//                       .keyUp(event.note, time + event.duration)
// }

function playNote(time, event){
    current_instrument.triggerAttackRelease(event.name, event.duration, time,
        event.velocity);
    current_instrument.keyDown(event.note, event.velocity, time).keyUp(event.note, time + event.duration)
}

function nowPlayingCallback(time, step){
    $('.notebox').removeClass('playing');
    $('.notebox').filter(`[containedQuarterNotes~='${step}']`).addClass('playing');
}

// quarter-note aligned steps
let sequence_duration_tone: Tone.Time = Tone.Time('4m')  // FIXME hardcoded piece duration
// FIXME could break, should really parse tone js duration
let [seq_dur_measures, seq_dur_quarters, seq_dur_sixteenths] =
    sequence_duration_tone.toBarsBeatsSixteenths().split(':').map(parseFloat)
let sequence_duration_quarters = Math.floor((4*seq_dur_measures +
    seq_dur_quarters + Math.floor(seq_dur_sixteenths / 4)))
let steps = [];
for (let i = 0; i < sequence_duration_quarters; i++) {
    steps.push(i);
}

function loadMidi(url: string) {
    MidiConvert.load(url, function(midi) {
        Tone.Transport.cancel()  // remove all scheduled events

        // must set the Transport BPM to that of the midi for proper scheduling
        Tone.Transport.bpm.value = midi.header.bpm;
        Tone.Transport.timeSignature = midi.header.timeSignature;

        // schedule quarter-notes clock
        new Tone.Sequence(nowPlayingCallback, steps, '4n').start(0);

        for (let track of midi.tracks) {
            let notes = track.notes
            let part = new Tone.Part(playNote, notes);
            part.start(0)  // schedule events on the Tone timeline
            part.loop = true;
            part.loopEnd = sequence_duration_tone;
        }

        for (let track of midi.tracks) {
        	//schedule the pedal
        	let sustain = new Tone.Part((time, event) => {
        		if (event.value){
        			current_instrument.pedalDown(time)
        		} else {
        			current_instrument.pedalUp(time)
        		}
        	}, track.controlChanges[64]).start(0)

        	let noteOffEvents = new Tone.Part((time, event) => {
        		current_instrument.keyUp(event.midi, time, event.velocity)
        	}, track.noteOffs).start(0)

        	let noteOnEvents = new Tone.Part((time, event) => {
        		current_instrument.keyDown(event.midi, time, event.velocity)
        	}, track.notes).start(0)

            for (let part of [sustain, noteOffEvents, noteOnEvents]) {
                part.loop = true;
                part.loopEnd = sequence_duration_tone;
            }
        }

        // change Transport BPM back to the displayed value
        Tone.Transport.bpm.value = bpmSlider.value;
    })
}

function loadMidiToPiano(url:string) {
    MidiConvert.load(url).then((midi) => {
        // Tone.Transport.cancel()  // remove all scheduled events
        //
        // Tone.Transport.bpm.value = midi.header.bpm
    	// Tone.Transport.timeSignature = midi.header.timeSignature
        //
        // // schedule quarter-notes clock
        // new Tone.Sequence(nowPlayingCallback, steps, '4n').start(0);

        for (let track of midi.tracks) {
        	//schedule the pedal
        	let sustain = new Tone.Part((time, event) => {
        		if (event.value){
        			piano.pedalDown(time)
        		} else {
        			piano.pedalUp(time)
        		}
        	}, track.controlChanges[64]).start(0)

        	let noteOffEvents = new Tone.Part((time, event) => {
        		piano.keyUp(event.midi, time, event.velocity)
        	}, track.noteOffs).start(0)

        	let noteOnEvents = new Tone.Part((time, event) => {
        		piano.keyDown(event.midi, time, event.velocity)
        	}, track.notes).start(0)

            for (let part of [sustain, noteOffEvents, noteOnEvents]) {
                part.loop = true;
                part.loopEnd = sequence_duration_tone;
            }
        }
    })
}

function playCallback(){
    // playbutton.flip()
    Tone.context.resume().then(() => {
        if (playbutton.state) {//Tone.Transport.state === "started"){
            Tone.Transport.start("+0.1");
            // this.turnOn()
        } else {
            Tone.Transport.pause();
            // this.turnOff();
            // this.textContent = "PAUSE";
        }
    })
};
