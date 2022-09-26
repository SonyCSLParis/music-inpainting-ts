// adapted from Yotam Mann's midiInput.ts in @tonejs/piano
import { getMidiInputListener } from '../midiIn'

import { EventEmitter } from 'events'
import { WebMidi, Output } from 'webmidi'
import { ToneMidiInput } from './midiInput'

export class MidiOutput extends EventEmitter {
  /**
   * The device ID string. If set to 'all', will broadcast
   * to all MIDI outputs. Otherwise will filter a specific midi device
   */
  private _deviceId: string | 'all' | null

  get deviceId(): string | 'all' | null {
    return this._deviceId
  }

  set deviceId(deviceId: string | 'all' | null) {
    if (this._deviceId != deviceId) {
      this._deviceId = deviceId
      void MidiOutput.getDeviceName(this.deviceId).then((deviceName) =>
        this.midiInputListener.setDevice(deviceName)
      )
      this.emit('device-changed', deviceId)
    }
  }

  static async getDeviceId(name: string): Promise<string | null> {
    const devices = await MidiOutput.getDevices()
    const maybeDevice = devices.find(
      (data) => data.name.toLowerCase() == name.toLowerCase()
    )
    if (maybeDevice == null) {
      return null
    } else {
      return maybeDevice.id
    }
  }

  static async getDeviceName(id: string): Promise<string | null> {
    const devices = await MidiOutput.getDevices()
    const maybeDevice = devices.find((data) => data.id == id)
    if (maybeDevice == null) {
      return null
    } else {
      return maybeDevice.name
    }
  }

  get isActive(): boolean {
    return this.deviceId != null
  }

  async setDevice(name: string | 'all' | 'disabled'): Promise<void> {
    name = name.toLowerCase()
    if (name == 'disabled') {
      this.deviceId = null
    } else {
      if (name == 'all') {
        this.deviceId = 'all'
      } else {
        this.deviceId = await MidiOutput.getDeviceId(name)
      }
    }
  }

  constructor(deviceId: string | 'all' = 'all') {
    super()

    this.midiInputListener = new ToneMidiInput(null)

    this._deviceId = deviceId

    /**
     * Automatically attaches the event listeners when a device is connect
     * and removes listeners when a device is disconnected
     */
    void MidiOutput.enabled().then(() => {
      WebMidi.addListener('connected', (event) => {
        if (event.port.type === 'output') {
          this._connectToDevice(event.port)
        }
      })
      WebMidi.addListener('disconnected', (event) => {
        this._disconnectDevice(event.port)
      })

      // add all of the existing outputs
      WebMidi.outputs.forEach((output) => this._connectToDevice(output))
    })
  }

  /**
   * Attach listeners to the device when it's connected
   */
  private _connectToDevice(device: Output): void {
    if (!MidiOutput.connectedDevices.has(device.id)) {
      MidiOutput.connectedDevices.set(device.id, device)
      this.emit('connect', this._outputToDevice(device))
    }
  }

  private _outputToDevice(output: Output): DeviceData {
    return {
      name: output.name,
      id: output.id,
      manufacturer: output.manufacturer,
    }
  }

  /**
   * Internal call to remove all event listeners associated with the device
   */
  private _disconnectDevice(event: { id: string }): void {
    if (MidiOutput.connectedDevices.has(event.id)) {
      const device = MidiOutput.connectedDevices.get(event.id)
      this.emit('disconnect', this._outputToDevice(device))
      MidiOutput.connectedDevices.delete(event.id)
    }
  }

  // EVENT FUNCTIONS

  emit<
    EventType extends
      | PedalEventType
      | ConnectionEventType
      | NoteEventType
      | 'device-changed'
  >(event: EventType, data: ConditionalEmitter<EventType>): boolean {
    return super.emit(event, data)
  }

  on<
    EventType extends
      | PedalEventType
      | ConnectionEventType
      | NoteEventType
      | 'device-changed'
  >(event: EventType, listener: ConditionalListener<EventType>): this {
    super.on(event, listener)
    return this
  }

  once<
    EventType extends
      | PedalEventType
      | ConnectionEventType
      | NoteEventType
      | 'device-changed'
  >(event: EventType, listener: ConditionalListener<EventType>): this {
    super.once(event, listener)
    return this
  }

  off<
    EventType extends
      | PedalEventType
      | ConnectionEventType
      | NoteEventType
      | 'device-changed'
  >(event: EventType, listener: ConditionalListener<EventType>): this {
    super.off(event, listener)
    return this
  }

  // STATIC

  private static connectedDevices: Map<string, Output> = new Map<
    string,
    Output
  >()

  private static _isEnabled = WebMidi.enabled

  /**
   * Resolves when the MIDI Output is enabled and ready to use
   */
  static async enabled(): Promise<void> {
    if (!MidiOutput._isEnabled) {
      if (WebMidi.enabled) {
        MidiOutput._isEnabled = true
        return
      }
      await WebMidi.enable()
      MidiOutput._isEnabled = true
    }
  }

  /**
   * Get a list of devices that are currently connected
   */
  static async getDevices(): Promise<DeviceData[]> {
    await MidiOutput.enabled()
    return WebMidi.outputs
  }

  // a midiInputListener that is bound to listen to the device used for output
  // used for tracking generated MIDI events through a feedback loop
  // can be used for visual feedback
  readonly midiInputListener: ToneMidiInput
}
