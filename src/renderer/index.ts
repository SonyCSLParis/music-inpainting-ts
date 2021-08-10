import { Fraction } from 'opensheetmusicdisplay'
import $ from 'jquery'

import log from 'loglevel'
log.setLevel(log.levels.INFO)

import {
  SheetLocator,
  SpectrogramLocator,
  VqvaeLayer,
  NotonoTool,
  LayerAndTool,
  Locator,
} from './locator'
import { NexusSelect } from 'nexusui'
import {
  NexusSelectWithShuffle,
  setColors as setNexusColors,
} from './nexusColored'

import * as Header from './header'

import * as PlaybackCommands from './playbackCommands'
import { PlaybackManager } from './playback'
import MidiSheetPlaybackManager from './sheetPlayback'
import { MultiChannelSpectrogramPlaybackManager as SpectrogramPlaybackManager } from './spectrogramPlayback'

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

declare let COMPILE_ELECTRON: boolean

import defaultConfiguration from '../common/default_config.json'
import { applicationConfiguration } from './startup'

// TODO(@tbazin, 2021/08/05): clean-up this usage of unknown
let locator: Locator<PlaybackManager, unknown>
let playbackManager: PlaybackManager
let sheetPlaybackManager: MidiSheetPlaybackManager
let spectrogramPlaybackManager: SpectrogramPlaybackManager
let bpmControl: BPMControl
let instrumentConstraintSelect: NexusSelectWithShuffle
let pitchClassConstraintSelect: NexusSelect
let octaveConstraintControl: NumberControl
let downloadButton: DownloadButton

function render(
  configuration: applicationConfiguration = defaultConfiguration
): void {
  // disableChanges()
  document.body.classList.add('running')

  if (configuration['osmd']) {
    document.body.classList.add('nonoto')
    setNexusColors(
      colors.millenial_pink_active_control,
      colors.millenial_pink_idle_control
    )
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

  const granularities_quarters: number[] = configuration[
    'granularities_quarters'
  ].sort()

  $(() => {
    let applicationElement = document.getElementById('app')
    if (applicationElement == null) {
      applicationElement = document.createElement('div')
      applicationElement.id = 'app'
      document.body.appendChild(applicationElement)
    }

    const headerGridElement = document.createElement('header')
    headerGridElement.id = 'header'
    applicationElement.appendChild(headerGridElement)

    const mainPanel = document.createElement('div')
    mainPanel.id = 'main-panel'
    applicationElement.appendChild(mainPanel)

    const bottomControlsGridElement = document.createElement('footer')
    bottomControlsGridElement.id = 'bottom-controls'
    applicationElement.appendChild(bottomControlsGridElement)
  })

  $(() => {
    const headerGridElement = document.getElementById('header')
    Header.render(headerGridElement, configuration)
    const appTitleElement = document.getElementById('app-title')
    appTitleElement.addEventListener('click', () => {
      sampleNewData(inpaintingApiAddress)
    })
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
    if (configuration['spectrogram']) {
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
    const insertLFO: boolean = configuration['insert_variations_lfo']
    if (insertLFO) {
      createLFOControls()
    }
  })

  const inpaintingApiAddress: URL = new URL(
    configuration['inpainting_api_address']
  )

  function insertLoadingSpinner(container: HTMLElement): HTMLElement {
    const spinnerElement: HTMLElement = document.createElement('i')
    spinnerElement.classList.add('fas', 'fa-4x', 'fa-spin', 'fa-cog')
    spinnerElement.id = 'loading-spinner'
    container.appendChild(spinnerElement)

    return spinnerElement
  }

  if (configuration['spectrogram']) {
    $(() => {
      const constraintsGridspanElement = document.getElementById(
        'constraints-gridspan'
      )

      const instrumentConstraintSelectGridspanElement: HTMLElement = document.createElement(
        'div'
      )
      instrumentConstraintSelectGridspanElement.id =
        'instrument-select-gridspan'
      instrumentConstraintSelectGridspanElement.classList.add('gridspan')
      constraintsGridspanElement.appendChild(
        instrumentConstraintSelectGridspanElement
      )
      const instrumentConstraintSelectElement = document.createElement('div')
      instrumentConstraintSelectElement.id = 'instrument-control'
      instrumentConstraintSelectElement.classList.add('control-item')
      instrumentConstraintSelectGridspanElement.appendChild(
        instrumentConstraintSelectElement
      )
      // TODO(theis, 2021_04_20): retrieve instrument options from Inpainting API
      const instrumentConstraintSelectOptions = [
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
      instrumentConstraintSelect = new NexusSelectWithShuffle(
        '#instrument-control',
        {
          size: [120, 50],
          options: instrumentConstraintSelectOptions,
        }
      )
      // set the initial instrument constraint randomly
      instrumentConstraintSelect.shuffle()

      ControlLabels.createLabel(
        instrumentConstraintSelectElement,
        'instrument-control-label',
        false,
        null,
        instrumentConstraintSelectGridspanElement
      )
      const {
        pitchClassSelect,
        octaveControl,
      } = renderPitchRootAndOctaveControl()
      pitchClassConstraintSelect = pitchClassSelect
      octaveConstraintControl = octaveControl
    })
  }

  $(() => {
    // HACK(theis): delayed import necessary to avoid
    // failure on startup if the browser does not support the Web MIDI API
    const midiOutImplementation: typeof MidiOut = require('./midiOut')
    const midiInImplementation: typeof MidiIn = require('./midiIn')
    if (configuration['insert_advanced_controls'] && configuration['osmd']) {
      void midiOutImplementation.render()
    } else if (
      configuration['insert_advanced_controls'] &&
      configuration['spectrogram']
    ) {
      void midiInImplementation.render()
    }
  })

  let sheetLocator: SheetLocator
  $(() => {
    const mainPanel = document.getElementById('main-panel')
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    const spinnerElement = insertLoadingSpinner(mainPanel)

    if (configuration['osmd']) {
      const granularitySelect = GranularitySelect.renderGranularitySelect(
        bottomControlsGridElement,
        granularities_quarters
      )

      const allowOnlyOneFermata: boolean =
        configuration['allow_only_one_fermata']
      const sheetContainer = document.createElement('div')
      sheetContainer.id = 'sheet-container'
      mainPanel.appendChild(sheetContainer)
      /*
       * Create a new instance of OpenSheetMusicDisplay and tell it to draw inside
       * the container we've created in the steps before. The second parameter tells OSMD
       * not to redraw on resize.
       */

      const autoResize = false
      // TODO(theis): check proper way of enforcing subtype
      sheetPlaybackManager = new MidiSheetPlaybackManager()
      sheetLocator = new SheetLocator(
        sheetPlaybackManager,
        sheetContainer,
        granularitySelect,
        inpaintingApiAddress,
        {
          autoResize: autoResize,
          drawingParameters: 'compacttight',
          drawPartNames: false,
        },
        configuration['annotation_types'],
        allowOnlyOneFermata
      )
      locator = sheetLocator

      playbackManager = sheetPlaybackManager

      if (configuration['use_chords_instrument']) {
        sheetPlaybackManager.scheduleChordsPlayer(
          configuration['chords_midi_channel'],
          sheetLocator
        )
      }
      $(() => {
        // requesting the initial sheet, so can't send any sheet along
        const sendSheetWithRequest = false
        void sheetLocator.loadMusicXMLandMidi(
          inpaintingApiAddress,
          'generate',
          sendSheetWithRequest
        )
      })
    } else if (configuration['spectrogram']) {
      // create and render editToolSelect element
      const vqvaeLayerIcons: Map<LayerAndTool, string> = new Map([
        [
          { layer: VqvaeLayer.Top, tool: NotonoTool.Inpaint },
          'paint-roller.svg',
        ],
        [
          { layer: VqvaeLayer.Bottom, tool: NotonoTool.Inpaint },
          'paint-brush-small.svg',
        ],
        [
          { layer: VqvaeLayer.Top, tool: NotonoTool.InpaintRandom },
          'paint-roller-random.svg',
        ],
        [
          { layer: VqvaeLayer.Bottom, tool: NotonoTool.Inpaint },
          'paint-brush-small-random.svg',
        ],
        [{ layer: VqvaeLayer.Top, tool: NotonoTool.Eraser }, 'edit-tools.svg'],
      ])

      const vqvaeLayerDimensions: Map<VqvaeLayer, [number, number]> = new Map([
        [VqvaeLayer.Top, [32, 4]],
        [VqvaeLayer.Bottom, [64, 8]],
      ])

      const iconsBasePath = getPathToStaticFile('icons')

      const editToolSelectContainerElement = document.createElement('div')
      editToolSelectContainerElement.id = 'edit-tool-select-container'
      editToolSelectContainerElement.classList.add('control-item')
      bottomControlsGridElement.appendChild(editToolSelectContainerElement)
      ControlLabels.createLabel(
        editToolSelectContainerElement,
        'edit-tool-select-label'
      )

      const vqvaeLayerOnChange = function (
        this: CycleSelect<LayerAndTool>
      ): void {
        const [newNumRows, newNumColumns] = vqvaeLayerDimensions.get(
          this.value.layer
        )
        const [_, numColumnsTop] = vqvaeLayerDimensions.get(VqvaeLayer.Top)
        locator.render(newNumRows, newNumColumns, numColumnsTop)
        locator.interfaceContainer.classList.toggle(
          'eraser',
          this.value.tool == NotonoTool.Eraser
        )
      }

      const editToolSelect = new CycleSelect(
        editToolSelectContainerElement,
        vqvaeLayerOnChange,
        vqvaeLayerIcons,
        iconsBasePath
      )

      const spectrogramContainerElement = document.createElement('div')
      spectrogramContainerElement.id = 'spectrogram-container'
      mainPanel.appendChild(spectrogramContainerElement)

      spectrogramPlaybackManager = new SpectrogramPlaybackManager()
      const spectrogramLocator = new SpectrogramLocator(
        spectrogramPlaybackManager,
        spectrogramContainerElement,
        inpaintingApiAddress,
        editToolSelect,
        downloadButton,
        instrumentConstraintSelect,
        octaveConstraintControl,
        pitchClassConstraintSelect
      )

      const isAdvancedControl = true
      const volumeControlsGridElement = document.createElement('div')
      volumeControlsGridElement.id = 'volume-controls-gridspan'
      volumeControlsGridElement.classList.add('gridspan')
      volumeControlsGridElement.classList.toggle('advanced', isAdvancedControl)
      bottomControlsGridElement.appendChild(volumeControlsGridElement)

      spectrogramLocator.playbackManager.renderFadeInControl(
        volumeControlsGridElement
      )
      spectrogramLocator.playbackManager.renderGainControl(
        volumeControlsGridElement
      )

      playbackManager = spectrogramPlaybackManager
      locator = spectrogramLocator

      void spectrogramLocator.sample()
    }
  })

  $(() => {
    const playbackCommandsGridspan = document.getElementById(
      'playback-commands-gridspan'
    )
    PlaybackCommands.render(playbackCommandsGridspan, playbackManager)
  })

  function sampleNewData(inpaintingApiAddress: URL) {
    if (locator.dataType == 'sheet') {
      void locator.generate(inpaintingApiAddress)
    } else if (locator.dataType == 'spectrogram') {
      void locator.sample(inpaintingApiAddress)
    }
  }

  if (configuration['osmd']) {
    $(() => {
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      const instrumentsGridElement = document.createElement('div')
      instrumentsGridElement.id = 'instruments-grid'
      instrumentsGridElement.classList.add('grid-auto-column')
      bottomControlsGridElement.appendChild(instrumentsGridElement)

      ControlLabels.createLabel(
        instrumentsGridElement,
        'instruments-grid-label'
      )

      Instruments.initializeInstruments()
      Instruments.renderInstrumentSelect(instrumentsGridElement)
      if (configuration['use_chords_instrument']) {
        Instruments.renderChordsInstrumentSelect(instrumentsGridElement)
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

  // $(() => {
  //   const insertWavInput: boolean = configuration['insert_wav_input']
  //   if (insertWavInput) {
  //     createWavInput(
  //       (data: Blob) => void locator.analyze(data, inpaintingApiAddress)
  //     )
  //   }
  // })

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
      zoomControlsGridElement.classList.add('zoom-control', 'control-item')
      // zoomControlsGridElement.classList.add('two-columns');
      const mainPanel = document.getElementById('main-panel')
      mainPanel.appendChild(zoomControlsGridElement)
      sheetLocator.renderZoomControls(zoomControlsGridElement)
    })
  }

  $(() => {
    if (configuration['insert_help']) {
      let helpTrip: myTrip
      if (configuration['spectrogram']) {
        // initialize help menu
        helpTrip = new NotonoTrip(
          [configuration['main_language']],
          locator,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        )
      } else if (configuration['osmd']) {
        // initialize help menu
        helpTrip = new NonotoTrip(
          [configuration['main_language']],
          sheetLocator,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
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
