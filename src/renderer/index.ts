import $ from 'jquery'
import Tone from 'tone'

import log from 'loglevel'
log.setLevel(log.levels.INFO)

import {
  SheetInpainter,
  SpectrogramInpainter,
  VqvaeLayer,
  NotonoTool,
  LayerAndTool,
  Inpainter,
} from './inpainter'
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
import { AbletonLinkClient } from './ableton_link/linkClient.abstract'
import { getAbletonLinkClientClass } from './ableton_link/linkClient'
import * as LinkClientCommands from './ableton_link/linkClientCommands'
import { DownloadButton, filename as filenameType } from './downloadCommand'

import { MyShepherdTour, NonotoTour, NotonoTour } from './helpTour'

import { createLFOControls } from './lfo'
import { CycleSelect } from './cycleSelect'
import { getPathToStaticFile } from './staticPath'
import * as ControlLabels from './controlLabels'
import * as GranularitySelect from './granularitySelect'
import * as SplashScreen from './startup'

// WARNING: importing style sheets, order matters!
import 'simplebar'
import 'simplebar/src/simplebar.css'

import colors from '../common/styles/mixins/_colors.module.scss'

import '../common/styles/main.scss'
import '../common/styles/simplebar.scss'
import '../common/styles/controls.scss'
import '../common/styles/overlays.scss'

import '../common/styles/osmd.scss'
import '../common/styles/spectrogram.scss'
import '../common/styles/disableMouse.scss'

declare let COMPILE_ELECTRON: boolean

import defaultConfiguration from '../common/default_config.json'
import { applicationConfiguration } from './startup'
import { setBackgroundColorElectron, getTitleBarDisplay } from './utils/display'

// TODO(@tbazin, 2021/08/05): clean-up this usage of unknown
let inpainter: Inpainter<PlaybackManager, unknown>
let playbackManager: PlaybackManager
let sheetPlaybackManager: MidiSheetPlaybackManager
let spectrogramPlaybackManager: SpectrogramPlaybackManager
let bpmControl: BPMControl
let instrumentConstraintSelect: NexusSelectWithShuffle
let pitchClassConstraintSelect: NexusSelect
let octaveConstraintControl: NumberControl
let downloadButton: DownloadButton
let linkClient: AbletonLinkClient

function render(
  configuration: applicationConfiguration = defaultConfiguration
): void {
  if (document.getElementById('header')) {
    // do nothing if the app has already been rendered
    return
  }

  document.body.classList.add('running', 'advanced-controls-disabled')

  if (COMPILE_ELECTRON) {
    document.body.classList.add('electron')
    getTitleBarDisplay()
      .then((titleBarDisplay) => {
        if (titleBarDisplay == 'hiddenInset') {
          document.body.classList.add('electron-hiddenInset-window-controls')
        }
      })
      .catch((e) => {
        log.error(e)
      })
  }

  if (configuration['osmd']) {
    document.body.classList.add('nonoto')
    document.body.setAttribute('theme', 'millenial-pink')
    document.body.getAttribute('theme')
    void setBackgroundColorElectron(
      colors.millenial_pink_panes_background_color
    )
    setNexusColors(
      colors.millenial_pink_active_control,
      colors.millenial_pink_idle_control
    )
  } else if (configuration['spectrogram']) {
    document.body.classList.add('notono')
    document.body.setAttribute('theme', 'lavender-dark')
    void setBackgroundColorElectron(
      colors.lavender_dark_mode_panes_background_color
    )
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
      if (!inpainter.disabled) {
        void sampleNewData(inpaintingApiAddress)
      }
    })
  })

  $(() => {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    const bottomControlsExpandTabElement = document.createElement('div')
    bottomControlsExpandTabElement.id = 'bottom-controls-expand'
    bottomControlsExpandTabElement.classList.add('expand-tab')
    bottomControlsGridElement.appendChild(bottomControlsExpandTabElement)
    bottomControlsExpandTabElement.addEventListener('click', function () {
      document.body.classList.toggle('advanced-controls-disabled')
      inpainter.refresh()
    })

    const playbackCommandsGridspan = document.createElement('div')
    playbackCommandsGridspan.id = 'playback-commands-gridspan'
    playbackCommandsGridspan.classList.add('gridspan')
    bottomControlsGridElement.appendChild(playbackCommandsGridspan)

    if (configuration['spectrogram']) {
      // create element for highlighting control grid spans in help
      const constraintsGridspanElement = document.createElement('div')
      constraintsGridspanElement.id = 'constraints-gridspan'
      constraintsGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(constraintsGridspanElement)

      const constraintsContainerElement = document.createElement('div')
      constraintsContainerElement.id = 'constraints-container'
      constraintsContainerElement.classList.add('gridspan')
      // constraintsContainerElement.classList.add('multi-column-gridspan')
      constraintsGridspanElement.appendChild(constraintsContainerElement)

      ControlLabels.createLabel(
        constraintsContainerElement,
        'constraints-gridspan-label',
        false,
        undefined,
        constraintsGridspanElement
      )

      const editToolsGridspanElement = document.createElement('div')
      editToolsGridspanElement.id = 'edit-tools-gridspan'
      editToolsGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(editToolsGridspanElement)
    }
  })

  if (configuration['osmd']) {
    $(() => {
      const useSimpleSlider = !configuration['insert_advanced_controls']
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      const bpmControlGridspanElement = document.createElement('div')
      bpmControlGridspanElement.id = 'bpm-control-gridspan'
      bpmControlGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(bpmControlGridspanElement)

      bpmControl = new BPMControl(bpmControlGridspanElement, 'bpm-control')
      bpmControl.render(useSimpleSlider, 200)
      bpmControl.value = 80
    })
  }

  $(() => {
    const isAdvancedControl = true
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    let defaultFilename: filenameType
    if (configuration['spectrogram']) {
      defaultFilename = { name: 'notono', extension: '.wav' }
    } else if (configuration['osmd']) {
      log.warn('Fix DownloadButton drag-out for MIDI')
      defaultFilename = { name: 'nonoto', extension: '.mid' }
    } else {
      throw new Error('Unsupported configuration')
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

  if (configuration['spectrogram']) {
    $(() => {
      const constraintsContainerElement = document.getElementById(
        'constraints-container'
      )
      const instrumentConstraintSelectElement = document.createElement('div')
      instrumentConstraintSelectElement.id = 'instrument-control'
      instrumentConstraintSelectElement.classList.add('control-item')
      constraintsContainerElement.appendChild(instrumentConstraintSelectElement)
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
        undefined,
        constraintsContainerElement
      )
      const {
        pitchClassSelect,
        octaveControl,
      } = renderPitchRootAndOctaveControl(constraintsContainerElement)
      pitchClassConstraintSelect = pitchClassSelect
      octaveConstraintControl = octaveControl
    })
  }

  let sheetInpainter: SheetInpainter
  $(() => {
    const mainPanel = document.getElementById('main-panel')
    const bottomControlsGridElement = document.getElementById('bottom-controls')

    if (configuration['osmd']) {
      const granularityControlsGridspanElement = document.createElement('div')
      granularityControlsGridspanElement.id = 'granularity-controls-gridspan'
      granularityControlsGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(granularityControlsGridspanElement)

      const granularitySelect = GranularitySelect.renderGranularitySelect(
        granularityControlsGridspanElement,
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
      sheetPlaybackManager = new MidiSheetPlaybackManager(bpmControl)
      sheetInpainter = new SheetInpainter(
        sheetPlaybackManager,
        sheetContainer,
        granularitySelect,
        downloadButton,
        inpaintingApiAddress,
        {
          autoResize: autoResize,
          drawingParameters: 'compacttight',
          drawPartNames: false,
        },
        configuration['annotation_types'],
        allowOnlyOneFermata
      )
      inpainter = sheetInpainter

      playbackManager = sheetPlaybackManager

      if (configuration['use_chords_instrument']) {
        sheetPlaybackManager.scheduleChordsPlayer(
          configuration['chords_midi_channel'],
          sheetInpainter
        )
      }
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

      const vqvaeLayerDimensions: Map<
        VqvaeLayer,
        [number, number, Tone.Unit.Seconds]
      > = new Map([
        [VqvaeLayer.Top, [32, 4, 1]],
        [VqvaeLayer.Bottom, [64, 8, 0.5]],
      ])

      const iconsBasePath = getPathToStaticFile('icons')

      const editToolsGridspanElement = document.getElementById(
        'edit-tools-gridspan'
      )
      const editToolSelectContainerElement = document.createElement('div')
      editToolSelectContainerElement.id = 'edit-tool-select-container'
      editToolSelectContainerElement.classList.add('control-item')
      editToolsGridspanElement.appendChild(editToolSelectContainerElement)
      ControlLabels.createLabel(
        editToolSelectContainerElement,
        'edit-tool-select-label',
        false,
        undefined,
        editToolsGridspanElement
      )

      const vqvaeLayerOnChange = function (
        this: CycleSelect<LayerAndTool>
      ): void {
        const numColumnsTop = vqvaeLayerDimensions.get(VqvaeLayer.Top)[1]
        const [
          newNumRows,
          newNumColumns,
          columnDuration,
        ] = vqvaeLayerDimensions.get(this.value.layer)
        spectrogramInpainter.columnDuration = columnDuration
        inpainter.render(newNumRows, newNumColumns, numColumnsTop)
        inpainter.interfaceContainer.classList.toggle(
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
      const spectrogramInpainter = new SpectrogramInpainter(
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
      const volumeControlsGridspanElement = document.createElement('div')
      volumeControlsGridspanElement.id = 'mixing-controls-gridspan'
      volumeControlsGridspanElement.classList.add('gridspan')
      volumeControlsGridspanElement.classList.toggle(
        'advanced',
        isAdvancedControl
      )
      bottomControlsGridElement.appendChild(volumeControlsGridspanElement)

      const volumeControlsContainerElement = document.createElement('div')
      volumeControlsContainerElement.id = 'volume-controls-container'
      volumeControlsContainerElement.classList.add('gridspan')
      volumeControlsContainerElement.classList.toggle(
        'advanced',
        isAdvancedControl
      )
      volumeControlsGridspanElement.appendChild(volumeControlsContainerElement)

      ControlLabels.createLabel(
        volumeControlsContainerElement,
        'mixing-controls-label',
        true,
        undefined,
        volumeControlsGridspanElement
      )

      spectrogramInpainter.playbackManager.renderFadeInControl(
        volumeControlsContainerElement
      )
      spectrogramInpainter.playbackManager.renderGainControl(
        volumeControlsContainerElement
      )

      playbackManager = spectrogramPlaybackManager
      inpainter = spectrogramInpainter

      spectrogramInpainter.editToolSelect.emit(
        spectrogramInpainter.editToolSelect.events.ValueChanged
      )
    }
  })

  $(() => {
    const playbackCommandsGridspan = document.getElementById(
      'playback-commands-gridspan'
    )
    PlaybackCommands.render(playbackCommandsGridspan, playbackManager)
  })

  if (configuration['osmd']) {
    $(() => {
      const bottomControlsGridElement = document.getElementById(
        'bottom-controls'
      )
      const instrumentsControlGridspanElement = document.createElement('div')
      instrumentsControlGridspanElement.id = 'instruments-control-gridspan'
      instrumentsControlGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(instrumentsControlGridspanElement)

      const instrumentsGridElement = document.createElement('div')
      instrumentsGridElement.id = 'instruments-grid'
      instrumentsGridElement.classList.add('grid-auto-column')
      instrumentsControlGridspanElement.appendChild(instrumentsGridElement)

      ControlLabels.createLabel(
        instrumentsGridElement,
        'instruments-grid-label',
        false,
        undefined,
        instrumentsControlGridspanElement
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

  $(() => {
    // Insert LINK client controls
    const useAdvancedControls = true

    if (COMPILE_ELECTRON && configuration['osmd'] && useAdvancedControls) {
      getAbletonLinkClientClass().then(
        (LinkClient) => {
          linkClient = new LinkClient(bpmControl)
          playbackManager.registerLinkClient(linkClient)

          // render AbletonLink control interface
          const bottomControlsGridElement = document.getElementById(
            'bottom-controls'
          )
          const abletonLinkSettingsGridspan = document.createElement('div')
          abletonLinkSettingsGridspan.id = 'ableton-link-settings-gridspan'
          abletonLinkSettingsGridspan.classList.add('gridspan')
          abletonLinkSettingsGridspan.classList.add('advanced')
          bottomControlsGridElement.appendChild(abletonLinkSettingsGridspan)

          LinkClientCommands.render(
            abletonLinkSettingsGridspan,
            linkClient,
            sheetInpainter.playbackManager
          )
        },
        (err) => log.error(err)
      )
    }
  })

  $(() => {
    if (configuration['insert_advanced_controls'] && configuration['osmd']) {
      void import('./midiOut').then((midiOutModule) => {
        void midiOutModule.render(sheetInpainter.playbackManager)
      })
    } else if (
      configuration['insert_advanced_controls'] &&
      configuration['spectrogram']
    ) {
      void import('./midiIn').then((midiInModule) => {
        log.debug('Rendering Midi Input controls')
        void midiInModule.render()
      })
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
      sheetInpainter.renderZoomControls(zoomControlsGridElement)
    })
  }

  $(() => {
    if (configuration['insert_help']) {
      let helpTour: MyShepherdTour
      if (configuration['spectrogram']) {
        // initialize help menu
        helpTour = new NotonoTour(
          [configuration['main_language']],
          inpainter,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        )
      } else if (configuration['osmd']) {
        // initialize help menu
        helpTour = new NonotoTour(
          [configuration['main_language']],
          sheetInpainter,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        )
      } else {
        // FIXME(@tbazin, 2021/10/14): else branch should not be required,
        // alternatives should be detected automatically
        throw new Error('Unsupported configuration')
      }

      helpTour.renderIcon(document.getElementById('main-panel'))
    }
  })

  async function sampleNewData(inpaintingApiAddress: URL): Promise<void> {
    let promise: Promise<Inpainter<PlaybackManager, unknown>>
    if (inpainter.dataType == 'sheet') {
      promise = inpainter.generate(inpaintingApiAddress)
    } else if (inpainter.dataType == 'spectrogram') {
      promise = inpainter.sampleFromDataset(inpaintingApiAddress)
    } else {
      // FIXME(@tbazin, 2021/09/14): else branch should not be required,
      // alternatives should be detected automatically
      throw new Error('Unsupported configuration')
    }
    return promise.then(
      () => log.info('Retrieved new media from server'),
      () => log.error('Could not retrieve initial media')
    )
  }

  $(() => {
    void sampleNewData(inpaintingApiAddress).then(() => {
      inpainter.emit('ready')
    })
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
