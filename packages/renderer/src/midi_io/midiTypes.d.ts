// adapted from Yotam Mann's midiInput.ts in @tonejs/piano

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

interface NoteEvent extends MidiEvent {
  note: string
  midi: number
  velocity: number
}

type ConditionalEmitter<EventType> = EventType extends PedalEventType
  ? MidiEvent
  : EventType extends ConnectionEventType
  ? DeviceData
  : EventType extends NoteEventType
  ? NoteEvent
  : unknown

type ConditionalListener<EventType> = (e: ConditionalEmitter<EventType>) => void
