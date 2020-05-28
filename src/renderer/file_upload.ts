import { Promise } from 'es6-promise';
import * as $ from 'jquery'
import 'jquery-simple-upload';

let serverConfig: object = require('../common/default_config.json')

let serverUrl = `http://${serverConfig['server_ip']}:${serverConfig['chorale_port']}/`;
let generateArgs: string = 'analyze-audio';

export function createWavInput(onSuccess: Function): void {
    let simpleUpload: HTMLDivElement = document.createElement('div')
    document.body.appendChild(simpleUpload)
    let simpleUpload_html: string =
        `<div id="filename"></div>
        <div id="progress"></div>
        <div id="progressBar"></div>

        <label for="wav-input">Select a .wav file to upload</label>
        <input type="file" name="audio" accept="audio/x-wav" id="wav-input"/>`
    simpleUpload.innerHTML = simpleUpload_html;

    $('#wav-input').change(function() {
        $(this).simpleUpload(serverUrl + generateArgs, {
            start: function(file){
                    //upload started
                    $('#filename').html(file.name);
                    $('#progress').html("");
                    $('#progressBar').width(0);
                },

                progress: function(progress){
                    //received progress
                    $('#progress').html("Progress: " + Math.round(progress) + "%");
                    $('#progressBar').width(progress + "%");
                },

                success: function(data){
                    //upload successful
                    $('#progress').html("Success!<br>Data: " + JSON.stringify(data));
                onSuccess()
                },

                error: function(error){
                    //upload failed
                    $('#progress').html("Failure!<br>" + error.name + ": " + error.message);
            }
        })
    });
}
