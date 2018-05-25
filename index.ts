import * as nipplejs from "nipplejs";
import { eOSMD } from "./locator";
import * as $ from "jquery";
import * as MidiConvert from "midiconvert";
import * as Tone from "tone";
import * as m21 from "./music21j"
// import Slider = require("bootstrap-slider");

// // slider
// let sliderContainer: HTMLElement = <HTMLElement>document.createElement("input");
// sliderContainer.id = "#chorale-selection";
// // sliderContainer.setAttribute('type', 'range')
// // sliderContainer.setAttribute('data-slider-min', '0')
// // sliderContainer.setAttribute('data-slider-min', '100')
// // sliderContainer.setAttribute('data-slider-step', '1')
// document.body.appendChild(sliderContainer);

// // let choraleIndex = $('#chorale-selection').slider().on(
// //      'slide', function() { }
// // ).data('slider')

// let slider = new Slider('#chorale-selection',
//     {
//         formatter: function(value: number): string {
//             return '' + value;
//         }
//     })

let playbutton: HTMLElement = <HTMLElement>document.createElement("button");
playbutton.textContent = "START";
playbutton.addEventListener("click", playCallback, true);

document.body.appendChild(playbutton);

let stopbutton: HTMLElement = <HTMLElement>document.createElement("button");
stopbutton.textContent = "STOP";
stopbutton.addEventListener("click", () => {
    Tone.Transport.stop();
    playbutton.textContent = "START";
});

document.addEventListener("keydown", (event) => {
    const keyName = event.key
    switch (keyName) {
        case 'p': {playbutton.click(); break}
        case 's': {stopbutton.click(); break}
    }}, false);

document.body.appendChild(stopbutton);
document.body.appendChild(document.createElement("div"))

let serverUrl = 'http://0.0.0.0:5000/';
// let serverUrl = 'http://10.0.1.208:5000/';

// let audioControls: HTMLAudioElement = <HTMLAudioElement>document.createElement("audio");
// audioControls.setAttribute("controls", "");
//
// let audioPlayer: HTMLElement = <HTMLElement>document.createElement("source");
// audioPlayer.setAttribute("id", "source");
// audioPlayer.setAttribute("type", "audio/mpeg");
// audioPlayer.setAttribute("src", "");
// audioControls.appendChild(audioPlayer);
// document.body.appendChild(audioControls);

let osmd: eOSMD;
/*
 * Create a container element for OpenSheetMusicDisplay...
 */
let container: HTMLElement = (
    <HTMLElement>document.createElement("div"));
/*
 * ... and attach it to our HTML document's body. The document itself is a HTML5
 * stub created by Webpack, so you won't find any actual .html sources.
 */
document.body.appendChild(container);
/*
 * Create a new instance of OpenSheetMusicDisplay and tell it to draw inside
 * the container we've created in the steps before. The second parameter tells OSMD
 * not to redraw on resize.
 */
osmd = new eOSMD(container, false);

var options = {
    zone: container,
    color: "blue"
};
var manager = nipplejs.create(options);
var joystick_data = {};
var last_click = [];

manager.on('end', function(evt, nipple) {
    console.log(joystick_data);
    console.log(osmd.boundingBoxes);
    let measureIndex = findMeasureIndex(last_click);
    console.log(measureIndex);


    let argsGenerationUrl = ("one-measure-change" +
        ('?measureIndex=' + measureIndex)
    );
    let argsMidiUrl = "get-midi";

    //    url += '?choraleIndex=' + choraleIndex;
    loadMusicXMLandMidi(serverUrl + argsGenerationUrl,
        serverUrl + argsMidiUrl);
}
);

manager.on('move', function(evt, data) {
    joystick_data = data;
    last_click = data.position;
});

// uncomment the following for testing
//loadMusicXMLandAudio('musicXmlSample.xml', '');
loadMusicXMLandMidi(serverUrl + 'ex', serverUrl + 'get-midi');

/**
 * Load a MusicXml file via xhttp request, and display its contents.
 */
function loadMusicXMLandMidi(urlXML: string, urlMidi: string) {
    $.get({
        url: urlXML,
        success: (xmldata) => {
            console.log(xmldata)
            osmd.load(xmldata)
                .then(
                    () => osmd.render(),
                    (err) => console.log(err)
                );
            loadMidi(urlMidi);
        }
    });
}

var chorus = new Tone.Chorus(2, 1.5, 0.5).toMaster();
var reverb = new Tone.Reverb(1.5).connect(chorus);
reverb.generate();
var synth = new Tone.PolySynth(8).connect(reverb);

function playNote(time, event){
	synth.triggerAttackRelease(event.name, event.duration, time, event.velocity);
}

function loadMidi(url: string) {
    MidiConvert.load(url, function(midi) {
        console.log(midi)

        Tone.Transport.cancel()  // remove all scheduled events

        // make sure you set the tempo before you schedule the events
        Tone.Transport.bpm.value = midi.header.bpm;
        Tone.Transport.timeSignature = midi.header.timeSignature;
        console.log(Tone.Transport)

        for (let track of midi.tracks) {
            let notes = track.notes
            let part = new Tone.Part(playNote, notes);
            part.start(0)  // schedule events on the Tone timeline
            part.loop = true;
            part.loopEnd = '4m';  // FIXME hardcoded duration
            console.log(part)
        }
    })
}

function playCallback(){
    if (Tone.Transport.state === "started"){
        Tone.Transport.pause();
        this.textContent = "START";
    } else {
        Tone.Transport.start();
        this.textContent = "PAUSE";
    }
};

function findMeasureIndex(position): string {
    let boundingBoxes = osmd.boundingBoxes;
    let boundingBox;
    for (let measureIndex in boundingBoxes) {
        boundingBox = boundingBoxes[measureIndex];
        if (position.x <= boundingBox.xmax
            &&
            position.x >= boundingBox.xmin
            &&
            position.y <= boundingBox.ymax
            &&
            position.y >= boundingBox.ymin
        ) {
            return measureIndex;
        }
    }
    return null;
}
