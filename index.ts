import { OSMD } from "opensheetmusicdisplay";

let osmd: OSMD;

window.onload = function () {
	let container: HTMLElement = <HTMLElement>document.createElement("container");
	container.clientWidth = 800;
	container.clientHeight = 600;
    document.body.appendChild(container);

    osmd = new OSMD(container, false);
    loadMusicXML("musicXmlSample.xml");
};

function loadMusicXML(url: string) {
   var xhttp = new XMLHttpRequest();
   xhttp.onreadystatechange = function () {
	   switch (xhttp.readyState) {
	      case 0 : // UNINITIALIZED
	      case 1 : // LOADING
	      case 2 : // LOADED
	      case 3 : // INTERACTIVE
	      break;
	      case 4 : // COMPLETED
	      	osmd.load(xhttp.responseXML);
	      	break;
	      default:
	      	throw("Error loading MusicXML.");
	   }
	}
   xhttp.open("GET", url, true);
   xhttp.send();
 }