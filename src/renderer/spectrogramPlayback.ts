import * as Tone from 'tone'
import FocusedAudioKeys from './audiokeys/audiokeys'
import { Midi } from '@tonaljs/tonal'

import { PlaybackManager } from './playback'

import Nexus from './nexusColored'

import { getMidiInputListener } from './midiIn'
import { IMidiChannel } from 'webmidi'
import * as ControlLabels from './controlLabels'

import log from 'loglevel'

interface NoteEvent {
  note: string
  midi: number
  velocity: number
}

export class SpectrogramPlaybackManager extends PlaybackManager {
  protected playbackLookahead = 0
  protected interactiveLookahead = 0

  // initialize crossfade to play player A
  protected readonly masterLimiter: Tone.Limiter = new Tone.Limiter(
    -10
  ).toDestination()
  protected readonly masterGain: Tone.Gain = new Tone.Gain(1).connect(
    this.masterLimiter
  )
  protected readonly crossFade: Tone.CrossFade = new Tone.CrossFade(0).connect(
    this.masterGain
  )
  protected readonly player_A: Tone.Player = new Tone.Player().connect(
    this.crossFade.a
  )
  protected readonly player_B: Tone.Player = new Tone.Player().connect(
    this.crossFade.b
  )
  protected get players(): Tone.Player[] {
    return [this.player_A, this.player_B]
  }

  protected readonly buffer_A: Tone.ToneAudioBuffer = Tone.ToneAudioBuffer.fromArray(
    new Float32Array([0])
  )
  protected readonly buffer_B: Tone.ToneAudioBuffer = Tone.ToneAudioBuffer.fromArray(
    new Float32Array([0])
  )

  protected readonly sampler_A: Tone.Sampler = new Tone.Sampler({
    C4: this.buffer_A,
  }).connect(this.crossFade.a)
  protected readonly sampler_B: Tone.Sampler = new Tone.Sampler({
    C4: this.buffer_B,
  }).connect(this.crossFade.b)
  protected get samplers(): Tone.Sampler[] {
    return [this.sampler_A, this.sampler_B]
  }

  protected crossFadeDuration: Tone.Unit.Time = '1'
  // look-ahead duration to retrieve the state of the crossfade after potential fading operations
  protected crossFadeOffset: Tone.Unit.Time = '+1.1'

  protected readonly desktopKeyboard = new FocusedAudioKeys({
    polyphony: Infinity,
    rows: 2,
    rootNote: 60,
    layoutIndependentMapping: true,
  })

  constructor() {
    super()

    this.scheduleInitialPlaybackLoop()
    try {
      void getMidiInputListener().then((midiListener) => {
        if (midiListener !== null) {
          midiListener.on('keyDown', (note: NoteEvent) => {
            this.onkeydown(note)
          })
          midiListener.on('keyUp', (note: NoteEvent) => {
            this.onkeyup(note)
          })
        }
      })
    } catch (e) {
      log.info('Could not initialize MIDI-Input listener due to: ', e)
    }

    this.desktopKeyboard.down((keyboardNote: AudioKeysNoteData) => {
      const note = {
        velocity: keyboardNote.velocity / 127,
        midi: keyboardNote.note,
        note: Midi.midiToNoteName(keyboardNote.note),
      }
      this.onkeydown(note)
    })
    this.desktopKeyboard.up((keyboardNote: AudioKeysNoteData) => {
      const note = {
        velocity: keyboardNote.velocity / 127,
        midi: keyboardNote.note,
        note: Midi.midiToNoteName(keyboardNote.note),
      }
      this.onkeyup(note)
    })

    this.toggleLowLatency(true)
  }

  protected onkeyup(data: NoteEvent): this {
    this.samplers.forEach((sampler) => sampler.triggerRelease(data.note))
    return this
  }

  // plays the sound on all samplers to ensure smooth transitioning
  // in the advent of inpainting operations
  protected onkeydown(data: NoteEvent): this {
    this.samplers.forEach((sampler) =>
      sampler.triggerAttack(data.note, undefined, data.velocity)
    )
    return this
  }

  // duration of the currently playing player in seconds
  public get duration(): Tone.Unit.Seconds {
    return this.currentPlayer().buffer.duration
  }

  protected currentPlayerIsA(): boolean {
    return this.crossFade.fade.getValueAtTime(this.crossFadeOffset) <= 0.5
  }

  // return the buffer scheduled to play after any eventual crossfade operation has been completed
  protected currentBuffer(): Tone.ToneAudioBuffer {
    return this.currentPlayerIsA() ? this.buffer_A : this.buffer_B
  }

  // return the sampler scheduled to play after any eventual crossfade operation has been completed
  protected currentSampler(): Tone.Sampler {
    return this.currentPlayerIsA() ? this.sampler_A : this.sampler_B
  }

  // return the player scheduled to play after any eventual crossfade operation has been completed
  protected currentPlayer(): Tone.Player {
    return this.currentPlayerIsA() ? this.player_A : this.player_B
  }

  // return the player scheduled to be idle after any eventual crossfade operation has been completed
  protected nextPlayer(): Tone.Player {
    return this.currentPlayerIsA() ? this.player_B : this.player_A
  }

  // return the buffer scheduled to be idle after any eventual crossfade operation has been completed
  protected nextBuffer(): Tone.ToneAudioBuffer {
    return this.currentPlayerIsA() ? this.buffer_B : this.buffer_A
  }

  // crossfade between the two players
  protected switchPlayers(): void {
    const currentlyScheduledCrossFadeValue: number = this.crossFade.fade.getValueAtTime(
      this.crossFadeOffset
    )
    const newCrossFadeValue = Math.round(1 - currentlyScheduledCrossFadeValue) // round ensures binary values
    this.crossFade.fade.linearRampTo(newCrossFadeValue, this.crossFadeDuration)
  }

  // initialize the Transport loop and synchronize the two players
  protected scheduleInitialPlaybackLoop(): void {
    this.players.forEach((player) => player.sync())
    this.transport.loop = true
  }

  // load a remote audio file into the next player and switch playback to it
  async loadAudio(audioURL: string): Promise<void> {
    await Promise.all([
      this.nextPlayer().load(audioURL),
      this.nextBuffer().load(audioURL),
    ])

    // must unsync/resync to remove scheduled play/stop commands,
    // otherwise the following stop() command is rejected
    this.nextPlayer().unsync()
    // required playback stop to allow playing the newly loaded buffer
    this.nextPlayer().stop()
    this.nextPlayer().sync()

    // reschedule the Transport loop
    this.transport.setLoopPoints(0, this.nextPlayer().buffer.duration)
    this.nextPlayer().start(0)

    this.switchPlayers()
  }

  setFadeIn(duration_s: number): void {
    this.player_A.fadeIn = this.player_B.fadeIn = this.sampler_A.attack = this.sampler_B.attack = duration_s
  }

  get Gain(): number {
    return this.masterGain.gain.value
  }
  set Gain(newGain: number) {
    this.masterGain.gain.value = newGain
  }

  renderGainControl(container: HTMLElement): void {
    const gainControlElement = document.createElement('div')
    gainControlElement.classList.add('control-item', 'advanced')
    container.appendChild(gainControlElement)

    const gainControl = new Nexus.Slider(gainControlElement, {
      size: [60, 20],
      mode: 'absolute',
      min: 0,
      max: 1.2,
      step: 0,
      value: 1,
    })
    gainControl.on('change', (newGain: number) => {
      this.Gain = newGain
    })
    gainControl.value = 1
    gainControl

    const localizationId = 'gain-control-label'
    ControlLabels.createLabel(
      gainControlElement,
      localizationId,
      true,
      localizationId,
      container
    )
  }

  renderFadeInControl(container: HTMLElement): void {
    const fadeInControlElement = document.createElement('div')
    fadeInControlElement.classList.add('control-item', 'advanced')
    container.appendChild(fadeInControlElement)

    const fadeInControl = new Nexus.Toggle(fadeInControlElement, {
      size: [40, 20],
      state: false,
    })
    const fadeIn_duration_s = 0.01
    fadeInControl.on('change', (enable: boolean) => {
      this.setFadeIn(enable ? fadeIn_duration_s : 0)
    })
    fadeInControl.state = true

    const localizationId = 'fade-in-control-label'
    ControlLabels.createLabel(
      fadeInControlElement,
      localizationId,
      true,
      localizationId,
      container
    )
  }
}

interface NoteEventWithChannel extends NoteEvent {
  channel?: IMidiChannel
}

export class MultiChannelSpectrogramPlaybackManager extends SpectrogramPlaybackManager {
  readonly numVoices: number = 16 // for MIDI playback
  protected voices_A: Tone.Sampler[]
  protected voices_B: Tone.Sampler[]

  constructor() {
    super()

    this.voices_A = Array(this.numVoices)
      .fill(0)
      .map(() => {
        return new Tone.Sampler({
          C4: new Tone.Buffer(this.buffer_A.get()),
        }).connect(this.crossFade.a)
      })
    this.voices_B = Array(this.numVoices)
      .fill(0)
      .map(() => {
        return new Tone.Sampler({
          C4: new Tone.Buffer(this.buffer_B.get()),
        }).connect(this.crossFade.b)
      })
  }

  protected onkeydown(data: NoteEventWithChannel): this {
    this.getSamplersByMidiChannel(data.channel).forEach((voice) =>
      voice.triggerAttack(data.note, undefined, data.velocity)
    )
    return this
  }

  protected onkeyup(data: NoteEventWithChannel): this {
    this.getSamplersByMidiChannel(data.channel).forEach((voice) => {
      voice.triggerRelease(data.note)
    })
    return this
  }

  get currentVoices(): Tone.Sampler[] {
    return this.currentPlayerIsA() ? this.voices_A : this.voices_B
  }

  protected getSamplersByMidiChannel(
    channel: IMidiChannel = 1
  ): Tone.Sampler[] {
    if (channel === 'all') {
      return this.currentVoices
    } else if (Array.isArray(channel)) {
      return this.currentVoices.filter((value, index) => {
        channel.contains(index + 1)
      })
    } else {
      return [this.currentVoices[channel - 1]]
    }
  }

  protected updateBuffers(): void {
    this.voices_A.forEach((voice) => {
      voice.dispose()
    })
    this.voices_A.clear()
    this.voices_A = Array(this.numVoices)
      .fill(0)
      .map(() => {
        return new Tone.Sampler({
          C4: new Tone.Buffer(this.buffer_A.get()),
        }).connect(this.crossFade.a)
      })
    this.voices_B.forEach((voice) => {
      voice.dispose()
    })
    this.voices_B.clear()
    this.voices_B = Array(this.numVoices)
      .fill(0)
      .map(() => {
        return new Tone.Sampler({
          C4: new Tone.Buffer(this.buffer_B.get()),
        }).connect(this.crossFade.b)
      })
  }

  async loadAudio(audioURL: string): Promise<void> {
    await super.loadAudio(audioURL)
    this.voices_A.forEach((voice) => {
      voice.add('C4', this.buffer_A.get())
    })
    this.voices_B.forEach((voice) => {
      voice.add('C4', this.buffer_B.get())
    })
  }

  setFadeIn(duration_s: number): void {
    super.setFadeIn(duration_s)
    this.voices_A.forEach((voice) => {
      voice.attack = duration_s
    })
    this.voices_B.forEach((voice) => {
      voice.attack = duration_s
    })
  }
}
