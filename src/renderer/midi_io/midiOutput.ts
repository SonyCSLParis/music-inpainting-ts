// adapted from Yotam Mann's midiInput.ts in @tonejs/piano

import { EventEmitter } from 'events'
import WebMidi, { Output } from 'webmidi'

export class MidiOutput extends EventEmitter {

	/**
	 * The device ID string. If set to 'all', will broadcast
	 * to all MIDI outputs. Otherwise will filter a specific midi device
	 */
	deviceId: string | 'all';

	constructor(deviceId: string | 'all' = 'all') {
		super()

		this.deviceId = deviceId

		/**
		 * Automatically attaches the event listeners when a device is connect
		 * and removes listeners when a device is disconnected
		 */
		MidiOutput.enabled().then(() => {
			WebMidi.addListener('connected', (event) => {
				if (event.port.type === 'output') {
					this._connectToDevice(event.port)
				}
			})
			WebMidi.addListener('disconnected', (event) => {
				this._disconnectDevice(event.port)
			})

			// add all of the existing outputs
			WebMidi.outputs.forEach(output => this._connectToDevice(output));
		})
	}


	/**
	 * Attach listeners to the device when it's connected
	 */
	private _connectToDevice(device: Output): void {
        if (!MidiOutput.connectedDevices.has(device.id)) {
			MidiOutput.connectedDevices.set(device.id, device)
            this.emit('connect', this._outputToDevice(device));
        }
    }

	private _outputToDevice(output: Output): DeviceData {
		return {
			name: output.name,
			id: output.id,
			manufacturer: output.manufacturer
		}
	}

	/**
	 * Internal call to remove all event listeners associated with the device
	 */
	private _disconnectDevice(event: { id: string }): void {
		if (MidiOutput.connectedDevices.has(event.id)) {
			const device = MidiOutput.connectedDevices.get(event.id)
			this.emit('disconnect', this._outputToDevice(device));
			MidiOutput.connectedDevices.delete(event.id);
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
		return this;
	}

	once<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
		event: EventType,
		listener: ConditionalListener<EventType>
	): this {
		super.once(event, listener)
		return this;
	}

	off<EventType extends PedalEventType | ConnectionEventType | NoteEventType>(
		event: EventType,
		listener: ConditionalListener<EventType>
	): this {
		super.off(event, listener)
		return this;
	}

	// STATIC

	private static connectedDevices: Map<string, Output> = new Map()

	private static _isEnabled = false;

	/**
	 * Resolves when the MIDI Output is enabled and ready to use
	 */
	static async enabled(): Promise<void> {
		if (!MidiOutput._isEnabled) {
			await new Promise<void>((done, error) => {
				WebMidi.enable((e) => {
					if (e) {
						error(e)
					} else {
						MidiOutput._isEnabled = true
						done()
					}
				})
			})
		}
	}

	/**
	 * Get a list of devices that are currently connected
	 */
	static async getDevices(): Promise<DeviceData[]> {
		await MidiOutput.enabled();
		return WebMidi.outputs;
	}
}
