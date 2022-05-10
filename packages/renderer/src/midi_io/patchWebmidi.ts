import { WebMidi } from '/@webmidiESM'

WebMidi.enable = async function (
  this: typeof WebMidi,
  options: {
    callback?: Function | undefined
    sysex?: boolean | undefined
    validation?: boolean | undefined
    software?: boolean | undefined
    requestMIDIAccessFunction?: Function | undefined
  } = {},
  legacy = false
) {
  this.validation = options.validation !== false

  if (this.validation) {
    // Backwards-compatibility. Previous syntax was: enable(callback, sysex)
    if (typeof options === 'function')
      options = { callback: options, sysex: legacy }
    if (legacy) options.sysex = true
  }

  // If already enabled, trigger callback and resolve promise but do not dispatch events.
  if (this.enabled) {
    if (typeof options.callback === 'function') options.callback()
    return Promise.resolve()
  }

  /**
   * Event emitted when an error occurs trying to enable `WebMidi`
   *
   * @event WebMidi#error
   * @type {object}
   * @property {DOMHighResTimeStamp} timestamp The moment when the event occurred (in
   * milliseconds since the navigation start of the document).
   * @property {WebMidi} target The object that triggered the event
   * @property {string} type `error`
   * @property {*} error Actual error that occurred
   */
  const errorEvent = {
    timestamp: this.time,
    target: this,
    type: 'error',
    error: undefined,
  }

  /**
   * Event emitted once the MIDI interface has been successfully created (which implies user has
   * granted access to MIDI).
   *
   * @event WebMidi#midiaccessgranted
   * @type {object}
   * @property {DOMHighResTimeStamp} timestamp The moment when the event occurred (in milliseconds
   * since the navigation start of the document).
   * @property {WebMidi} target The object that triggered the event
   * @property {string} type `midiaccessgranted`
   */
  const midiAccessGrantedEvent = {
    timestamp: this.time,
    target: this,
    type: 'midiaccessgranted',
  }

  /**
   * Event emitted once `WebMidi` has been fully enabled
   *
   * @event WebMidi#enabled
   * @type {object}
   * @property {DOMHighResTimeStamp} timestamp The moment when the event occurred (in milliseconds
   * since the navigation start of the document).
   * @property {WebMidi} target The object that triggered the event
   * @property {string} type `"enabled"`
   */
  const enabledEvent = {
    timestamp: this.time,
    target: this,
    type: 'enabled',
  }

  // Request MIDI access (this iw where the prompt will appear)
  try {
    if (typeof options.requestMIDIAccessFunction === 'function') {
      this.interface = await options.requestMIDIAccessFunction({
        sysex: options.sysex,
        software: options.software,
      })
    } else {
      this.interface = await navigator.requestMIDIAccess({
        sysex: options.sysex,
        software: options.software,
      })
    }
  } catch (err) {
    errorEvent.error = err
    this.emit('error', errorEvent)
    if (typeof options.callback === 'function') options.callback(err)
    return Promise.reject(err)
  }

  // Now that the Web MIDI API interface has been created, we trigger the 'midiaccessgranted'
  // event. This allows the developer an occasion to assign listeners on 'connected' events.
  this.emit('midiaccessgranted', midiAccessGrantedEvent)

  // We setup the state change listener before creating the ports so that it properly catches the
  // the ports' `connected` events
  this.interface.onstatechange = this._onInterfaceStateChange.bind(this)

  // Update inputs and outputs (this is where `Input` and `Output` objects are created).
  try {
    await this._updateInputsAndOutputs()
  } catch (err) {
    errorEvent.error = err
    this.emit('error', errorEvent)
    if (typeof options.callback === 'function') options.callback(err)
    return Promise.reject(err)
  }

  // If we make it here, the ports have been successfully created, so we trigger the 'enabled'
  // event.
  this.emit('enabled', enabledEvent)

  // Execute the callback (if any) and resolve the promise with 'this' (for chainability)
  if (typeof options.callback === 'function') options.callback()
  return Promise.resolve(this)
}
