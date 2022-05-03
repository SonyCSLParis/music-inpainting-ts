import $ from 'jquery'

import SimpleBar from 'simplebar'
import type { Options as SimpleBarOptions } from 'simplebar'

class TouchEnabledSimpleBar extends SimpleBar {
  protected mapTouchEventsToMouse(): void {
    // enables using touch events to drag the simplebar scrollbar
    // tweaked version of:
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
      passive: false,
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

  constructor(element: HTMLElement, options?: SimpleBarOptions) {
    super(element, options)
    this.mapTouchEventsToMouse()
  }
}

export class ScrollLockSimpleBar extends TouchEnabledSimpleBar {
  axis: {
    x: {
      track: { el: HTMLElement; rect: DOMRect }
      scrollbar: { el: HTMLElement; rect: DOMRect }
    }
    y: {
      track: { el: HTMLElement; rect: DOMRect }
      scrollbar: { el: HTMLElement; rect: DOMRect }
    }
  }

  static readonly scrollLockClass = 'scroll-lock'
  protected readonly scrollTracksClassNames: string = 'simplebar-track'
  protected readonly scrollHandlesClassNames: string = 'simplebar-scrollbar'

  constructor(element: HTMLElement, options?: SimpleBarOptions) {
    super(element, options)
    this.registerScrollLockCallback()
  }

  get scrollTracks(): Element[] {
    const scrollTracks = this.el.getElementsByClassName(
      this.scrollTracksClassNames
    )
    if (scrollTracks.length > 0) {
      return Array.from(scrollTracks)
    } else {
      throw new EvalError('No scroll-element not found')
    }
  }

  get scrollHandles(): Element[] {
    return this.scrollTracks.map((element) =>
      element.getElementsByClassName(this.scrollHandlesClassNames).item(0)
    )
  }

  get isScrollLocked(): boolean {
    return this.scrollTracks[0].classList.contains(
      ScrollLockSimpleBar.scrollLockClass
    )
  }

  registerScrollLockCallback(): void {
    // HACK(@tbazin, 2021/09/07): detects click events on the simplebar-track
    //   in order to detect clicks on the before pseudo-element and toggle
    //   scroll-lock, this breaks if clickOnTrack is enabled
    this.scrollTracks.forEach((element) =>
      element.addEventListener('click', function (this: HTMLElement): void {
        this.classList.toggle(ScrollLockSimpleBar.scrollLockClass)
      })
    )
  }

  toggleScrollLock(axis: 'x' | 'y', force?: boolean): boolean {
    return this.axis[axis].track.el.classList.toggle(
      ScrollLockSimpleBar.scrollLockClass,
      force
    )
  }

  onDragStart(e, axis: 'x' | 'y' = 'y'): void {
    this.toggleScrollLock(axis, true)
    // @ts-expect-error: super.onDragStart is private
    super.onDragStart(e, axis)
  }
}
