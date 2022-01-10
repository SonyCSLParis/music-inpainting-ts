import $ from 'jquery'
/// <reference path="./typing/jquery-simple-upload.d.ts" />
import 'jquery-simple-upload'

import serverConfig from '../common/default_config.json'

const serverUrl = `http://${serverConfig['server_ip']}:${serverConfig['chorale_port']}/`
const generateArgs = 'analyze-audio'

export function createWavInput(onSuccess: () => void): void {
  const simpleUpload: HTMLDivElement = document.createElement('div')
  document.body.appendChild(simpleUpload)
  const simpleUpload_html = `<div id="filename"></div>
        <div id="progress"></div>
        <div id="progressBar"></div>

        <label for="wav-input">Select a .wav file to upload</label>
        <input type="file" name="audio" accept="audio/x-wav" id="wav-input"/>`
  simpleUpload.innerHTML = simpleUpload_html

  $('#wav-input').on('change', function () {
    $(this).simpleUpload(serverUrl + generateArgs, {
      start: function (file) {
        //upload started
        $('#filename').html(file.name)
        $('#progress').html('')
        $('#progressBar').width(0)
      },

      progress: function (progress) {
        //received progress
        $('#progress').html(
          'Progress: ' + Math.round(progress).toString() + '%'
        )
        $('#progressBar').width(progress.toString() + '%')
      },

      success: function (data) {
        //upload successful
        $('#progress').html('Success!<br>Data: ' + JSON.stringify(data))
        onSuccess()
      },

      error: function (error) {
        //upload failed
        $('#progress').html('Failure!<br>' + error.name + ': ' + error.message)
      },
    })
  })
}
