import * as nipplejs from "nipplejs";
import { eOSMD } from "./locator";
import * as $ from "jquery";
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

// let serverUrl = 'http://127.0.0.1:5000/';
let serverUrl = 'http://10.0.1.208:5000/';

let audioControls: HTMLAudioElement = <HTMLAudioElement>document.createElement("audio");
audioControls.setAttribute("controls", "");

let audioPlayer: HTMLElement = <HTMLElement>document.createElement("source");
audioPlayer.setAttribute("id", "source");
audioPlayer.setAttribute("type", "audio/mpeg");
audioPlayer.setAttribute("src", "");
audioControls.appendChild(audioPlayer);
document.body.appendChild(audioControls);

let osmd: eOSMD;
/*
 * Create a container element for OpenSheetMusicDisplay...
 */
let container: HTMLElement = <HTMLElement>document.createElement("div");
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


    let argsGenerationUrl = "one-measure-change";
    argsGenerationUrl += '?measureIndex=' + measureIndex;
    let argsMp3Url = "get-mp3";

    //    url += '?choraleIndex=' + choraleIndex;
    loadMusicXMLandAudio(serverUrl + argsGenerationUrl,
        serverUrl + argsMp3Url);

    // loadMp3(serverUrl + argsMp3Url);
}
);

manager.on('move', function(evt, data) {
    joystick_data = data;
    last_click = data.position;
});


// uncomment the following for testing
//loadMusicXMLandAudio('musicXmlSample.xml', '');
loadMusicXMLandAudio(serverUrl + 'ex', serverUrl + 'get-mp3');


/**
 * Load a MusicXml file via xhttp request, and display its contents.
 */
function loadMusicXMLandAudio(urlXML: string, urlMp3: string) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        switch (xhttp.readyState) {
            case 0: // UNINITIALIZED
            case 1: // LOADING
            case 2: // LOADED
            case 3: // INTERACTIVE
                break;
            case 4: // COMPLETED
                osmd
                    .load(xhttp.responseXML)
                    .then(
                    () => osmd.render(),
                    (err) => console.log(err)
                    );

                $("audio #source").attr('src', urlMp3);
                (<HTMLAudioElement>$("audio").get(0)).load();
                break;
            default:
                throw ("Error loading MusicXML file.");
        }
    }
    xhttp.open("GET", urlXML, true);
    xhttp.send();
}

function loadMp3(url: string) {
    var xhttp = new XMLHttpRequest();
    xhttp.responseType = 'blob'
    xhttp.onreadystatechange = function() {
        switch (xhttp.readyState) {
            case 0: // UNINITIALIZED
            case 1: // LOADING
            case 2: // LOADED
            case 3: // INTERACTIVE
                break;
            case 4: // COMPLETED
                let data = xhttp.response;
                $("audio #source").attr('src', data);
                // (<JQuery<HTMLAudioElement>>$("audio")).load();
                // (<HTMLAudioElement>$("audio")).play();
                break;
            default:
                throw ("Error loading MusicXML file.");
        }
    }
    xhttp.open("GET", url, true);
    xhttp.send();
}

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
