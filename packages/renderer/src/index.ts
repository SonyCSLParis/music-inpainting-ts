import $ from 'jquery'
import log from 'loglevel'

import { UndoableInpainter } from './inpainter/inpainter'
import { InpainterGraphicalView } from './inpainter/inpainterGraphicalView'
import { SheetInpainter } from './sheet/sheetInpainter'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import {
  SpectrogramInpainter,
  VqvaeLayer,
  NotonoTool,
  LayerAndTool,
  AudioVQVAELayerDimensions,
} from './spectrogram/spectrogramInpainter'
import { SpectrogramInpainterGraphicalView } from './spectrogram/spectrogramInpainterGraphicalView'
import { NexusSelect } from 'nexusui'
import Nexus, {
  NexusSelectWithShuffle,
  setColors as setNexusColors,
} from './nexusColored'

import * as Header from './header'

import * as PlaybackCommands from './playbackCommands'
import { PlaybackManager } from './playback'
import MidiSheetPlaybackManager from './sheetPlayback'
import { MultiChannelSpectrogramPlaybackManager as SpectrogramPlaybackManager } from './spectrogramPlayback'

import * as Instruments from './instruments'
import { BPMControl, renderPitchRootAndOctaveControl } from './numberControl'
import { AbletonLinkClient } from './ableton_link/linkClient.abstract'
import { getAbletonLinkClientClass } from './ableton_link/linkClient'
import * as LinkClientCommands from './ableton_link/linkClientCommands'
import {
  DownloadButton,
  filename as filenameType,
  NotonoDownloadButton,
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
import '../styles/disableMouse.scss'

const VITE_AUTOLOAD_SAMPLES = import.meta.env.VITE_AUTOLOAD_SAMPLES != undefined
const VITE_COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

if (VITE_COMPILE_ELECTRON) {
  window.ipcRendererInterface
    .getWindowId()
    .then((windowId) => (window.electronWindowId = windowId))
  setBackgroundColorElectron(colors.darkgray)
}

import defaultConfiguration from '../../common/default_config.json'
import { setBackgroundColorElectron, getTitleBarDisplay } from './utils/display'
import { UndoManager } from 'typed-undo'
import { IOSMDOptions } from 'opensheetmusicdisplay'

let inpainter: UndoableInpainter
let sheetInpainter: SheetInpainter
let spectrogramInpainter: SpectrogramInpainter
let inpainterGraphicalView: InpainterGraphicalView
let spectrogramInpainterGraphicalView:
  | SpectrogramInpainterGraphicalView
  | undefined = undefined
let sheetInpainterGraphicalView: SheetInpainterGraphicalView | undefined =
  undefined
let playbackManager: PlaybackManager
let sheetPlaybackManager: MidiSheetPlaybackManager
let spectrogramPlaybackManager: SpectrogramPlaybackManager
let bpmControl: BPMControl
let instrumentConstraintSelect: NexusSelectWithShuffle
let pitchClassConstraintSelect: NexusSelect
let octaveConstraintControl: NexusSelect
let downloadButton: DownloadButton
let linkClient: AbletonLinkClient
let helpTour: MyShepherdTour

function render(
  configuration: applicationConfiguration = defaultConfiguration
): void {
  if (document.getElementById('header')) {
    // do nothing if the app has already been rendered
    return
  }

  document.body.classList.add('running', 'advanced-controls-disabled')

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
    const bottomControlsExpandTabElement = document.createElement('div')
    bottomControlsExpandTabElement.id = 'bottom-controls-expand'
    bottomControlsExpandTabElement.classList.add('expand-tab')
    bottomControlsGridElement.appendChild(bottomControlsExpandTabElement)
    bottomControlsExpandTabElement.addEventListener('click', function () {
      document.body.classList.toggle('advanced-controls-disabled')
      inpainterGraphicalView.refresh()
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

    if (configuration['osmd']) {
      const useSimpleSlider = !configuration['insert_advanced_controls']
      const bpmControlGridspanElement = document.createElement('div')
      bpmControlGridspanElement.id = 'bpm-control-gridspan'
      bpmControlGridspanElement.classList.add('gridspan')
      bottomControlsGridElement.appendChild(bpmControlGridspanElement)

      bpmControl = new BPMControl(bpmControlGridspanElement, 'bpm-control')
      bpmControl.render(useSimpleSlider, 200)
      bpmControl.value = 80
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
    downloadCommandsGridspan.classList.toggle('advanced', true)
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
      sheetInpainter = new SheetInpainter(inpaintingApiAddress, undoManager)
      inpainter = sheetInpainter

      sheetPlaybackManager = new MidiSheetPlaybackManager(
        sheetInpainter,
        bpmControl
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
        true,
        'download-button-label-with-native-drag',
        downloadButton.container
      )
    } else {
      ControlLabels.createLabel(
        bottomControlsGridElement,
        'download-button-label',
        true,
        undefined,
        downloadButton.container
      )
    }

    // bind interactive event listeners to header elements
    const appTitleElement = document.getElementById('app-title')
    appTitleElement.addEventListener('click', () => {
      if (!inpainterGraphicalView.disabled) {
        void sampleNewData()
      }
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
    PlaybackCommands.render(playbackCommandsGridspan, playbackManager)

    // disabling play/pause interface until there is some data to be played
    playbackCommandsGridspan.classList.add('disabled-gridspan')
    inpainterGraphicalView.once('ready', () => {
      // enable play/pause interface
      playbackCommandsGridspan.classList.remove('disabled-gridspan')
    })
  }

  if (configuration['osmd']) {
    {
      const bottomControlsGridElement =
        document.getElementById('bottom-controls')
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
        let initialInstrumentOptions: Instruments.leadInstrument[] = [
          'PolySynth',
          'SteelPan',
        ]
        if (VITE_AUTOLOAD_SAMPLES) {
          initialInstrumentOptions = ['Piano', ...initialInstrumentOptions]
        }
        const instrumentSelect = new Instruments.InstrumentSelect(
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

        function registerDisableInstrumentsOnMidiEnabled<
          T extends Instruments.leadInstrument
        >(instrumentSelect: Instruments.InstrumentSelect<T>) {
          void import('./midiOut').then((midiOutModule) => {
            void midiOutModule
              .getMidiOutputListener()
              .then((midiOutputListener) => {
                midiOutputListener.on('device-changed', () => {
                  const isUsingMIDIOutput = midiOutputListener.isActive
                  instrumentsControlGridspanElement.classList.toggle(
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

        import('./midiOut')
          .then((midiOutModule) => {
            midiOutModule
              .render(sheetInpainterGraphicalView.playbackManager)
              .then(() =>
                registerDisableInstrumentsOnMidiEnabled(instrumentSelect)
              )
              .catch((e) => {
                throw e
              })
          })
          .catch((e) => {
            throw e
          })

        let chordsInstrumentSelect: Instruments.ChordsInstrumentSelect<Instruments.chordsInstrument> | null =
          null
        if (configuration['use_chords_instrument']) {
          chordsInstrumentSelect = new Instruments.ChordsInstrumentSelect(
            ['PolySynth'],
            'PolySynth'
          )
          const chordsInstrumentSelectView =
            new Instruments.InstrumentSelectView(chordsInstrumentSelect)
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

        if (!VITE_AUTOLOAD_SAMPLES) {
          Instruments.renderDownloadButton(
            instrumentsGridElement,
            instrumentSelect,
            chordsInstrumentSelect
          )
        }
      })
    }
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
            sheetInpainterGraphicalView.playbackManager
          )
        },
        (err) => log.error(err)
      )
    }
  }

  {
    if (
      configuration['insert_advanced_controls'] &&
      configuration['spectrogram']
    ) {
      void import('./midiIn').then((midiInModule) => {
        log.debug('Rendering Midi Input controls')
        void midiInModule.render()
      })
    }
  }

  if (configuration['osmd'] && sheetInpainterGraphicalView != undefined) {
    {
      // Insert zoom controls
      const zoomControlsGridElement = document.createElement('div')
      zoomControlsGridElement.classList.add('zoom-control', 'control-item')
      // zoomControlsGridElement.classList.add('two-columns');
      const mainPanel = document.getElementById('main-panel')
      mainPanel.appendChild(zoomControlsGridElement)
      sheetInpainterGraphicalView.renderZoomControls(zoomControlsGridElement)
    }
  }

  {
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
      } else {
        // FIXME(@tbazin, 2021/10/14): else branch should not be required,
        // alternatives should be detected automatically
        throw new Error('Unsupported configuration')
      }
      const mainPanel = document.getElementById('main-panel')
      const helpIcon = helpTour.renderIcon(mainPanel)
      helpIcon.classList.add('disabled')
      inpainterGraphicalView.once('ready', () => {
        helpIcon.classList.remove('disabled')
      })
    }
  }

  async function sampleNewData(): Promise<void> {
    const DUMMY_GENERATE = false
    try {
      if (!DUMMY_GENERATE) {
        await inpainter.generate(inpainterGraphicalView.queryParameters)
      } else {
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

  $(() => {
    inpainterGraphicalView.once('ready', () => {
      inpainterGraphicalView.callToAction()
    })
    void sampleNewData()
  })
}

{
  new SplashScreen(render)
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
import { ipcRendererInterface } from '../../preload/src/ipcRendererInterface'
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
