// adapted from Yotam Mann's midiInput.ts in @tonejs/piano
import { EventEmitter } from 'events'
import { Frequency, NormalRange, Time } from 'tone/build/esm/core/type/Units'

import { WebMidi, Input } from 'webmidi'
import type { NoteMessageEvent, ControlChangeMessageEvent } from 'webmidi'

type NoteEventType = 'keyDown' | 'keyUp'
type PedalEventType = 'pedalDown' | 'pedalUp'
type ConnectionEventType = 'connect' | 'disconnect'

interface DeviceData {
  id: string
  manufacturer: string
  name: string
}

interface MidiEvent {
  device: DeviceData
}

export interface ToneNoteEvent {
  note: Frequency
  duration?: Time
  time?: Time
  velocity?: NormalRange
}

type ConditionalEmitter<EventType> = EventType extends PedalEventType
  ? MidiEvent
  : EventType extends ConnectionEventType
  ? DeviceData
  : EventType extends NoteEventType
  ? ToneNoteEvent
  : unknown

type ConditionalListener<EventType> = (e: ConditionalEmitter<EventType>) => void

export class ToneMidiInput extends EventEmitter {
  /**
   * The device ID string. If set to 'all', will listen
   * to all MIDI inputs. Otherwise will filter a specific midi device
   */
  static readonly allMidiChannels = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]

  deviceId: string | 'all' | null

  channels: number[] = ToneMidiInput.allMidiChannels

  get isActive(): boolean {
    return this.deviceId != null
  }

  constructor(deviceId: string | 'all' | null = null) {
    super()

    this.deviceId = deviceId

    /**
     * Automatically attaches the event listeners when a device is connect
     * and removes listeners when a device is disconnected
     */
    ToneMidiInput.enabled()
      .then(() => {
        WebMidi.addListener('connected', (event) => {
          if (event.port.type === 'input') {
            this._addListeners(event.port)
          }
        })
        WebMidi.addListener('disconnected', (event) => {
          this._removeListeners(event.port)
        })

        // add all of the existing inputs
        WebMidi.inputs.forEach((input) => this._addListeners(input))
      })
      .catch((e) => {
        throw e
      })
  }

  protected webmidiEventToTonejsEvent(event: NoteMessageEvent): ToneNoteEvent {
    return {
      note:
        event.note.name +
        (event.note.accidental ?? '') +
        event.note.octave.toString(),
      velocity: event.note.attack,
    }
  }

  protected filterByDevice<
    EventT extends NoteMessageEvent | ControlChangeMessageEvent
  >(device: Input, callback: (event: EventT) => void): (event: EventT) => void {
    if (this.deviceId === 'all' || this.deviceId === device.id) {
      return callback
    } else {
      return () => {
        return
      }
    }
  }

  protected filterByChannel<
    EventT extends NoteMessageEvent | ControlChangeMessageEvent
  >(event: EventT, callback: (event: EventT) => void): (event: EventT) => void {
    if (this.channels.contains(event.message.channel)) {
      return callback
    } else {
      return () => {
        return
      }
    }
  }

  // triggered on `noteon` events coming from `device`
  protected makeOnNoteOn(device: Input): (event: NoteMessageEvent) => void {
    return (event) =>
      this.filterByDevice(
        device,
        this.filterByChannel(event, (event) =>
          this.emit('keyDown', this.webmidiEventToTonejsEvent(event))
        )
      )(event)
  }

  // triggered on `noteon` events coming from `device`
  protected makeOnNoteOff(device: Input): (event: NoteMessageEvent) => void {
    return (event) =>
      this.filterByDevice(
        device,
        this.filterByChannel(event, (event) =>
          this.emit('keyUp', this.webmidiEventToTonejsEvent(event))
        )
      )(event)
  }

  /**
   * Attach listeners to the device when it's connected
   */
  protected _addListeners(device: Input): void {
    if (!ToneMidiInput._connectedDevices.has(device.id)) {
      ToneMidiInput._connectedDevices.set(device.id, device)
      this.emit('connect', this._inputToDevice(device))

      device.addListener('noteon', this.makeOnNoteOn(device))
      device.addListener('noteoff', this.makeOnNoteOff(device))
      device.addListener('controlchange', (event) => {
        this.filterByDevice(device, (event: ControlChangeMessageEvent) => {
          if (event.controller.name === 'holdpedal') {
            this.emit(event.value ? 'pedalDown' : 'pedalUp', {
              device: this._inputToDevice(device),
            })
          }
        })
      })
    }
  }

  protected _inputToDevice(input: Input): DeviceData {
    return {
      name: input.name,
      id: input.id,
      manufacturer: input.manufacturer,
    }
  }

  /**
   * Internal call to remove all event listeners associated with the device
   */
  protected _removeListeners(event: { id: string }): void {
    const device = ToneMidiInput._connectedDevices.get(event.id)
    if (device != undefined) {
      this.emit('disconnect', this._inputToDevice(device))
      ToneMidiInput._connectedDevices.delete(event.id)
      device.removeListener('noteon')
      device.removeListener('noteoff')
      device.removeListener('controlchange')
    }
  }

  // EVENT FUNCTIONS
  emit<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
    event: EventType,
    data: ConditionalEmitter<EventType>
  ): boolean {
    return super.emit(event, data)
  }

  on<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
    event: EventType,
    listener: ConditionalListener<EventType>
  ): this {
    super.on(event, listener)
    return this
  }

  once<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
    event: EventType,
    listener: ConditionalListener<EventType>
  ): this {
    super.once(event, listener)
    return this
  }

  off<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
    event: EventType,
    listener: ConditionalListener<EventType>
  ): this {
    super.off(event, listener)
    return this
  }

  // STATIC

  protected static _connectedDevices: Map<string, Input> = new Map()

  protected static get connectedDevices(): Map<string, Input> {
    return this._connectedDevices
  }

  protected static _isEnabled = false

  /**
   * Resolves when the MIDI Input is enabled and ready to use
   */
  static async enabled(): Promise<void> {
    if (!ToneMidiInput._isEnabled) {
      await WebMidi.enable()
      ToneMidiInput._isEnabled = true
    }
  }

  /**
   * Get a list of devices that are currently connected
   */
  static async getDevices(): Promise<DeviceData[]> {
    await ToneMidiInput.enabled()
    return WebMidi.inputs
  }

  static async getDeviceId(name: string): Promise<string | null> {
    const devices = await ToneMidiInput.getDevices()
    const maybeDevice = devices.find((data) => data.name.toLowerCase() == name)
    if (maybeDevice == null) {
      return null
    } else {
      return maybeDevice.id
    }
  }

  async setDevice(name: string | 'all' | 'disabled' | null): Promise<void> {
    if (name == null) {
      this.deviceId = null
    } else {
      name = name.toLowerCase()
      if (name == 'disabled') {
        this.deviceId = null
      } else {
        if (name == 'all') {
          this.deviceId = 'all'
        } else {
          this.deviceId = await ToneMidiInput.getDeviceId(name)
        }
      }
    }
    this.emit('change-device', this.deviceId)
  }

  static checkMidiChannelsSetsEqual(
    channels: number[],
    previousChannels: number[]
  ): boolean {
    if (channels.length != previousChannels.length) {
      return false
    }
    if (channels.length == 1) {
      return channels[0] == previousChannels[0]
    } else {
      return true
    }
  }
}
