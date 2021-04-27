// import * as nipplejs from "nipplejs";
import {
  SheetLocator,
  renderZoomControls,
  SpectrogramLocator,
  registerZoomTarget,
  Locator,
} from './locator'
import { Fraction } from 'opensheetmusicdisplay'
import $ from 'jquery'
import * as Tone from 'tone'

import log from 'loglevel'
log.setLevel(log.levels.INFO)

import Nexus from './nexusColored'

import * as Header from './header'

import * as PlaybackCommands from './playbackCommands'
import { PlaybackManager } from './playback'
import SheetPlaybackManager from './sheetPlayback'
import { MultiChannelSpectrogramPlaybackManager as SpectrogramPlaybackManager } from './spectrogramPlayback'
import * as SpectrogramPlayback from './spectrogramPlayback'

import * as Instruments from './instruments'
import {
  NumberControl,
  BPMControl,
  renderPitchRootAndOctaveControl,
} from './numberControl'
import LinkClient from './ableton_link/linkClient'
import * as LinkClientCommands from './ableton_link/linkClientCommands'
import { DownloadButton, filename as filenameType } from './downloadCommand'
import * as MidiOut from './midiOut'
import * as MidiIn from './midiIn'

import { myTrip, NonotoTrip, NotonoTrip } from './helpTour'

import { createLFOControls } from './lfo'
import { CycleSelect } from './cycleSelect'
import { getPathToStaticFile } from './staticPath'
import * as ControlLabels from './controlLabels'
import * as GranularitySelect from './granularitySelect'
import { createWavInput } from './file_upload'
import * as SplashScreen from './startup'

import 'simplebar'
import 'simplebar/src/simplebar.css'
import '../common/styles/simplebar.scss'

import '../common/styles/osmd.scss'
import '../common/styles/spectrogram.scss'
import '../common/styles/main.scss'
import '../common/styles/controls.scss'
import '../common/styles/disableMouse.scss'

import colors from '../common/styles/mixins/_colors.module.scss'

declare let ohSnap: any
declare let COMPILE_ELECTRON: boolean

import defaultConfiguration from '../common/default_config.json'

let locator: Locator
let playbackManager: PlaybackManager<Locator>
let sheetPlaybackManager: SheetPlaybackManager
let spectrogramPlaybackManager: SpectrogramPlaybackManager
let bpmControl: BPMControl
let pitchRootSelect: Nexus.Select
let octaveControl: NumberControl
let instrumentSelect: CycleSelect
let vqvaeLayerSelect: CycleSelect
let downloadButton: DownloadButton
let helpTrip: myTrip

function getMidiPitch(): number {
  return pitchRootSelect.selectedIndex + 12 * octaveControl.value
}

function triggerInterfaceRefresh(): void {
  // TODO(theis): use a proper interface
  vqvaeLayerSelect.value = vqvaeLayerSelect.value
}

function toggleBusyClass(state: boolean): void {
  // TODO(theis, 2021_04_22): clean this up!
  $('body').toggleClass('busy', state)
  $('.notebox').toggleClass('busy', state)
  $('.notebox').toggleClass('available', !state)
  $('#spectrogram-container').toggleClass('busy', state)
}

function blockall(e) {
  // block propagation of events in bubbling/capturing
  e.stopPropagation()
  e.preventDefault()
}

function disableChanges(): void {
  toggleBusyClass(true)
  $('.timeContainer').addClass('busy')
  $('.timeContainer').each(function () {
    this.addEventListener('click', blockall, true)
  })
}

function enableChanges(): void {
  $('.timeContainer').each(function () {
    this.removeEventListener('click', blockall, true)
  })
  $('.timeContainer').removeClass('busy')
  toggleBusyClass(false)
}

function render(configuration = defaultConfiguration): void {
  disableChanges()
  appConfiguration = configuration

  if (configuration['osmd']) {
    document.body.classList.add('nonoto')
    Nexus.colors.accent = colors.millenial_pink_active_control
    Nexus.colors.fill = colors.millenial_pink_idle_control
  } else if (configuration['spectrogram']) {
    document.body.classList.add('notono')
  }

  if (document.getElementById('header')) {
    // do nothing if the app has already been rendered
    return
  }

  // set to true to display the help tour after two minutes of inactivity on the
  // interface
  const REGISTER_IDLE_STATE_DETECTOR: boolean =
    configuration['display_help_on_idle']

  // set to true to completely hide the mouse pointer on the interface
  // for touchscreens
  const DISABLE_MOUSE: boolean = configuration['disable_mouse']
  $(() => {
    if (DISABLE_MOUSE) {
      document.body.classList.add('disable-mouse')
    }
  })

  const granularities_quarters: string[] = (<string[]>(
    configuration['granularities_quarters']
  )).sort((a, b) => {
    return parseInt(a) - parseInt(b)
  })

  $(() => {
    const headerGridElement = document.createElement('header')
    headerGridElement.id = 'header'
    document.body.appendChild(headerGridElement)

    const mainPanel = document.createElement('div')
    mainPanel.id = 'main-panel'
    document.body.appendChild(mainPanel)

    const bottomControlsGridElement = document.createElement('footer')
    bottomControlsGridElement.id = 'bottom-controls'
    document.body.appendChild(bottomControlsGridElement)
  })

  $(() => {
    const headerGridElement = document.getElementById('header')
    Header.render(headerGridElement, configuration)
  })

  $(() => {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    const bottomControlsExpandTabElement = document.createElement('div')
    bottomControlsExpandTabElement.id = 'bottom-controls-expand'
    bottomControlsExpandTabElement.classList.add('expand-tab')
    bottomControlsGridElement.appendChild(bottomControlsExpandTabElement)
    bottomControlsExpandTabElement.addEventListener('click', function () {
      document.body.classList.toggle('advanced-controls')
      locator.refresh()
    })

    const playbackCommandsGridspan = document.createElement('div')
    playbackCommandsGridspan.id = 'playback-commands-gridspan'
    playbackCommandsGridspan.classList.add('gridspan')
    bottomControlsGridElement.appendChild(playbackCommandsGridspan)

    if (configuration['spectrogram']) {
      // create element for highlighting control grid spans in help
      const constraintsSpanElement = document.createElement('div')
      constraintsSpanElement.id = 'constraints-gridspan'
      constraintsSpanElement.classList.add('gridspan')
      constraintsSpanElement.classList.add('multi-column-gridspan')
      bottomControlsGridElement.appendChild(constraintsSpanElement)

      const editToolsGridspanElement = document.createElement('div')
      editToolsGridspanElement.id = 'edit-tools-gridspan'
      editToolsGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(editToolsGridspanElement)
    }
  })

  $(() => {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    if (configuration['osmd']) {
      GranularitySelect.renderGranularitySelect(
        bottomControlsGridElement,
        granularities_quarters
      )
    } else if (configuration['spectrogram']) {
      const vqvaeLayerIcons: Map<string, string> = new Map([
        ['top-brush', 'paint-roller.svg'],
        ['bottom-brush', 'paint-brush-small.svg'],
        ['top-brush-random', 'paint-roller-random.svg'],
        ['bottom-brush-random', 'paint-brush-small-random.svg'],
        ['top-eraser', 'edit-tools.svg'],
      ])

      const vqvaeLayerDimensions: Map<string, [number, number]> = new Map([
        ['bottom', [64, 8]],
        ['top', [32, 4]],
      ])

      const iconsBasePath = getPathToStaticFile('icons')

      const granularitySelectContainerElement = document.createElement('div')
      granularitySelectContainerElement.id = 'edit-tool-select-container'
      granularitySelectContainerElement.classList.add('control-item')
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      bottomControlsGridElement.appendChild(granularitySelectContainerElement)

      ControlLabels.createLabel(
        granularitySelectContainerElement,
        'edit-tool-select-label'
      )

      function vqvaeLayerOnChange(ev) {
        const tool: string = this.value
        const newLayer: string = tool.split('-')[0]
        const [newNumRows, newNumColumns] = vqvaeLayerDimensions.get(newLayer)
        const [_, numColumnsTop] = vqvaeLayerDimensions.get('top')
        spectrogramPlaybackManager.Locator.render(
          newNumRows,
          newNumColumns,
          numColumnsTop
        )
        spectrogramPlaybackManager.Locator.container.classList.toggle(
          'eraser',
          tool.includes('eraser')
        )
      }

      vqvaeLayerSelect = new CycleSelect(
        granularitySelectContainerElement,
        'edit-tool-select',
        { handleEvent: vqvaeLayerOnChange },
        vqvaeLayerIcons,
        iconsBasePath
      )
    }
  })

  $(() => {
    const insertLFO: boolean = configuration['insert_variations_lfo']
    if (insertLFO) {
      createLFOControls()
    }
  })

  let inpaintingApiIp: string = configuration['inpainting_api_ip']
  if (inpaintingApiIp.charAt(inpaintingApiIp.length - 1) == '/') {
    // strip irrelevant slash at end of IP or address
    inpaintingApiIp = inpaintingApiIp.substring(0, inpaintingApiIp.length - 1)
  }
  const inpaintingApiPort: string = configuration['inpainting_api_port']
  const useCustomPort = inpaintingApiPort != ''
  const inpaintingApiUrl = `http://${inpaintingApiIp}${
    useCustomPort ? ':' : ''
  }${inpaintingApiPort}/`

  function insertLoadingSpinner(container: HTMLElement): HTMLElement {
    const spinnerElement: HTMLElement = document.createElement('i')
    container.appendChild(spinnerElement)
    spinnerElement.classList.add('fas')
    spinnerElement.classList.add('fa-4x')
    spinnerElement.classList.add('fa-spin')
    spinnerElement.classList.add('fa-cog')
    spinnerElement.id = 'osmd-loading-spinner'

    return spinnerElement
  }

  if (configuration['spectrogram']) {
    $(() => {
      const constraintsGridspanElement = document.getElementById(
        'constraints-gridspan'
      )

      const instrumentSelectGridspanElement: HTMLElement = document.createElement(
        'div'
      )
      instrumentSelectGridspanElement.id = 'instrument-select-gridspan'
      instrumentSelectGridspanElement.classList.add('gridspan')
      constraintsGridspanElement.appendChild(instrumentSelectGridspanElement)
      const instrumentSelectElement = document.createElement('div')
      instrumentSelectElement.id = 'instrument-control'
      instrumentSelectElement.classList.add('control-item')
      instrumentSelectGridspanElement.appendChild(instrumentSelectElement)
      // TODO(theis, 2021_04_20): retrieve instrument options from Inpainting API
      const instrumentSelectOptions = [
        'bass',
        'brass',
        'flute',
        'guitar',
        'keyboard',
        'mallet',
        'organ',
        'reed',
        'string',
        'synth_lead',
        'vocal',
      ]
      instrumentSelect = new Nexus.Select('#instrument-control', {
        size: [120, 50],
        options: instrumentSelectOptions,
        value: 'organ',
      })
      ControlLabels.createLabel(
        instrumentSelectElement,
        'instrument-control-label',
        false,
        null,
        instrumentSelectGridspanElement
      )
      ;[pitchRootSelect, octaveControl] = renderPitchRootAndOctaveControl()
    })
  }

  $(() => {
    // HACK(theis): delayed import necessary to avoid
    // failure on startup if the browser does not support the Web MIDI API
    const midiOutImplementation: typeof MidiOut = require('./midiOut')
    const midiInImplementation: typeof MidiIn = require('./midiIn')
    if (configuration['insert_advanced_controls'] && configuration['osmd']) {
      midiOutImplementation.render()
    } else if (
      configuration['insert_advanced_controls'] &&
      configuration['spectrogram']
    ) {
      midiInImplementation.render()
    }
  })

  let sheetLocator: SheetLocator
  $(() => {
    const mainPanel = document.getElementById('main-panel')

    const spinnerElem = insertLoadingSpinner(mainPanel)

    if (configuration['osmd']) {
      const allowOnlyOneFermata: boolean =
        configuration['allow_only_one_fermata']
      /*
       * Create a container element for OpenSheetMusicDisplay...
       */
      const osmdContainerContainer = <HTMLElement>document.createElement('div')
      osmdContainerContainer.id = 'osmd-container-container'
      osmdContainerContainer.setAttribute('data-simplebar', '')
      osmdContainerContainer.setAttribute('data-simplebar-auto-hide', 'false')
      mainPanel.appendChild(osmdContainerContainer)
      const osmdContainer = document.createElement('div')
      osmdContainer.id = 'osmd-container'
      osmdContainerContainer.appendChild(osmdContainer)

      /*
       * Create a new instance of OpenSheetMusicDisplay and tell it to draw inside
       * the container we've created in the steps before. The second parameter tells OSMD
       * not to redraw on resize.
       */
      function copyTimecontainerContent(
        origin: HTMLElement,
        target: HTMLElement
      ) {
        // retrieve quarter-note positions for origin and target
        function getContainedQuarters(timeContainer: HTMLElement): number[] {
          return timeContainer
            .getAttribute('containedQuarterNotes')
            .split(', ')
            .map((x) => parseInt(x, 10))
        }
        const originContainedQuarters: number[] = getContainedQuarters(origin)
        const targetContainedQuarters: number[] = getContainedQuarters(target)

        const originStart_quarter: number = originContainedQuarters[0]
        const targetStart_quarter: number = targetContainedQuarters[0]
        const originEnd_quarter: number = originContainedQuarters.pop()
        const targetEnd_quarter: number = targetContainedQuarters.pop()

        const generationCommand: string =
          '/copy' +
          `?origin_start_quarter=${originStart_quarter}` +
          `&origin_end_quarter=${originEnd_quarter}` +
          `&target_start_quarter=${targetStart_quarter}` +
          `&target_end_quarter=${targetEnd_quarter}`
        loadMusicXMLandMidi(
          sheetPlaybackManager,
          sheetLocator,
          inpaintingApiUrl,
          generationCommand
        )
      }

      const autoResize = false
      sheetLocator = new SheetLocator(
        osmdContainer,
        {
          autoResize: autoResize,
          drawingParameters: 'compact',
          drawPartNames: false,
        },
        granularities_quarters.map((num) => {
          return parseInt(num, 10)
        }),
        configuration['annotation_types'],
        allowOnlyOneFermata,
        onClickTimestampBoxFactory,
        copyTimecontainerContent
      )
      locator = sheetLocator
      // TODO(theis): check proper way of enforcing subtype
      sheetPlaybackManager = new SheetPlaybackManager(sheetLocator)

      playbackManager = sheetPlaybackManager

      PlaybackCommands.setPlaybackManager(sheetPlaybackManager)
      registerZoomTarget(sheetLocator)

      if (configuration['use_chords_instrument']) {
        sheetPlaybackManager.scheduleChordsPlayer(
          sheetLocator,
          configuration['chords_midi_channel']
        )
      }
      $(() => {
        // requesting the initial sheet, so can't send any sheet along
        const sendSheetWithRequest = false
        loadMusicXMLandMidi(
          sheetPlaybackManager,
          sheetLocator,
          inpaintingApiUrl,
          'generate',
          sendSheetWithRequest
        ).then(() => {
          spinnerElement.style.visibility = 'hidden'
          mainPanel.classList.remove('loading')
        })
      })
    } else if (configuration['spectrogram']) {
      const spectrogramContainerElement = document.createElement('div')
      spectrogramContainerElement.id = 'spectrogram-container'
      mainPanel.appendChild(spectrogramContainerElement)

      const spectrogramLocator = new SpectrogramLocator(
        spectrogramContainerElement
      )

      spectrogramPlaybackManager = new SpectrogramPlaybackManager(
        spectrogramLocator
      )
      playbackManager = spectrogramPlaybackManager
      locator = spectrogramLocator
      PlaybackCommands.setPlaybackManager(spectrogramPlaybackManager)

      const sendCodesWithRequest = false
      const initial_command =
        '?pitch=' +
        getMidiPitch().toString() +
        '&instrument_family_str=' +
        instrumentSelect.value +
        '&layer=' +
        vqvaeLayerSelect.value.split('-')[0] +
        '&temperature=1' +
        '&duration_top=4'

      loadAudioAndSpectrogram(
        spectrogramPlaybackManager,
        serverUrl,
        'sample-from-dataset' + initial_command,
        sendCodesWithRequest
      ).then(() => {
        enableChanges()
        mapTouchEventsToMouseSimplebar()
        // HACK, TODO(theis): should not be necessary, since there is already
        // a refresh operation at the end of the loadAudioAndSpectrogram method
        // but this has to be done on the initial call since the SpectrogramLocator
        // only gets initialized in that call
        // should properly initialize the SpectrogramLocator on instantiation
        spectrogramPlaybackManager.Locator.refresh()
      })
    }
  })

  // TODO(theis): could use a more strict type-hint (number[][]|string[][])
  // but this has the TS type-schecker fail, considering the map method (which
  // receives a union type itself) non-callable
  // see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
  function updateConditioningMap(
    mask: number[][],
    currentConditioningMap: Map<string, (number | string)[][]>
  ): Map<string, (number | string)[][]> {
    // retrieve up-to-date user-selected conditioning
    const newConditioning_value = new Map()
    newConditioning_value.set('pitch', getMidiPitch())
    newConditioning_value.set('instrument_family_str', instrumentSelect.value)

    for (const [
      modality,
      conditioning_map,
    ] of currentConditioningMap.entries()) {
      currentConditioningMap.set(
        modality,
        conditioning_map.map((row: (number | string)[], row_index: number) => {
          return row.map(
            (
              currentConditioning_value: number | string,
              column_index: number
            ) => {
              if (mask[row_index][column_index] == 1) {
                return newConditioning_value.get(modality)
              } else {
                return currentConditioning_value
              }
            }
          )
        })
      )
    }
    return currentConditioningMap
  }

  function getCurrentSpectrogramPositionTopLayer(): number {
    const spectrogramImageContainerElement = document.getElementById(
      'spectrogram-image-container'
    )
    if (spectrogramImageContainerElement == null) {
      throw Error('Spectrogram container not initialized')
    }
    const scrollElement = spectrogramImageContainerElement.getElementsByClassName(
      'simplebar-content-wrapper'
    )[0]
    // HACK(theis, 2021_04_21): check `isScrollable` test,
    // testing if scrollWidth - clientWidth > 1 avoids some edge cases
    // of very slightly different widths, but does not seem very robust
    const isScrollable: boolean =
      scrollElement.scrollWidth - scrollElement.clientWidth > 1
    if (!isScrollable) {
      return 0
    } else {
      const currentScrollRatio =
        scrollElement.scrollLeft /
        (scrollElement.scrollWidth - scrollElement.clientWidth)
      log.error('Fix scroll computation')
      const numSnapElements: number = spectrogramImageContainerElement
        .getElementsByTagName('snap-points')
        .item(0)
        .getElementsByTagName('snap').length
      // snaps happen on <snap>'s left boundaries
      const numSnapLocations: number = numSnapElements - 1
      return Math.round(currentScrollRatio * numSnapLocations)
    }
  }

  if (configuration['spectrogram']) {
    $(() => {
      function regenerationCallback() {
        const mask = spectrogramPlaybackManager.Locator.mask
        const startIndexTop: number = getCurrentSpectrogramPositionTopLayer()

        switch (vqvaeLayerSelect.value) {
          case 'top': {
            currentConditioning_top = updateConditioningMap(
              mask,
              currentConditioning_top
            )
            break
          }
          case 'bottom': {
            currentConditioning_bottom = updateConditioningMap(
              mask,
              currentConditioning_bottom
            )
            break
          }
        }

        const sendCodesWithRequest = true
        let generationParameters =
          '?pitch=' +
          getMidiPitch().toString() +
          '&instrument_family_str=' +
          instrumentSelect.value +
          '&layer=' +
          vqvaeLayerSelect.value.split('-')[0] +
          '&temperature=1' +
          '&eraser_amplitude=0.1' +
          '&start_index_top=' +
          startIndexTop
        const split_tool_select = vqvaeLayerSelect.value.split('-')
        let command: string
        if (split_tool_select.length >= 2) {
          switch (split_tool_select[1]) {
            case 'eraser': {
              command = 'erase'
              break
            }
            case 'brush': {
              command = 'timerange-change'
              break
            }
          }
        } else {
          throw EvalError
        }

        generationParameters +=
          '&uniform_sampling=' +
          (
            split_tool_select.length == 3 && split_tool_select[2] == 'random'
          ).toString()

        loadAudioAndSpectrogram(
          spectrogramPlaybackManager,
          inpaintingApiUrl,
          command + generationParameters,
          sendCodesWithRequest,
          mask
        )
      }
      spectrogramPlaybackManager.Locator.registerCallback(regenerationCallback)
    })
  }

  $(() => {
    const playbackCommandsGridspan = document.getElementById(
      'playback-commands-gridspan'
    )
    PlaybackCommands.render(playbackCommandsGridspan)
  })

  function removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): void {
    // Strip MusicXML document of title/composer tags
    const titleNode = xmlDocument.getElementsByTagName('work-title')[0]
    const movementTitleNode = xmlDocument.getElementsByTagName(
      'movement-title'
    )[0]
    const composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent =
      ''
  }

  function getFermatas(): number[] {
    const activeFermataElements = $('.Fermata.active')
    const containedQuarterNotesList = []
    for (const activeFemataElement of activeFermataElements) {
      containedQuarterNotesList.push(
        parseInt(
          // TODO(theis): store and retrieve containedQuarterNotes
          // to and from TypeScript Fermata objects
          activeFemataElement.parentElement.getAttribute(
            'containedQuarterNotes'
          )
        )
      )
    }
    return containedQuarterNotesList
  }

  function getChordLabels(sheetLocator: SheetLocator): object[] {
    // return a stringified JSON object describing the current chords
    const chordLabels = []
    for (const chordSelector of sheetLocator.chordSelectors) {
      chordLabels.push(chordSelector.currentChord)
    }
    return chordLabels
  }

  function getMetadata(sheetLocator: SheetLocator) {
    return {
      fermatas: getFermatas(),
      chordLabels: getChordLabels(sheetLocator),
    }
  }

  function onClickTimestampBoxFactory(timeStart: Fraction, timeEnd: Fraction) {
    // FIXME(theis) hardcoded 4/4 time-signature
    const [timeRangeStart_quarter, timeRangeEnd_quarter] = [
      timeStart,
      timeEnd,
    ].map((timeFrac) => Math.round(4 * timeFrac.RealValue))

    const argsGenerationUrl =
      'timerange-change' +
      `?time_range_start_quarter=${timeRangeStart_quarter}` +
      `&time_range_end_quarter=${timeRangeEnd_quarter}`

    if (configuration['osmd']) {
      return function () {
        loadMusicXMLandMidi(
          sheetPlaybackManager,
          sheetLocator,
          inpaintingApiUrl,
          argsGenerationUrl
        )
      }
    } else if (configuration['spectrogram']) {
      const sendCodesWithRequest = true
      return function () {
        loadAudioAndSpectrogram(
          spectrogramPlaybackManager,
          inpaintingApiUrl,
          argsGenerationUrl,
          sendCodesWithRequest
        )
      }
    } else {
      throw new Error(`Unsupported application type`)
    }
  }

  // TODO don't create globals like this
  const serializer = new XMLSerializer()
  const parser = new DOMParser()
  let currentCodes_top: number[][]
  let currentCodes_bottom: number[][]

  type ConditioningMap = Map<string, (number | string)[][]>
  let currentConditioning_top: ConditioningMap
  let currentConditioning_bottom: ConditioningMap

  let currentXML: XMLDocument

  function loadNewMap(
    newConditioningMap: Record<string, (number | string)[][]>
  ): ConditioningMap {
    const conditioning_map: ConditioningMap = new Map<
      string,
      (number | string)[][]
    >()
    conditioning_map.set('pitch', newConditioningMap['pitch'])
    conditioning_map.set(
      'instrument_family_str',
      newConditioningMap['instrument_family_str']
    )
    return conditioning_map
  }

  function mapToObject(conditioning_map: ConditioningMap) {
    return {
      pitch: conditioning_map.get('pitch'),
      instrument_family_str: conditioning_map.get('instrument_family_str'),
    }
  }

  async function updateAudio(audioBlob: Blob): Promise<void> {
    // clear previous blob URL
    downloadButton.revokeBlobURL()

    // allocate new local blobURL for the received audio
    const blobUrl = URL.createObjectURL(audioBlob)
    downloadButton.content = audioBlob

    return spectrogramPlaybackManager.loadAudio(blobUrl).then(() => {
      downloadButton.targetURL = blobUrl
    })
  }

  async function updateSpectrogramImage(imageBlob: Blob): Promise<void> {
    return new Promise((resolve, _) => {
      const blobUrl = URL.createObjectURL(imageBlob)
      // HACK(theis, 2021_04_25): update the thumbnail stored in the Download button
      // for drag-and-drop, could try and generate the thumbnail only on drag-start
      // to avoid requiring this call here which one could easily forget to perform...
      downloadButton.imageContent = imageBlob
      const spectrogramImageElement: HTMLImageElement = <HTMLImageElement>(
        document.getElementById('spectrogram-image')
      )
      spectrogramImageElement.src = blobUrl
      $(() => {
        URL.revokeObjectURL(blobUrl)
        resolve()
      })
    })
  }

  async function updateAudioAndImage(
    audioPromise: Promise<Blob>,
    spectrogramImagePromise: Promise<Blob>
  ): Promise<void> {
    return await Promise.all([audioPromise, spectrogramImagePromise]).then(
      // unpack the received results and update the interface
      ([audioBlob, spectrogramImageBlob]: [Blob, Blob]) => {
        updateAudio(audioBlob)
        updateSpectrogramImage(spectrogramImageBlob)
      }
    )
  }

  /**
   * Load a MusicXml file via xHTTP request, and display its contents.
   */
  async function loadAudioAndSpectrogram(
    spectrogramPlaybackManager: SpectrogramPlaybackManager,
    inpaintingApiUrl: string,
    generationCommand: string,
    sendCodesWithRequest: boolean,
    mask?: number[][]
  ): Promise<void> {
    disableChanges()

    const payload_object = {}

    if (sendCodesWithRequest) {
      payload_object['top_code'] = currentCodes_top
      payload_object['bottom_code'] = currentCodes_bottom
      payload_object['top_conditioning'] = mapToObject(currentConditioning_top)
      payload_object['bottom_conditioning'] = mapToObject(
        currentConditioning_bottom
      )
    }
    if (mask != null) {
      // send the mask with low-frequencies first
      payload_object['mask'] = mask.reverse()
    }

    let newCodes_top: number[][]
    let newCodes_bottom: number[][]
    let newConditioning_top: Map<string, (string | number)[][]>
    let newConditioning_bottom: Map<string, (string | number)[][]>

    try {
      const generationUrl = new URL(generationCommand, inpaintingApiUrl)
      const jsonResponse = await $.post({
        url: generationUrl.href,
        data: JSON.stringify(payload_object),
        contentType: 'application/json',
        dataType: 'json',
      })

      newCodes_top = jsonResponse['top_code']
      newCodes_bottom = jsonResponse['bottom_code']
      newConditioning_top = loadNewMap(jsonResponse['top_conditioning'])
      newConditioning_bottom = loadNewMap(jsonResponse['bottom_conditioning'])

      const audioPromise = getAudioRequest(
        spectrogramPlaybackManager,
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )
      const spectrogramImagePromise = getSpectrogramImageRequest(
        spectrogramPlaybackManager,
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )

      await updateAudioAndImage(audioPromise, spectrogramImagePromise)
    } catch (e) {
      console.log(e)
      spectrogramPlaybackManager.Locator.clear()
      enableChanges()
      throw e
    }

    currentCodes_top = newCodes_top
    currentCodes_bottom = newCodes_bottom
    currentConditioning_top = newConditioning_top
    currentConditioning_bottom = newConditioning_bottom

    spectrogramPlaybackManager.Locator.vqvaeTimestepsTop =
      currentCodes_top[0].length
    triggerInterfaceRefresh()
    spectrogramPlaybackManager.Locator.clear()
    enableChanges()
  }

  function dropHandler(e: DragEvent) {
    // Prevent default behavior (Prevent file from being opened)
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile()
          console.log('... file[' + i + '].name = ' + file.name)
          const generationParameters =
            '?pitch=' +
            getMidiPitch().toString() +
            '&instrument_family_str=' +
            instrumentSelect.value
          sendAudio(
            file,
            spectrogramPlaybackManager,
            inpaintingApiUrl,
            'analyze-audio' + generationParameters
          )
          return // only send the first file
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        console.log(
          '... file[' + i + '].name = ' + e.dataTransfer.files[i].name
        )
      }
    }
  }

  async function sendAudio(
    audioBlob: Blob,
    spectrogramPlaybackManager: SpectrogramPlaybackManager,
    inpaintingApiUrl: string,
    generationCommand: string
  ) {
    disableChanges()

    const payload_object = {}

    const form = new FormData()
    form.append('audio', audioBlob)

    let newCodes_top: number[][]
    let newCodes_bottom: number[][]
    let newConditioning_top: Map<string, (string | number)[][]>
    let newConditioning_bottom: Map<string, (string | number)[][]>

    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    try {
      const jsonResponse = await $.post({
        url: generationUrl.href,
        data: form,
        contentType: false,
        dataType: 'json',
        processData: false,
      })

      newCodes_top = jsonResponse['top_code']
      newCodes_bottom = jsonResponse['bottom_code']
      newConditioning_top = loadNewMap(jsonResponse['top_conditioning'])
      newConditioning_bottom = loadNewMap(jsonResponse['bottom_conditioning'])

      const audioPromise = getAudioRequest(
        spectrogramPlaybackManager,
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )
      const spectrogramImagePromise = getSpectrogramImageRequest(
        spectrogramPlaybackManager,
        inpaintingApiUrl,
        newCodes_top,
        newCodes_bottom
      )

      await updateAudioAndImage(audioPromise, spectrogramImagePromise)
    } catch (e) {
      console.log(e)
      spectrogramPlaybackManager.Locator.clear()
      enableChanges()
      return
    }

    currentCodes_top = newCodes_top
    currentCodes_bottom = newCodes_bottom
    currentConditioning_top = newConditioning_top
    currentConditioning_bottom = newConditioning_bottom

    spectrogramPlaybackManager.Locator.vqvaeTimestepsTop =
      currentCodes_top[0].length
    triggerInterfaceRefresh()
    spectrogramPlaybackManager.Locator.clear()
    enableChanges()
  }

  async function getAudioRequest(
    spectrogramPlaybackManager: SpectrogramPlaybackManager,
    inpaintingApiUrl: string,
    top_code: number[][],
    bottom_code: number[][]
  ): Promise<Blob> {
    const payload_object = {}
    payload_object['top_code'] = top_code
    payload_object['bottom_code'] = bottom_code

    const generationCommand = '/get-audio'
    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    return $.post({
      url: generationUrl.href,
      data: JSON.stringify(payload_object),
      xhrFields: {
        responseType: 'blob',
      },
      contentType: 'application/json',
    })
  }

  async function getSpectrogramImageRequest(
    spectrogramPlaybackManager: SpectrogramPlaybackManager,
    inpaintingApiUrl: string,
    top_code: number[][],
    bottom_code: number[][]
  ): Promise<Blob> {
    const payload_object = {}

    payload_object['top_code'] = top_code
    payload_object['bottom_code'] = bottom_code

    const generationCommand = '/get-spectrogram-image'
    const generationUrl = new URL(generationCommand, inpaintingApiUrl)
    return $.post({
      url: generationUrl.href,
      data: JSON.stringify(payload_object),
      xhrFields: {
        responseType: 'blob',
      },
      contentType: 'application/json',
    })
  }

  /**
   * Load a MusicXml file via xhttp request, and display its contents.
   */
  function loadMusicXMLandMidi(
    playbackManager: SheetPlaybackManager,
    sheetLocator: SheetLocator,
    inpaintingApiUrl: string,
    generationCommand: string,
    sendSheetWithRequest = true
  ) {
    return new Promise<void>((resolve, _) => {
      disableChanges()

      const payload_object = getMetadata(sheetLocator)

      log.trace('Metadata:')
      log.trace(JSON.stringify(payload_object))

      if (sendSheetWithRequest) {
        payload_object['sheet'] = serializer.serializeToString(currentXML)
      }

      const commandURL = new URL(generationCommand, inpaintingApiUrl)
      $.post({
        url: commandURL.href,
        data: JSON.stringify(payload_object),
        contentType: 'application/json',
        dataType: 'json',
        success: (jsonResponse: {}) => {
          // update metadata
          // TODO: must check if json HAS the given metadata key first!
          // const new_fermatas = jsonResponse["fermatas"];
          if (!generationCommand.includes('generate')) {
            // TODO updateFermatas(newFermatas);
          }

          // load the received MusicXML
          const xml_sheet_string = jsonResponse['sheet']
          const xmldata = parser.parseFromString(xml_sheet_string, 'text/xml')
          removeMusicXMLHeaderNodes(xmldata)
          currentXML = xmldata

          // save current zoom level to restore it after load
          const zoom = sheetLocator.sheet.Zoom
          sheetLocator.sheet.load(currentXML).then(
            async () => {
              // restore pre-load zoom level
              sheetLocator.sheet.Zoom = zoom
              sheetLocator.render()

              const sequenceDuration = Tone.Time(
                `0:${sheetLocator.sequenceDuration_quarters}:0`
              )
              const midiConversionURL = new URL(
                '/musicxml-to-midi',
                inpaintingApiUrl
              )
              const midiBlobURL = await playbackManager.loadMidi(
                midiConversionURL.href,
                currentXML,
                Tone.Time(sequenceDuration),
                bpmControl
              )
              downloadButton.revokeBlobURL()
              downloadButton.targetURL = midiBlobURL

              enableChanges()
              resolve()
            },
            (err) => {
              log.error(err)
              enableChanges()
            }
          )
        },
      }).fail((err) => {
        log.error(err)
        enableChanges()
      })
    })
  }

  if (configuration['osmd']) {
    $(() => {
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      const instrumentsGridElement = document.createElement('div')
      instrumentsGridElement.id = 'instruments-grid'
      instrumentsGridElement.classList.add('two-columns')
      bottomControlsGridElement.appendChild(instrumentsGridElement)

      ControlLabels.createLabel(
        instrumentsGridElement,
        'instruments-grid-label'
      )

      Instruments.initializeInstruments()
      Instruments.renderInstrumentSelect(instrumentsGridElement)
      if (configuration['use_chords_instrument']) {
        Instruments.renderChordInstrumentSelect(instrumentsGridElement)
      }
      Instruments.renderDownloadButton(
        instrumentsGridElement,
        configuration['use_chords_instrument']
      )
    })
  }

  if (configuration['osmd']) {
    $(() => {
      const useSimpleSlider = !configuration['insert_advanced_controls']
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      bpmControl = new BPMControl(bottomControlsGridElement, 'bpm-control')
      bpmControl.render(useSimpleSlider, 200)

      // set the initial tempo for the app
      // if (LinkClient.isEnabled()) {
      // // if Link is enabled, use the Link tempo
      //     LinkClient.setBPMtoLinkBPM_async();
      // }
      // else
      {
        bpmControl.value = 110
      }
    })
  }

  $(() => {
    const insertWavInput: boolean = configuration['insert_wav_input']
    if (insertWavInput) {
      createWavInput(() =>
        loadMusicXMLandMidi(
          sheetPlaybackManager,
          sheetLocator,
          inpaintingApiUrl,
          'get-musicxml'
        )
      )
    }
  })

  $(() => {
    const isAdvancedControl = true
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    let defaultFilename: filenameType
    if (configuration['spectrogram']) {
      defaultFilename = { name: 'notono', extension: '.wav' }
    } else if (configuration['osmd']) {
      defaultFilename = { name: 'nonoto', extension: '.mid' }
    }

    const downloadCommandsGridspan = document.createElement('div')
    downloadCommandsGridspan.id = 'download-button-gridspan'
    downloadCommandsGridspan.classList.add('gridspan')
    downloadCommandsGridspan.classList.toggle('advanced', isAdvancedControl)
    bottomControlsGridElement.appendChild(downloadCommandsGridspan)
    downloadButton = new DownloadButton(
      downloadCommandsGridspan,
      defaultFilename,
      isAdvancedControl
    )

    if (COMPILE_ELECTRON) {
      ControlLabels.createLabel(
        bottomControlsGridElement,
        'download-button-label',
        isAdvancedControl,
        'download-button-label-with-native-drag',
        downloadButton.container
      )
    } else {
      ControlLabels.createLabel(
        bottomControlsGridElement,
        'download-button-label',
        isAdvancedControl,
        undefined,
        downloadButton.container
      )
    }
  })

  $(() => {
    const isAdvancedControl = true
    if (configuration['osmd'] && isAdvancedControl) {
      LinkClient.kill()
      // Insert LINK client controls
      LinkClientCommands.render(playbackManager)
    }
  })

  if (configuration['osmd']) {
    $(() => {
      // Insert zoom controls
      const zoomControlsGridElement = document.createElement('div')
      zoomControlsGridElement.id = 'osmd-zoom-controls'
      // zoomControlsGridElement.classList.add('two-columns');
      const mainPanel = document.getElementById('main-panel')
      mainPanel.appendChild(zoomControlsGridElement)
      renderZoomControls(zoomControlsGridElement)
    })
  }

  $(() => {
    // register file drop handler
    document.body.addEventListener('drop', dropHandler)
  })

  $(() => {
    if (configuration['spectrogram']) {
      const isAdvancedControl = true
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      const volumeControlsGridElement: HTMLElement = document.createElement(
        'div'
      )
      volumeControlsGridElement.id = 'volume-controls-gridspan'
      volumeControlsGridElement.classList.add('gridspan')
      volumeControlsGridElement.classList.toggle('advanced', isAdvancedControl)
      bottomControlsGridElement.appendChild(volumeControlsGridElement)

      const fadeInControlElement = document.createElement('div')
      fadeInControlElement.id = 'fade-in-control'
      fadeInControlElement.classList.add('control-item')
      fadeInControlElement.classList.toggle('advanced', isAdvancedControl)
      volumeControlsGridElement.appendChild(fadeInControlElement)
      SpectrogramPlayback.renderFadeInControl(
        fadeInControlElement,
        spectrogramPlaybackManager
      )
      ControlLabels.createLabel(
        fadeInControlElement,
        'fade-in-control-label',
        isAdvancedControl,
        undefined,
        volumeControlsGridElement
      )

      const gainControlElement = document.createElement('div')
      gainControlElement.id = 'gain-control'
      gainControlElement.classList.add('control-item')
      gainControlElement.classList.toggle('advanced', isAdvancedControl)
      volumeControlsGridElement.appendChild(gainControlElement)
      SpectrogramPlayback.renderGainControl(
        gainControlElement,
        spectrogramPlaybackManager
      )
      ControlLabels.createLabel(
        gainControlElement,
        'gain-control-label',
        isAdvancedControl,
        undefined,
        volumeControlsGridElement
      )
    }
  })

  $(() => {
    if (configuration['insert_help']) {
      let helpTrip: myTrip
      if (configuration['spectrogram']) {
        // initialize help menu
        helpTrip = new NotonoTrip(
          [configuration['main_language']],
          spectrogramPlaybackManager.Locator,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : null
        )
      } else if (configuration['osmd']) {
        // initialize help menu
        helpTrip = new NonotoTrip(
          [configuration['main_language']],
          sheetLocator,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : null
        )
      }

      helpTrip.renderIcon(document.getElementById('main-panel'))
    }
  })
}

$(() => {
  // register minimal error handler
  $(document).ajaxError((error) => console.log(error))

  SplashScreen.render(render)
})

$(() => {
  // disable drop events on whole window
  window.addEventListener(
    'dragover',
    function (e) {
      e.preventDefault()
      e.stopPropagation()
    },
    false
  )
  window.addEventListener(
    'drop',
    function (e) {
      e.preventDefault()
      e.stopPropagation()
    },
    false
  )
})

function mapTouchEventsToMouseSimplebar(): void {
  // enables using touch events to drag the simplebar scrollbar
  // tweaked version of this initial proposition:
  // https://github.com/Grsmto/simplebar/issues/156#issuecomment-376137543
  const target = $('[data-simplebar]')[0]
  function mapTouchEvents(event: TouchEvent, simulatedType: string) {
    //Ignore any mapping if more than 1 fingers touching
    if (event.changedTouches.length > 1) {
      return
    }

    const touch = event.changedTouches[0]

    const eventToSimulate = new MouseEvent(simulatedType, {
      bubbles: true,
      cancelable: false,
      view: window,
      detail: 1,
      screenX: touch.screenX,
      screenY: touch.screenY,
      clientX: touch.clientX,
      clientY: touch.clientY,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
    })

    touch.target.dispatchEvent(eventToSimulate)
  }

  const addEventListenerOptions: AddEventListenerOptions = {
    capture: true,
  }
  target.addEventListener(
    'touchstart',
    function (e) {
      // required to trigger an update of the mouse position stored by simplebar,
      // emulates moving the mouse onto the scrollbar THEN clicking,
      // otherwise simplebar uses the last clicked/swiped position, usually outside of the
      // scrollbar and therefore considers that the click happened outside of the bar
      mapTouchEvents(e, 'mousemove')
      mapTouchEvents(e, 'mousedown')
    },
    addEventListenerOptions
  )
  target.addEventListener(
    'touchmove',
    function (e) {
      mapTouchEvents(e, 'mousemove')
    },
    addEventListenerOptions
  )
  target.addEventListener(
    'touchend',
    function (e) {
      mapTouchEvents(e, 'mouseup')
    },
    addEventListenerOptions
  )
  target.addEventListener(
    'touchcancel',
    function (e) {
      mapTouchEvents(e, 'mouseup')
    },
    addEventListenerOptions
  )
}
