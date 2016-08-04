import { OSMD } from "opensheetmusicdisplay";

let osmd: OSMD;

window.onload = () => {
	let container: HTMLElement = <HTMLElement>document.createElement("div");
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
	      	osmd.render();
	      	break;
	      default:
	      	throw("Error loading MusicXML.");
	   }
	}
   xhttp.open("GET", url, true);
   xhttp.send();
 }