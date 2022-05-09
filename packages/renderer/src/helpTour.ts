import $ from 'jquery'
import IdleTracker from 'idle-tracker'
import { InpainterGraphicalView } from './inpainter/inpainterGraphicalView'
import { SheetInpainterGraphicalView } from './sheet/sheetInpainterGraphicalView'
import { SpectrogramInpainterGraphicalView } from './spectrogram/spectrogramInpainterGraphicalView'

import 'shepherd.js/dist/css/shepherd.css'
import '../styles/helpTour.scss'

import Shepherd from 'shepherd.js'

import localizations from '../static/localization.json'
const helpContents = localizations['help']

export abstract class MyShepherdTour<
  InpainterGraphicalViewT extends InpainterGraphicalView = InpainterGraphicalView
> extends Shepherd.Tour {
  protected languages: string[]
  readonly inpainter: InpainterGraphicalViewT
  protected tripDelay_ms = 10000
  readonly inactivityDetectorDelay?: number
  readonly idleStateDetector?: IdleTracker | null = null

  static readonly defaultTourOptions: Shepherd.Tour.TourOptions = {
    useModalOverlay: true,
  }
  static readonly defaultStepOptions: Shepherd.Step.StepOptions = {
    popperOptions: {
      modifiers: [{ name: 'offset', options: { offset: [0, 12] } }],
    },
    modalOverlayOpeningRadius: 15,
    cancelIcon: {
      enabled: true,
    },
    buttons: [
      {
        action: function (): void {
          return this.back()
        },
        secondary: true,
        text: 'Back',
      },
      {
        action: function (): void {
          return this.next()
        },
        text: 'Next',
      },
    ],
  }

  constructor(
    languages: string[],
    inpainterGraphicalView: InpainterGraphicalViewT,
    inactivityDetectorDelay?: number,
    options?: Shepherd.Tour.TourOptions
  ) {
    super({
      defaultStepOptions: MyShepherdTour.defaultStepOptions,
      ...MyShepherdTour.defaultTourOptions,
      ...options,
    })

    this.languages = languages
    this.inpainter = inpainterGraphicalView
    if (inactivityDetectorDelay != undefined) {
      this.inactivityDetectorDelay = inactivityDetectorDelay
    }

    if (
      this.inactivityDetectorDelay != null &&
      this.inactivityDetectorDelay > 0
    ) {
      // TODO(@tbazin, 2022/04/29): should extract this initialization
      //   from the HelpTour class for inversion of control
      this.idleStateDetector = this.createIdleStateDetector()
      this.idleStateDetector.start()
    }

    this.on('start', () => this.onStart())
    this.on('cancel', () => this.cleanup())
    this.on('complete', () => this.cleanup())

    this.inpainter.once('ready', () =>
      this.addSteps(
        this.makeStepsOptions().map(
          (stepOptions) => new Shepherd.Step(this, stepOptions)
        )
      )
    )
  }

  abstract makeStepsOptions(): Shepherd.Step.StepOptions[]

  protected onStart(): void {
    document.body.classList.add('help-tour-on')
    document.body.classList.remove('advanced-controls-disabled')
    this.inpainter.refresh()
    this.initHideOnClickOutside()
  }

  // clean-up modifications made to the DOM if the trip is exited mid-run
  protected cleanup(): void {
    this.removeClickListener()
    document.body.classList.remove('help-tour-on')
    document.body.classList.toggle('advanced-controls-disabled')
    document.body.classList.toggle('advanced-controls-disabled')
    // this is needed in conjunction with position: sticky for the .trip-block
    // in order to restore the inpainter's full size if the viewport was resized during the trip
    this.inpainter.refresh()
  }

  protected makeHTMLContent(contents: Record<string, string>): string | never {
    switch (this.languages.length) {
      case 2:
        return `${contents[this.languages[0]]}<br><br><i>${
          contents[this.languages[1]]
        }</i><br><br>`
      case 1:
        return `${contents[this.languages[0]]}<br><br>`
      default:
        throw new Error(
          'Unexpected number of languages to use, either 1 or 2 simultaneous languages are supported.'
        )
    }
  }

  get totalTripDuration_ms(): number {
    return this.tripDelay_ms * this.steps.length
  }

  private loopInterval?: NodeJS.Timeout
  public startLoop(): void {
    // starts the help tour in a looping fa-solidhion
    const intervalTripLoop = () => {
      this.loopInterval = setInterval(() => {
        // if (looping) {
        this.start()
        // }
      }, this.totalTripDuration_ms + 500)
    }
    this.start()
    intervalTripLoop()
  }

  protected stopLoop(): void {
    // stops the help tour from looping
    if (this.loopInterval != null) {
      clearInterval(this.loopInterval)
    }
  }

  public renderIcon(containerElement: HTMLElement): void {
    const helpElement: HTMLAnchorElement = document.createElement('a')
    containerElement.appendChild(helpElement)

    helpElement.id = 'help-icon'
    helpElement.classList.add('fa-solid', 'fa-circle-question')
    helpElement.title = 'Help'

    // const self = this;
    helpElement.addEventListener(
      'click',
      (event) => {
        // stops event from trigerring outsideClickListener registered onTripStart
        event.stopPropagation()
        this.cancel()
        this.start()
      },
      true
    )
  }

  protected outsideClickListener: (event: PointerEvent) => void = (
    event: PointerEvent
  ) => {
    const target = event.target
    if (!$(target).closest($('div.shepherd-enabled')).length) {
      this.stopLoop()
      this.cancel()
    }
  }

  // Attach an event listener to the whole document that detects clicks
  // out of the containing div and closes the selector in that case
  // Bind this callback when the selector is activated and unbind it when
  // it is closed
  protected initHideOnClickOutside(): void {
    document.addEventListener('pointerdown', this.outsideClickListener)
  }

  protected removeClickListener(): void {
    document.removeEventListener('pointerdown', this.outsideClickListener)
  }

  public createIdleStateDetector(): IdleTracker {
    return new IdleTracker({
      timeout: this.inactivityDetectorDelay,
      onIdleCallback: (payload) => {
        if (payload.idle) {
          console.log('The user is not interacting with the page')
          this.startLoop()
        } else {
          console.log('The user is interacting with the page')
          this.stopLoop()
        }
      },
    })
  }
}

export class NonotoTour extends MyShepherdTour<SheetInpainterGraphicalView> {
  makeStepsOptions(): Shepherd.Step.StepOptions[] {
    return [
      {
        title: 'Playback',
        attachTo: {
          element: '#playback-commands-gridspan',
          on: 'right',
        },
        text: this.makeHTMLContent(helpContents['general']['play_button']),
      },
      {
        title: 'Regeneration box',
        attachTo: {
          element: document.getElementById('4-0-0-timeContainer'),
          on: 'bottom',
        },
        text: this.makeHTMLContent(helpContents['nonoto']['note_box']),
        modalOverlayOpeningPadding: 10,
        scrollTo: true,
        when: {
          show: () => {
            this.inpainter.toggleScrollLock('x', true)
          },
        },
      },
      {
        title: 'Fermatas',
        attachTo: {
          element: document.getElementById(
            '1-0-3-timeContainer-common-Fermata'
          ),
          // element: '#header',
          on: 'bottom',
        },
        text: this.makeHTMLContent(helpContents['nonoto']['fermata_box']),
        modalOverlayOpeningPadding: 10,
        scrollTo: true,
        when: {
          show: () => {
            this.inpainter.toggleScrollLock('x', true)
          },
        },
      },
    ]
  }
}

export class NotonoTour extends MyShepherdTour<SpectrogramInpainterGraphicalView> {
  makeStepsOptions(): Shepherd.Step.StepOptions[] {
    return [
      {
        title: 'Playback',
        attachTo: { element: '#playback-commands-gridspan', on: 'right' },
        text: this.makeHTMLContent(helpContents['general']['play_button']),
      },
      {
        title: 'Spectrogram',
        attachTo: {
          element: this.inpainter.shadowContainer,
          on: 'bottom',
        },
        text: this.makeHTMLContent(
          helpContents['notono']['spectrogram_general']
        ),
        when: {
          show: () => {
            this.inpainter.interfaceElement.classList.add('shepherd-hidden')
          },
          hide: () => {
            this.inpainter.interfaceElement.classList.remove('shepherd-hidden')
          },
        },
        modalOverlayOpeningPadding: 10,
      },
      {
        title: 'Spectrogram transformations',
        attachTo: { element: this.inpainter.shadowContainer, on: 'bottom' },
        text: this.makeHTMLContent(
          helpContents['notono']['spectrogram_interaction']
        ),
        when: {
          show: () => this.inpainter.callToAction(),
        },
        modalOverlayOpeningPadding: 10,
      },
      {
        title: 'Model constraints',
        attachTo: { element: '#constraints-gridspan', on: 'top' },
        text: this.makeHTMLContent(helpContents['notono']['constraints']),
        // exposeContainer: 'bottom-controls',
      },
      {
        title: 'Edit tools',
        attachTo: { element: '#edit-tools-gridspan', on: 'top' },
        text: this.makeHTMLContent(helpContents['notono']['edit_tools']),
        // exposeContainer: 'bottom-controls',
      },
      {
        title: 'Downloading',
        attachTo: { element: '#download-button-gridspan', on: 'top' },
        text: this.makeHTMLContent(helpContents['notono']['download']),
        // exposeContainer: 'bottom-controls',
      },
      {
        title: 'Declick / Gain',
        attachTo: { element: '#mixing-controls-gridspan', on: 'top' },
        text: this.makeHTMLContent(helpContents['notono']['fade-in']),
        // exposeContainer: 'bottom-controls',
      },
      {
        title: "Audio drag'n'drop",
        text: this.makeHTMLContent(helpContents['notono']['drag-n-drop']),
        // animation: 'fadeInLeft',
        // exposeContainer: 'bottom-controls',
      },
      {
        title: 'Acknowledgments',
        text: this.makeHTMLContent(helpContents['general']['attributions']),
      },
    ]
  }

  // clean-up modifications to the DOM if the trip is exited mid-run
  protected cleanup(): void {
    super.cleanup()

    this.inpainter.interfaceElement.classList.remove('trip-hidden')
  }
}
