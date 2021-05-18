import $ from 'jquery'
import log from 'loglevel'
import createActivityDetector from 'activity-detector'
import { SpectrogramLocator, Locator } from './locator'

import 'trip.js/dist/trip.css'
import '../common/styles/helpTour.scss'

import Trip from 'trip.js'

import localizations from '../common/localization.json'
const helpContents = localizations['help']

type TripStepOptions = Record<string, string | boolean | (() => void)>

export abstract class myTrip {
  protected trip: typeof Trip
  protected languages: string[]
  readonly locator: Locator
  protected tripDelay_ms = 10000
  readonly inactivityDetectorDelay?: number

  constructor(
    languages: string[],
    locator: Locator,
    inactivityDetectorDelay?: number
  ) {
    // TODO(theis, 2021/02/23: Fix help-tour display, scrambles app layout)
    log.error('Fix display of help-tour!')
    this.languages = languages
    this.locator = locator
    if (inactivityDetectorDelay != undefined) {
      this.inactivityDetectorDelay = inactivityDetectorDelay
    }

    const tripContents = this.makeContents()
    this.trip = new Trip(tripContents, this.tripOptions)

    if (
      this.inactivityDetectorDelay != null &&
      this.inactivityDetectorDelay > 0
    ) {
      this.registerIdleStateDetector()
    }

    const oldRun = this.trip.run.bind(this.trip)
    this.trip.run = function () {
      // pushes the <footer> element as last child of the body so as not to
      // disrupt layout, since Trip.start() always recreates the .trip-block element
      // and appends it to the body prior to calling Trip.run()
      $('body').append($('footer'))
      oldRun()
    }.bind(this.trip)
  }

  public start(): void {
    document.body.classList.add('help-tour-on')
    document.body.classList.add('advanced-controls')
    this.locator.refresh()

    $(() => {
      this.trip.start()
    })
  }

  public async stop(): Promise<JQuery> {
    this.cleanup()

    return $(() => {
      this.trip.stop()
    }).promise()
  }

  protected tripOptions = {
    showSteps: true,
    // onStart: initHideOnClickOutside,
    // onEnd: removeClickListener,
    // onTripStop: removeClickListener,
    overlayZIndex: 100,
    nextLabel: '→',
    prevLabel: '←',
    skipLabel: '',
    finishLabel: 'x',
    // tripTheme: 'white',
    showNavigation: true,
    showCloseBox: true,
    showHeader: true,
    // showCloseBox : true,
    delay: this.tripDelay_ms,
    onEnd: this.cleanup.bind(this),
    onTripStart: (
      tripIndex: number,
      tripObject: any // TODO(theis): add proper typing
    ) => {
      if (tripObject.expose && tripObject.hasOwnProperty('exposeContainer')) {
        const containerElement = document.getElementById(
          tripObject.exposeContainer
        )
        this.toggleExpose(containerElement, true)
      }
    },
    onTripEnd: (
      tripIndex: number,
      tripObject: any // TODO(theis): add proper typing
    ) => {
      if (tripObject.expose && tripObject.hasOwnProperty('exposeContainer')) {
        const containerElement = document.getElementById(
          tripObject.exposeContainer
        )
        this.toggleExpose(containerElement, false)
      }
    },
  }

  protected abstract makeContents(): TripStepOptions[]

  // clean-up modifications made to the DOM if the trip is exited mid-run
  protected cleanup(): void {
    document.body.classList.remove('help-tour-on')
    document.body.classList.remove('advanced-controls')
    // this is needed in conjunction with position: sticky for the .trip-block
    // in order to restore the locator's full size if the viewport was resized during the trip
    this.locator.refresh()
  }

  protected toggleExpose(element: HTMLElement, force?: boolean) {
    element.classList.toggle('trip-exposed-container', force)
  }

  protected makeHTMLContent(contents: Record<string, string>) {
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
    return this.tripDelay_ms * this.trip.tripContents.length
  }

  private loopInterval: NodeJS.Timeout

  public startLoop(): void {
    // starts the help tour in a looping fashion
    const self = this

    function intervalTripLoop() {
      self.loopInterval = setInterval(() => {
        // if (looping) {
        this.trip.start()
        // }
      }, self.totalTripDuration_ms + 500)
    }
    self.trip.start()
    intervalTripLoop()
  }

  protected stopLoop() {
    // stops the help tour from looping
    clearInterval(this.loopInterval)
  }

  public renderIcon(containerElement: HTMLElement) {
    const helpElement: HTMLAnchorElement = document.createElement('a')
    containerElement.appendChild(helpElement)

    helpElement.id = 'help-icon'
    helpElement.title = 'Help'

    // const self = this;
    helpElement.addEventListener(
      'click',
      async (event) => {
        // stops event from trigerring outsideClickListener registered onTripStart
        event.stopPropagation()
        await this.stop()
        this.start()
      },
      true
    )
  }

  protected outsideClickListener(event) {
    const target: HTMLElement = event.target
    if (!$(target).closest($('div.trip-block')).length) {
      this.stopLoop()
      this.trip.stop()
    }
  }

  protected initHideOnClickOutside() {
    // Attach an event listener to the whole document that detects clicks
    // out of the containing div and closes the selector in that case
    // Bind this callback when the selector is activated and unbind it when
    // it is closed

    // must add a delay so that the initial click is
    // setTimeout(() => {
    document.addEventListener('click', this.outsideClickListener)
    // },
    // 100);
  }

  protected removeClickListener() {
    document.removeEventListener('click', this.outsideClickListener)
  }

  public registerIdleStateDetector(): void {
    const activityDetector = createActivityDetector({
      timeToIdle: this.inactivityDetectorDelay,
      autoInit: true,
      inactivityEvents: [],
    })

    activityDetector.on('idle', () => {
      console.log('The user is not interacting with the page')
      this.startLoop()
    })

    activityDetector.on('active', () => {
      console.log('The user is interacting with the page')
      this.stopLoop()
    })
  }
}

export class NonotoTrip extends myTrip {
  protected makeContents(): Record<string, string | boolean>[] {
    // TODO contents should depend on AnnotationBox type used
    return [
      {
        sel: '#playback-commands-gridspan',
        content: this.makeHTMLContent(helpContents['general']['play_button']),
        position: 'e',
        expose: true,
        header: 'Playback',
      },
      {
        sel: '#4-0-0-timeContainer-common',
        content: this.makeHTMLContent(helpContents['nonoto']['note_box']),
        position: 'e',
      },
      {
        sel: '#1-1-1-timeContainer-common-Fermata',
        content: this.makeHTMLContent(helpContents['nonoto']['fermata_box']),
        position: 's',
      },
    ]
  }
}

export class NotonoTrip extends myTrip {
  readonly locator: SpectrogramLocator

  protected makeContents(): TripStepOptions[] {
    return [
      {
        sel: '#playback-commands-gridspan',
        content: this.makeHTMLContent(helpContents['general']['play_button']),
        position: 'e',
        header: 'Playback',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#spectrogram-container-shadow-container',
        content: this.makeHTMLContent(
          helpContents['notono']['spectrogram_general']
        ),
        position: 's',
        expose: true,
        header: 'Spectrogram 1: General',
        onTripStart: () => {
          $(
            '#spectrogram-container-interface-container'
          )[0].children[1].classList.add('trip-hidden')
          this.toggleExpose(document.getElementById('main-panel'), true)
        },
        onTripEnd: () => {
          $(
            '#spectrogram-container-interface-container'
          )[0].children[1].classList.remove('trip-hidden')
          this.toggleExpose(document.getElementById('main-panel'), false)
        },
      },
      {
        sel: '#spectrogram-container-shadow-container',
        content: this.makeHTMLContent(
          helpContents['notono']['spectrogram_interaction']
        ),
        position: 's',
        expose: true,
        header: 'Spectrogram transformations',
        onTripStart: () => {
          this.locator.callToAction()
          this.toggleExpose(document.getElementById('main-panel'), true)
        },
        onTripEnd: () => {
          this.toggleExpose(document.getElementById('main-panel'), false)
        },
      },
      {
        sel: '#constraints-gridspan',
        content: this.makeHTMLContent(helpContents['notono']['constraints']),
        position: 'n',
        header: 'Model constraints',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#edit-tools-gridspan',
        content: this.makeHTMLContent(helpContents['notono']['edit_tools']),
        position: 'n',
        header: 'Edit tools',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#download-button-gridspan',
        content: this.makeHTMLContent(helpContents['notono']['download']),
        position: 'ne',
        header: 'Downloading',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#volume-controls-gridspan',
        content: this.makeHTMLContent(helpContents['notono']['fade-in']),
        position: 'nw',
        header: 'Declick / Gain',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#main-panel',
        content: this.makeHTMLContent(helpContents['notono']['drag-n-drop']),
        position: 'screen-center',
        header: "Audio drag'n'drop",
        animation: 'fadeInLeft',
        expose: true,
        exposeContainer: 'bottom-controls',
      },
      {
        sel: '#main-panel',
        content: this.makeHTMLContent(helpContents['general']['attributions']),
        position: 'screen-center',
        header: 'Acknowledgments',
      },
    ]
  }

  // clean-up modifications to the DOM if the trip is exited mid-run
  protected cleanup(): void {
    super.cleanup()

    $(
      '#spectrogram-container-interface-container'
    )[0].children[1].classList.remove('trip-hidden')
  }
}
