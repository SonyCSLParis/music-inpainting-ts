import $ from 'jquery'
import log from 'loglevel'
log.setLevel(log.levels.DEBUG)

import {
  PopUndoManager,
  UndoableInpainter,
  UndoableInpainterEdit,
} from './inpainter/inpainter'
import { InpainterGraphicalView } from './inpainter/inpainterGraphicalView'
import { SheetData, SheetInpainter } from './sheet/sheetInpainter'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import {
  SpectrogramInpainter,
  VqvaeLayer,
  NotonoTool,
  LayerAndTool,
  AudioVQVAELayerDimensions,
} from './spectrogram/spectrogramInpainter'
import { SpectrogramInpainterGraphicalView } from './spectrogram/spectrogramInpainterGraphicalView'
import { PiaInpainter, PianoRollData } from './piano_roll/pianoRollInpainter'
import { PianoRollInpainterGraphicalView } from './piano_roll/pianoRollInpainterGraphicalView'

import { NexusSelect } from 'nexusui'
import Nexus, {
  NexusSelectWithShuffle,
  setColors as setNexusColors,
} from './nexusColored'

import * as Header from './header'

import { PlaybackCommands } from './playbackCommands'
import { FixedRecorder, MidiRecorder, MyCallback } from './piano_roll/record'
import { PlaybackManager } from './playback'
import MidiSheetPlaybackManager from './sheetPlayback'
import { MultiChannelSpectrogramPlaybackManager as SpectrogramPlaybackManager } from './spectrogramPlayback'

import * as Instruments from '../instruments/instruments'
import {
  BPMControl,
  PlaybackRateControl,
  renderPitchRootAndOctaveControl,
} from './numberControl'
import { AbletonLinkClient } from './ableton_link/linkClient.abstract'
import { getAbletonLinkClientClass } from './ableton_link/linkClient'
import * as LinkClientCommands from './ableton_link/linkClientCommands'
import {
  DownloadButton,
  filename as filenameType,
  NotonoDownloadButton,
  PianotoDownloadButton,
  SheetDownloadButton,
} from './downloadCommand'

import { MyShepherdTour, NonotoTour, NotonoTour } from './helpTour'

import { createLFOControls } from './lfo'
import {
  bindSelectModel,
  VariableValue,
  createFontAwesomeElements,
  CycleSelectViewWithDisable,
  NullableVariableValue,
} from './cycleSelect'
import * as ControlLabels from './controlLabels'
import * as GranularitySelect from './granularitySelect'
import { SplashScreen, applicationConfiguration } from './startup'

// WARNING: importing style sheets, order matters!
import 'simplebar'
import 'simplebar/src/simplebar.css'

import colors from '../styles/mixins/_colors.module.scss'

import '../styles/main.scss'
import '../styles/mixins/_fonts.scss'
import '../styles/simplebar.scss'
import '../styles/controls.scss'
import '../styles/overlays.scss'

import '../styles/osmd.scss'
import '../styles/spectrogram.scss'
import './piano_roll/Player.scss'
import '../styles/disableMouse.scss'

const VITE_DUMMY_GENERATE = import.meta.env.VITE_DUMMY_GENERATE != undefined
const VITE_AUTOSTART = import.meta.env.VITE_AUTOSTART != undefined
const VITE_NO_AUTOLOAD_SAMPLES =
  import.meta.env.VITE_NO_AUTOLOAD_SAMPLES != undefined
const VITE_COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

if (VITE_COMPILE_ELECTRON) {
  window.ipcRendererInterface
    .getWindowId()
    .then((windowId) => (window.electronWindowId = windowId))
  setBackgroundColorElectron(colors.darkgray)
}

import defaultConfiguration from '../../common/default_config.json'
import { setBackgroundColorElectron, getTitleBarDisplay } from './utils/display'
import { UndoableEdit, UndoManager } from 'typed-undo'
import { IOSMDOptions } from 'opensheetmusicdisplay'

let inpainter: UndoableInpainter
let sheetInpainter: SheetInpainter | null = null
let piaInpainter: PiaInpainter | null = null
let spectrogramInpainter: SpectrogramInpainter | null = null
let inpainterGraphicalView: InpainterGraphicalView
let spectrogramInpainterGraphicalView:
  | SpectrogramInpainterGraphicalView
  | undefined = undefined
let sheetInpainterGraphicalView: SheetInpainterGraphicalView | undefined =
  undefined
let piaInpainterGraphicalView: PianoRollInpainterGraphicalView | undefined =
  undefined
let playbackManager: PlaybackManager
let sheetPlaybackManager: MidiSheetPlaybackManager
let piaPlaybackManager: MidiSheetPlaybackManager
let spectrogramPlaybackManager: SpectrogramPlaybackManager
let bpmControl: BPMControl
let instrumentConstraintSelect: NexusSelectWithShuffle
let pitchClassConstraintSelect: NexusSelect
let octaveConstraintControl: NexusSelect
let downloadButton: DownloadButton
let linkClient: AbletonLinkClient
let helpTour: MyShepherdTour
let midiFileSelect: MidiFileSelector | null = null

let readyToPlayPromises: Promise<void>[] = []

async function render(
  configuration: applicationConfiguration = defaultConfiguration
): Promise<void> {
  if (configuration['osmd'] || configuration['piano_roll']) {
    readyToPlayPromises.push(Instruments.initializeInstruments())
  }

  const app = document.getElementById('app')
  if (app != null) {
    // clean-up potentially left-over initialization,
    // which can occur e.g. in a background refresh on mobile
    app.innerHTML = ''
  }

  document.body.classList.add('running')

  if (VITE_COMPILE_ELECTRON) {
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
  }
  if (configuration['piano_roll']) {
    document.body.classList.add('pianoto')
  }
  if (configuration['osmd'] || configuration['piano_roll']) {
    // document.body.setAttribute('theme', 'millenial-pink')
    // void setBackgroundColorElectron(
    //   colors.millenial_pink_panes_background_color
    // )
    // setNexusColors('black', colors.millenial_pink_theme_pink)
    document.body.setAttribute('theme', 'black-white')
    void setBackgroundColorElectron(
      colors.millenial_pink_panes_background_color
    )
    setNexusColors('darkgray', 'black', 'lightgray')
  } else if (configuration['spectrogram']) {
    document.body.classList.add('notono')
    document.body.setAttribute('theme', 'dark')
    void setBackgroundColorElectron(
      colors.lavender_dark_mode_panes_background_color
    )
    setNexusColors(colors.arabian_sand, 'black')
  }

  // set to true to display the help tour after two minutes of inactivity on the
  // interface
  const REGISTER_IDLE_STATE_DETECTOR: boolean =
    configuration['display_help_on_idle']

  // set to true to completely hide the mouse pointer on the interface
  // for touchscreens
  const DISABLE_MOUSE: boolean = configuration['disable_mouse']
  {
    if (DISABLE_MOUSE) {
      document.body.classList.add('disable-mouse')
    }
  }

  const granularities_quarters: number[] =
    configuration['granularities_quarters'].sort()

  {
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

    // render header
    Header.render(headerGridElement, configuration)
  }

  {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    if (bottomControlsGridElement == null) {
      throw Error('Bottom controls panel not created')
    }
    const bottomControlsExpandTabContainer = document.createElement('div')
    bottomControlsExpandTabContainer.classList.add('expand-tab-container')
    const bottomControlsExpandTabDisplay = document.createElement('div')
    bottomControlsExpandTabDisplay.classList.add('expand-tab-display')
    bottomControlsExpandTabContainer.appendChild(bottomControlsExpandTabDisplay)
    const bottomControlsExpandTabLeftButton = document.createElement('div')
    bottomControlsExpandTabLeftButton.classList.add('expand-tab-left-button')
    bottomControlsExpandTabContainer.appendChild(
      bottomControlsExpandTabLeftButton
    )
    const bottomControlsExpandTabRightButton = document.createElement('div')
    bottomControlsExpandTabRightButton.classList.add('expand-tab-right-button')
    bottomControlsExpandTabContainer.appendChild(
      bottomControlsExpandTabRightButton
    )
    bottomControlsGridElement.appendChild(bottomControlsExpandTabContainer)

    const expandTabRightButton = () => {
      if (document.body.classList.contains('advanced-controls')) {
        // collapse directly to hidden controls
        document.body.classList.remove('advanced-controls')
        document.body.classList.add('controls-hidden')
      } else if (document.body.classList.contains('controls-hidden')) {
        // simple, one-level expand
        document.body.classList.remove('controls-hidden')
      } else {
        document.body.classList.add('advanced-controls')
      }
      inpainterGraphicalView.refresh()
      inpainterGraphicalView.refresh()
    }
    const expandTabLeftButton = () => {
      if (document.body.classList.contains('controls-hidden')) {
        // no controls, expand directly to advanced
        document.body.classList.remove('controls-hidden')
        document.body.classList.add('advanced-controls')
      } else if (document.body.classList.contains('advanced-controls')) {
        document.body.classList.remove('advanced-controls')
      } else {
        // collapse controls
        document.body.classList.add('controls-hidden')
      }
      inpainterGraphicalView.refresh()
      inpainterGraphicalView.refresh()
    }

    bottomControlsExpandTabLeftButton.addEventListener(
      'click',
      expandTabLeftButton
    )
    bottomControlsExpandTabRightButton.addEventListener(
      'click',
      expandTabRightButton
    )

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

    if (configuration['osmd'] || configuration['piano_roll']) {
      const useSimpleSlider = !configuration['insert_advanced_controls']
      const bpmControlGridspanElement = document.createElement('div')
      bpmControlGridspanElement.id = 'bpm-control-gridspan'
      bpmControlGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(bpmControlGridspanElement)
      if (configuration['osmd']) {
        bpmControl = new BPMControl(bpmControlGridspanElement, 'bpm-control')
        bpmControl.render(200, useSimpleSlider)
        bpmControl.value = 90
      } else if (configuration['piano_roll']) {
        bpmControl = new PlaybackRateControl(
          bpmControlGridspanElement,
          'playback-rate-control'
        )
        bpmControl.render(70, true, 25)
        bpmControl.value = 1
      }
    }
  }

  {
    const insertLFO: boolean = configuration['insert_variations_lfo']
    if (insertLFO) {
      createLFOControls()
    }
  }

  const inpaintingApiAddress: URL = new URL(
    configuration['inpainting_api_address']
  )

  if (configuration['spectrogram']) {
    {
      const constraintsContainerElement = document.getElementById(
        'constraints-container'
      )
      if (constraintsContainerElement == null) {
        throw Error('Constraint container element not created')
      }
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
      const { pitchClassSelect, octaveControl } =
        renderPitchRootAndOctaveControl(constraintsContainerElement)
      pitchClassConstraintSelect = pitchClassSelect
      octaveConstraintControl = octaveControl
    }
  }

  {
    const mainPanel = document.getElementById('main-panel')
    const bottomControlsGridElement = document.getElementById('bottom-controls')

    // create downloadCommand
    const downloadCommandsGridspan = document.createElement('div')
    downloadCommandsGridspan.id = 'download-button-gridspan'
    downloadCommandsGridspan.classList.add('gridspan')
    downloadCommandsGridspan.classList.toggle(
      'advanced',
      !configuration['piano_roll']
    )
    bottomControlsGridElement.appendChild(downloadCommandsGridspan)

    if (configuration['osmd']) {
      const granularityControlsGridspanElement = document.createElement('div')
      granularityControlsGridspanElement.id = 'granularity-controls-gridspan'
      granularityControlsGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(granularityControlsGridspanElement)

      const [granularitySelect, granularitySelectView] =
        GranularitySelect.renderGranularitySelect(
          granularityControlsGridspanElement,
          granularities_quarters
        )
      granularitySelectView.refresh()

      const allowOnlyOneFermata: boolean =
        configuration['allow_only_one_fermata']
      const sheetContainer = document.createElement('div')
      sheetContainer.id = 'sheet-container'
      mainPanel.appendChild(sheetContainer)

      const undoManager = new UndoManager()
      sheetInpainter = new SheetInpainter(
        inpaintingApiAddress,
        undoManager,
        UndoableInpainterEdit<SheetData>
      )
      inpainter = sheetInpainter

      sheetPlaybackManager = new MidiSheetPlaybackManager(
        sheetInpainter,
        bpmControl,
        false,
        '0:16:0'
      )
      playbackManager = sheetPlaybackManager

      const osmdOptions: IOSMDOptions = {
        autoResize: false,
        drawingParameters: 'compacttight',
        drawPartNames: false,
      }
      sheetInpainterGraphicalView = new SheetInpainterGraphicalView(
        sheetInpainter,
        sheetPlaybackManager,
        sheetContainer,
        granularitySelect,
        osmdOptions,
        configuration['annotation_types'],
        allowOnlyOneFermata
      )
      const inpainterGraphicalViewReady = new Promise<void>((resolve) => {
        sheetInpainterGraphicalView.once('ready', () => {
          resolve()
        })
      })
      readyToPlayPromises.push(inpainterGraphicalViewReady)

      inpainterGraphicalView = sheetInpainterGraphicalView

      if (configuration['use_chords_instrument']) {
        sheetPlaybackManager.scheduleChordsPlayer(
          configuration['chords_midi_channel'],
          sheetInpainterGraphicalView
        )
      }

      const defaultFilename: filenameType = {
        name: 'nonoto',
        extension: '.mxml',
      }
      downloadButton = new SheetDownloadButton(
        sheetInpainter,
        sheetInpainterGraphicalView,
        downloadCommandsGridspan,
        defaultFilename
      )
    } else if (configuration['piano_roll']) {
      const piaContainer = document.createElement('div')
      piaContainer.id = 'pia-container'
      mainPanel.appendChild(piaContainer)

      const piaHyperParametersControlsContainer = document.createElement('div')
      piaHyperParametersControlsContainer.classList.add('gridspan')
      piaHyperParametersControlsContainer.classList.add('advanced')
      bottomControlsGridElement?.append(piaHyperParametersControlsContainer)

      const undoManager = new PopUndoManager<PianoRollData>()
      const DURATION_SECONDS_AT_120BPM = 60
      const piaAPIManager = new PiaAPIManager()
      piaAPIManager.renderHyperparameterControls(
        piaHyperParametersControlsContainer,
        35
      )
      piaInpainter = new PiaInpainter(
        piaAPIManager,
        inpaintingApiAddress,
        undoManager,
        DURATION_SECONDS_AT_120BPM * 2 * PiaInpainter.PPQ
      )
      inpainter = piaInpainter

      piaPlaybackManager = new MidiSheetPlaybackManager(
        piaInpainter,
        bpmControl,
        false
      )
      playbackManager = piaPlaybackManager

      const granularitySelect = new VariableValue<never>()
      piaInpainterGraphicalView = new PianoRollInpainterGraphicalView(
        piaInpainter,
        piaPlaybackManager,
        piaContainer,
        granularitySelect,
        0.01
      )
      const inpainterGraphicalViewReady = new Promise<void>((resolve) => {
        piaInpainterGraphicalView.once('ready', () => {
          resolve()
        })
      })
      // readyToPlayPromises.push(inpainterGraphicalViewReady)

      inpainterGraphicalView = piaInpainterGraphicalView

      const defaultFilename: filenameType = {
        name: 'pia',
        extension: '.mid',
      }
      downloadButton = new PianotoDownloadButton(
        piaInpainter,
        piaInpainterGraphicalView,
        downloadCommandsGridspan,
        defaultFilename
      )
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
          { layer: VqvaeLayer.Top, tool: NotonoTool.Randomize },
          'paint-roller-random.svg',
        ],
        [
          { layer: VqvaeLayer.Bottom, tool: NotonoTool.Inpaint },
          'paint-brush-small-random.svg',
        ],
        [{ layer: VqvaeLayer.Top, tool: NotonoTool.Eraser }, 'edit-tools.svg'],
      ])

      const vqvaeLayerDimensions: Map<VqvaeLayer, AudioVQVAELayerDimensions> =
        new Map([
          [
            VqvaeLayer.Top,
            { frequencyRows: 32, timeColumns: 4, timeResolution: 1 },
          ],
          [
            VqvaeLayer.Bottom,
            { frequencyRows: 64, timeColumns: 8, timeResolution: 0.5 },
          ],
        ])

      const editToolSelect = new VariableValue<NotonoTool>([
        NotonoTool.Inpaint,
        NotonoTool.Randomize,
        NotonoTool.Eraser,
      ])
      const editToolsGridspanElement = document.getElementById(
        'edit-tools-gridspan'
      )
      const editToolsContainerElement = document.createElement('div')
      editToolsContainerElement.id = 'edit-tool-setup-container'
      editToolsContainerElement.classList.add('gridspan')
      editToolsGridspanElement.appendChild(editToolsContainerElement)
      ControlLabels.createLabel(
        editToolsContainerElement,
        'edit-tools-gridspan-label',
        false,
        undefined,
        editToolsGridspanElement
      )
      const editToolSelectContainerElement = document.createElement('div')
      editToolSelectContainerElement.id = 'edit-tool-select-container'
      editToolSelectContainerElement.classList.add('control-item')
      editToolsContainerElement.appendChild(editToolSelectContainerElement)
      const editToolSelectInterface = new Nexus.Select(
        editToolSelectContainerElement,
        {
          options: [
            NotonoTool.Inpaint,
            NotonoTool.Randomize,
            NotonoTool.Eraser,
          ],
        }
      )
      bindSelectModel(editToolSelectInterface, editToolSelect)
      editToolSelect.value = NotonoTool.Inpaint
      ControlLabels.createLabel(
        editToolSelectContainerElement,
        'edit-tool-select-label',
        false,
        undefined,
        editToolsContainerElement
      )

      const layerToggle = new NullableVariableValue<VqvaeLayer>(
        [VqvaeLayer.Top, VqvaeLayer.Bottom],
        null,
        null,
        VqvaeLayer.Top
      )

      editToolSelect.on('change', (value) => {
        if (value == NotonoTool.Eraser) {
          layerToggle.value = null
        } else {
          layerToggle.restorePreviousValue()
        }
      })

      const layerToggleContainerElement = document.createElement('div')
      layerToggleContainerElement.classList.add('control-item')
      editToolsContainerElement.appendChild(layerToggleContainerElement)

      const layerToggleFontAwesomeIcons = new Map([
        [VqvaeLayer.Top, null],
        [VqvaeLayer.Bottom, 'fa-check'],
      ])
      const layerToggleIconElements = createFontAwesomeElements<VqvaeLayer>(
        layerToggleFontAwesomeIcons,
        ['fa-solid', 'fa-xl']
      )
      const layerToggleInterface = new CycleSelectViewWithDisable(
        layerToggle,
        layerToggleIconElements
      )
      layerToggleContainerElement.appendChild(layerToggleInterface)

      layerToggle.value = VqvaeLayer.Top

      ControlLabels.createLabel(
        layerToggleContainerElement,
        'layer-select-label',
        false,
        undefined,
        editToolsContainerElement
      )

      const spectrogramContainerElement = document.createElement('div')
      spectrogramContainerElement.id = 'spectrogram-container'
      mainPanel.appendChild(spectrogramContainerElement)

      const undoManager = new UndoManager()
      spectrogramInpainter = new SpectrogramInpainter(
        inpaintingApiAddress,
        undoManager,
        vqvaeLayerDimensions
      )
      inpainter = spectrogramInpainter
      spectrogramPlaybackManager = new SpectrogramPlaybackManager(
        spectrogramInpainter
      )
      spectrogramInpainterGraphicalView = new SpectrogramInpainterGraphicalView(
        spectrogramInpainter,
        spectrogramPlaybackManager,
        spectrogramContainerElement,
        layerToggle,
        editToolSelect,
        instrumentConstraintSelect,
        octaveConstraintControl,
        pitchClassConstraintSelect
      )
      const onshiftKey = (e: KeyboardEvent) => {
        if (
          e.repeat ||
          spectrogramInpainterGraphicalView == undefined ||
          spectrogramInpainterGraphicalView.interacting
        ) {
          return
        }
        if (e.key == 'Shift') {
          layerToggle.next(true)

          // force repaint to display proper pointer `hover` position
          spectrogramInpainterGraphicalView.interfaceContainer.style.visibility =
            'hidden'
          setTimeout(() => {
            if (spectrogramInpainterGraphicalView != undefined) {
              spectrogramInpainterGraphicalView.interfaceContainer.style.visibility =
                'visible'
            }
          }, 1)
        }
      }
      document.body.addEventListener('keydown', onshiftKey)
      document.body.addEventListener('keyup', onshiftKey)

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

      spectrogramInpainterGraphicalView.playbackManager.renderFadeInControl(
        volumeControlsContainerElement
      )
      spectrogramInpainterGraphicalView.playbackManager.renderGainControl(
        volumeControlsContainerElement
      )

      playbackManager = spectrogramPlaybackManager
      inpainterGraphicalView = spectrogramInpainterGraphicalView

      const defaultFilename: filenameType = {
        name: 'notono',
        extension: '.wav',
      }
      downloadButton = new NotonoDownloadButton(
        spectrogramInpainter,
        spectrogramInpainterGraphicalView,
        downloadCommandsGridspan,
        defaultFilename
      )
    }

    if (VITE_COMPILE_ELECTRON) {
      ControlLabels.createLabel(
        bottomControlsGridElement,
        'download-button-label',
        false,
        'download-button-label-with-native-drag',
        downloadButton.container
      )
    } else {
      ControlLabels.createLabel(
        bottomControlsGridElement,
        'download-button-label',
        false,
        undefined,
        downloadButton.container
      )
    }

    // bind interactive event listeners to header elements
    const appTitleElement = document.getElementById('app-title')
    appTitleElement.addEventListener('click', () => {
      // if (!inpainterGraphicalView.disabled) {
      void sampleNewData()
      // }
    })
    const safeUndoCallback = () => {
      if (inpainter.undoManager.canUndo()) {
        inpainter.undoManager.undo()
      }
    }
    const safeRedoCallback = () => {
      if (inpainter.undoManager.canRedo()) {
        inpainter.undoManager.redo()
      }
    }
    const undoButtonInterface = document.getElementById('undo-button-container')
    undoButtonInterface.addEventListener('click', (event) => {
      event.stopPropagation()
      safeUndoCallback()
    })
    const redoButtonInterface = document.getElementById('redo-button-container')
    redoButtonInterface.addEventListener('click', (event) => {
      event.stopPropagation()
      safeRedoCallback()
    })
    const refreshUndoRedoEnabledInterfaceViews = () => {
      undoButtonInterface.classList.toggle(
        'disabled',
        !inpainter.undoManager.canUndo()
      )
      redoButtonInterface.classList.toggle(
        'disabled',
        !inpainter.undoManager.canRedo()
      )
    }
    inpainter.undoManager.setListener(refreshUndoRedoEnabledInterfaceViews)
    refreshUndoRedoEnabledInterfaceViews()
    document.body.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return
      }
      if (!event.ctrlKey && !event.shiftKey) {
        if (event.metaKey && event.code == 'KeyZ') {
          event.preventDefault()
          safeUndoCallback()
        }
        if (event.metaKey && event.code == 'KeyY') {
          event.preventDefault()
          safeRedoCallback()
        }
      }
    })
  }

  {
    const playbackCommandsGridspan = document.getElementById(
      'playback-commands-gridspan'
    )
    if (playbackCommandsGridspan == null) {
      throw Error('Playback commands container not initialized')
    }
    const playbackComands = new PlaybackCommands(
      playbackCommandsGridspan,
      playbackManager
    ).render()
    // TODO(@tbazin, 2022/08/10): readyToPlay not detected properly on Firefox Mobile,
    //disabling this for now
    if (readyToPlayPromises.length > 0) {
      // disabling play/pause interface until there is some data to be played
      playbackComands.setWaitingClass()
      Promise.all(readyToPlayPromises)
        .then(() => {
          log.info('Ready to play!')
          // enable play/pause interface
          playbackComands.unsetWaitingClass()
          playbackComands.refreshInterface()
        })
        .catch((reason) => {
          playbackComands.setBrokenIcon()
          log.error('Could not initialize playback due to: ', reason)
          alert('Error: Could not initialize playback due to: ' + reason)
          new Notification(
            'Error: Could not initialize playback due to: ',
            reason
          )
        })
    }
  }

  if (
    configuration['piano_roll'] &&
    piaInpainter != null &&
    piaInpainterGraphicalView != null
  ) {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    if (bottomControlsGridElement == null) {
      throw Error()
    }
    const midiFileSelectGridspanElement = document.createElement('div')
    midiFileSelectGridspanElement.id = 'midi-file-select-gridspan'
    midiFileSelectGridspanElement.classList.add('gridspan')
    bottomControlsGridElement.appendChild(midiFileSelectGridspanElement)

    const midiFileSelectContainerElement = document.createElement('div')
    midiFileSelectContainerElement.classList.add('control-item')
    midiFileSelectGridspanElement.appendChild(midiFileSelectContainerElement)
    midiFileSelect = new MidiFileSelector(midiFileSelectContainerElement)
    midiFileSelect.render()
    midiFileSelect.on('change', async (state: { value: string }) => {
      const newURL = MidiFileSelector.midiFiles.get(state.value)
      if (newURL == null) {
        piaInpainter?.clear()
      } else if (newURL == TemplateCommands.BlankTemplate) {
        piaInpainter?.clear()
      } else if (newURL == TemplateCommands.OpenFile) {
        const file = await midiFileSelect?.triggerOpenFile()
        if (file != undefined) {
          piaInpainter?.loadFile(file, [], false)
        }
      } else {
        piaInpainter?.loadFromUrl(newURL)
      }
    })
    ControlLabels.createLabel(
      midiFileSelectContainerElement,
      'midi-file-select-label',
      false,
      undefined,
      midiFileSelectGridspanElement
    )

    piaInpainter.on('clear', () => {
      if (midiFileSelect != null && midiFileSelect.element != null) {
        midiFileSelect.resetOptions()
        midiFileSelect.element.selectedIndex = 0
      }
    })
    piaInpainter.on('load-file-programmatic', () => {
      if (midiFileSelect != null && midiFileSelect.element != null) {
        midiFileSelect.setCustomOptionDisplay()
      }
    })

    const recordCommandsGridspanElement = document.createElement('div')
    recordCommandsGridspanElement.id = 'record-commands-gridspan'
    recordCommandsGridspanElement.classList.add('gridspan')
    bottomControlsGridElement.appendChild(recordCommandsGridspanElement)

    const recorderCallback = new MyCallback(piaInpainter)
    const recorder = new FixedRecorder(
      { startRecordingAtFirstNote: true },
      recorderCallback
    )
    recorder.inpainter = piaInpainter
    console.log(recorder.startRecordingAtFirstNote)
    const midiRecorder = new MidiRecorder(
      recorder,
      piaInpainter,
      piaInpainterGraphicalView,
      playbackManager
    )
    midiRecorder.render(recordCommandsGridspanElement)
  }

  function registerDisableInstrumentsOnMidiEnabled<
    T extends Instruments.leadInstrument
  >(instrumentSelect: Instruments.InstrumentSelect<T>) {
    void import('./midiOut').then((midiOutModule) => {
      const instrumentsControlGridspanElement = document.getElementById(
        'instruments-control-gridspan'
      )
      void midiOutModule.getMidiOutputListener().then((midiOutputListener) => {
        midiOutputListener.on('device-changed', () => {
          const isUsingMIDIOutput = midiOutputListener.isActive
          instrumentsControlGridspanElement?.classList.toggle(
            'disabled-gridspan',
            isUsingMIDIOutput
          )
          if (isUsingMIDIOutput) {
            // disable in-app rendering when MIDI output is enabled
            instrumentSelect.value = null
          } else if (!isUsingMIDIOutput) {
            // re-enable in-app rendering when MIDI output is disabled
            instrumentSelect.restorePreviousValue()
          }
        })
      })
    })
  }

  let instrumentSelect: Instruments.InstrumentSelect<never> | null = null
  if (false && (configuration['osmd'] || configuration['piano_roll'])) {
    const bottomControlsGridElement = document.getElementById('bottom-controls')
    const instrumentsControlGridspanElement = document.createElement('div')
    instrumentsControlGridspanElement.id = 'instruments-control-gridspan'
    instrumentsControlGridspanElement.classList.add('gridspan')
    bottomControlsGridElement.appendChild(instrumentsControlGridspanElement)

    const instrumentsGridElement = document.createElement('div')
    instrumentsGridElement.id = 'instruments-grid'
    instrumentsGridElement.classList.add('gridspan')
    instrumentsControlGridspanElement.appendChild(instrumentsGridElement)

    ControlLabels.createLabel(
      instrumentsGridElement,
      'instruments-grid-label',
      false,
      undefined,
      instrumentsControlGridspanElement
    )

    Instruments.initializeInstruments().then(() => {
      return

      let initialInstrumentOptions: Instruments.leadInstrument[] = [
        'PolySynth',
        'SteelPan',
      ]
      if (!VITE_NO_AUTOLOAD_SAMPLES) {
        initialInstrumentOptions = ['Piano', ...initialInstrumentOptions]
      }
      instrumentSelect = new Instruments.InstrumentSelect(
        initialInstrumentOptions,
        initialInstrumentOptions[0]
      )
      const instrumentSelectView = new Instruments.InstrumentSelectView(
        instrumentSelect
      )
      instrumentSelectView.refresh()
      instrumentSelectView.id = 'lead-instrument-select-container'
      instrumentSelectView.classList.add(
        'control-item',
        'main-instrument-select'
      )
      instrumentsGridElement.appendChild(instrumentSelectView)
      ControlLabels.createLabel(
        instrumentsGridElement,
        'lead-instrument-select-label',
        false,
        undefined,
        instrumentsGridElement
      )

      let chordsInstrumentSelect: Instruments.ChordsInstrumentSelect<Instruments.chordsInstrument> | null =
        null
      if (configuration['use_chords_instrument']) {
        chordsInstrumentSelect = new Instruments.ChordsInstrumentSelect(
          ['PolySynth'],
          'PolySynth'
        )
        const chordsInstrumentSelectView = new Instruments.InstrumentSelectView(
          chordsInstrumentSelect
        )
        chordsInstrumentSelectView.id = 'chords-instrument-select-container'
        chordsInstrumentSelectView.classList.add(
          'control-item',
          'chords-instrument-select'
        )
        instrumentsGridElement.appendChild(chordsInstrumentSelectView)
        instrumentsGridElement.appendChild(instrumentSelectView)
        ControlLabels.createLabel(
          instrumentsGridElement,
          'chords-instrument-select-label',
          false,
          undefined,
          instrumentsGridElement
        )
        registerDisableInstrumentsOnMidiEnabled(chordsInstrumentSelect)
      }

      if (VITE_NO_AUTOLOAD_SAMPLES) {
        Instruments.renderDownloadButton(
          instrumentsGridElement,
          instrumentSelect,
          chordsInstrumentSelect
        )
      }
    })
  }
  if (configuration['osmd'] || configuration['piano_roll']) {
    import('./midiOut')
      .then((midiOutModule) => {
        midiOutModule
          .render(sheetPlaybackManager ?? piaPlaybackManager, false)
          .then(() => {
            if (instrumentSelect != null) {
              registerDisableInstrumentsOnMidiEnabled(instrumentSelect)
            }
          })
          .catch((e) => {
            throw e
          })
      })
      .catch((e) => {
        throw e
      })
  }
  {
    // Insert LINK client controls
    const useAdvancedControls = true

    if (VITE_COMPILE_ELECTRON && configuration['osmd'] && useAdvancedControls) {
      getAbletonLinkClientClass().then(
        (LinkClient) => {
          linkClient = new LinkClient(bpmControl)
          playbackManager.registerLinkClient(linkClient)

          // render AbletonLink control interface
          const bottomControlsGridElement =
            document.getElementById('bottom-controls')
          const abletonLinkSettingsGridspan = document.createElement('div')
          abletonLinkSettingsGridspan.id = 'ableton-link-settings-gridspan'
          abletonLinkSettingsGridspan.classList.add('gridspan')
          abletonLinkSettingsGridspan.classList.add('advanced')
          bottomControlsGridElement.appendChild(abletonLinkSettingsGridspan)

          LinkClientCommands.render(
            abletonLinkSettingsGridspan,
            linkClient,
            sheetPlaybackManager ?? piaPlaybackManager
          )
        },
        (err) => log.error(err)
      )
    }
  }

  {
    if (
      configuration['insert_advanced_controls'] &&
      (configuration['spectrogram'] || configuration['piano_roll'])
    ) {
      import('./midiIn').then(async (midiInModule) => {
        log.debug('Rendering Midi Input controls')
        await midiInModule.render()
        const inputListener = await midiInModule.getMidiInputListener()
        console.log(inputListener?.deviceId)
      })
    }
  }

  if (
    (configuration['osmd'] && sheetInpainterGraphicalView != undefined) ||
    (configuration['piano_roll'] && piaInpainterGraphicalView != undefined)
  ) {
    {
      // Insert zoom controls
      const zoomControlsGridElement = document.createElement('div')
      zoomControlsGridElement.classList.add('zoom-control', 'control-item')
      // zoomControlsGridElement.classList.add('two-columns');
      // const mainPanel = document.getElementById('main-panel')
      inpainterGraphicalView.container.appendChild(zoomControlsGridElement)
      inpainterGraphicalView.renderZoomControls(zoomControlsGridElement)
    }
  }
  // Insert fullscreen control
  const fullscreenControlContainerElement = document.createElement('div')
  fullscreenControlContainerElement.classList.add(
    'fullscreen-control',
    'control-item'
  )
  // zoomControlsGridElement.classList.add('two-columns');
  const mainPanel = document.getElementById('main-panel')
  mainPanel.appendChild(fullscreenControlContainerElement)
  inpainterGraphicalView.renderFullscreenControl(
    fullscreenControlContainerElement
  )

    if (configuration['insert_help']) {
      // initialize help menu
      if (
        configuration['spectrogram'] &&
        spectrogramInpainterGraphicalView != null
      ) {
        helpTour = new NotonoTour(
          [configuration['main_language']],
          spectrogramInpainterGraphicalView,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        )
      } else if (configuration['osmd'] && sheetInpainterGraphicalView != null) {
        helpTour = new NonotoTour(
          [configuration['main_language']],
          sheetInpainterGraphicalView,
          REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        )
      } else if (
        configuration['piano_roll'] &&
        piaInpainterGraphicalView != null
      ) {
        // TODO
        // helpTour = new NonotoTour(
        //   [configuration['main_language']],
        //   piaInpainterGraphicalView,
        //   REGISTER_IDLE_STATE_DETECTOR ? 2 * 1000 * 60 : undefined
        // )
      } else {
        // FIXME(@tbazin, 2021/10/14): else branch should not be required,
        // alternatives should be detected automatically
        throw new Error('Unsupported configuration')
      }
      if (helpTour != null) {
        const mainPanel = document.getElementById('main-panel')
        const helpIcon = helpTour.renderIcon(mainPanel)
        helpIcon.classList.add('disabled')
        inpainterGraphicalView.once('ready', () => {
          helpIcon.classList.remove('disabled')
        })
      }
    }
  }

  async function sampleNewData(silent = false): Promise<void> {
    const DUMMY_GENERATE = VITE_DUMMY_GENERATE
    try {
      if (!DUMMY_GENERATE) {
        if (midiFileSelect != null) {
          midiFileSelect.element.selectedIndex =
            midiFileSelect._options.findIndex(
              (v) => v == MidiFileSelector.blankTemplate
            )
          piaInpainter?.clear(silent)
        } else {
          await inpainter.generate(inpainterGraphicalView.queryParameters)
        }
      } else {
        if (midiFileSelect != null) {
          midiFileSelect.selectedIndex = 1
        }
        const silentInpainterUpdate = false
        await inpainter.dummyGenerate(
          inpainterGraphicalView.queryParameters,
          silentInpainterUpdate
        )
      }
    } catch (e) {
      log.error('Could not retrieve initial media due to: ', e)
    }
    log.info('Retrieved new media from server')
  }

  $(async () => {
    inpainterGraphicalView.once('ready', () => {
      inpainterGraphicalView.callToAction()
    })
    await sampleNewData(true)
  })
}

{
  const splashScreen = new SplashScreen(render, VITE_AUTOSTART)
}

{
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
}

//HACK(@tbazin, 2022/10/20): NO-OP, just using this to introduce an HMR dependency link from
// this file to the help.json file.
// This is because, as of 2022/10/20, vite.js does not support performing
// manual calls to hot.invalidate(),
// which would be required here to rebuild the app's helpTour on help.json content update
import helpContentsJSON from '../static/localizations/help.json'
import {
  MidiFileSelector,
  TemplateCommands,
} from './piano_roll/midiFilesSelector'
import { Recorder } from '@magenta/music/esm/core/recorder'
import { PiaAPIManager } from './piano_roll/piaAPI'
import { stringify } from 'querystring'
if (import.meta.hot) {
  let helpContents = helpContentsJSON
}

if (import.meta.hot) {
  import.meta.hot.accept('../static/localizations/help.json', () => {
    if (helpTour != undefined) {
      const currentStepId = helpTour.getCurrentStep()?.id
      let currentStepIndex: number | null = null
      if (currentStepId != null) {
        currentStepIndex = helpTour.steps.findIndex(
          (step) => step.id == currentStepId
        )
      }
      helpTour.cancel()
      helpTour?.rebuild?.()
      if (currentStepIndex != null) {
        helpTour.start()
        helpTour.show(helpTour.steps[currentStepIndex].id)
      }
    }
  })
  import.meta.hot.accept(
    './downloadCommand',
    (downloadCommand: typeof import('./downloadCommand')) => {
      if (
        spectrogramInpainter != undefined &&
        spectrogramInpainterGraphicalView != undefined
      ) {
        downloadButton.dispose()
        downloadButton = new downloadCommand.NotonoDownloadButton(
          spectrogramInpainter,
          spectrogramInpainterGraphicalView,
          downloadButton.container,
          downloadButton.defaultFilename
        )
        spectrogramInpainter.emit('change', spectrogramInpainter.value)
      }
    }
  )
}
