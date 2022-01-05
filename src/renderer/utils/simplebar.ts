export function mapTouchEventsToMouseSimplebar(): void {
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
