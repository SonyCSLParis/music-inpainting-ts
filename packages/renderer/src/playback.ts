import * as Tone from 'tone'
import { Transport as ToneTransport } from 'tone/build/esm/core/clock/Transport'
import log from 'loglevel'

import { AbletonLinkClient } from './ableton_link/linkClient.abstract'
import { EventEmitter } from 'events'
import { Inpainter } from './inpainter/inpainter'

log.setLevel(log.levels.INFO)

export interface MinimalPlaybackManager {
  play(): Promise<unknown>
  stop(): Promise<void>
}

abstract class TonePlaybackManager extends EventEmitter {
  protected playbackLookahead = 0.15
  protected interactiveLookahead = 0.1

  protected enabled = true

  get transport(): ToneTransport {
    return Tone.getTransport()
  }

  get context(): Tone.BaseContext {
    return this.transport.context
  }

  protected async resumeContext(): Promise<void> {
    return this.transport.context.resume()
  }

  readonly safeStartDuration: Tone.Unit.Time = '+0.2'

  // adds a small delay to ensure stable playback as recommended in the Tone.js docs
  protected safeStartPlayback(): void {
    this.transport.start(
      this.safeStartDuration,
      this.transport.toSeconds(this.totalDuration) *
        this.progressToTotalProgress(Math.max(0, this.transport.progress)) -
        this.context.lookAhead
    )
  }

  protected startPlayback(): void {
    this.transport.start(
      this.safeStartDuration,
      this.transport.toSeconds(this.totalDuration) *
        this.progressToTotalProgress(Math.max(0, this.transport.progress))
    )
  }

  async play(): Promise<void> {
    if (!this.enabled) {
      return
    }
    await this.resumeContext()
    // start the normal way
    this.startPlayback()
    // this.safeStartPlayback()
  }

  protected stopSound(): void {
    this.transport.stop()
  }

  async stop(): Promise<void> {
    await this.resumeContext()
    this.stopSound()
  }

  toggleLowLatency(force?: boolean): void {
    if (force != undefined) {
      force
        ? (this.transport.context.lookAhead = this.interactiveLookahead)
        : (this.transport.context.lookAhead = this.playbackLookahead)
    } else {
      this.transport.context.lookAhead == this.playbackLookahead
        ? (this.transport.context.lookAhead = this.interactiveLookahead)
        : (this.transport.context.lookAhead = this.playbackLookahead)
    }
    this.context.emit('statechange')
  }

  abstract get totalDuration(): Tone.Unit.Time

  get totalProgress(): number {
    return this.progressToTotalProgress(this.transport.progress)
  }
  totalProgressToTime(totalProgress: number): Tone.Unit.Time {
    return totalProgress * this.transport.toSeconds(this.totalDuration)
  }

  progressToTotalProgress(progress: number): number {
    if (!this.transport.loop) {
      return progress
    }
    return (
      (this.transport.toTicks(this.transport.loopStart) +
        progress *
          (this.transport.toTicks(this.transport.loopEnd) -
            this.transport.toTicks(this.transport.loopStart))) /
      this.transport.toTicks(this.totalDuration)
    )
  }

  async enable(): Promise<void> {
    this.enabled = true
    this.emit('enabled')
  }
  async disable(): Promise<void> {
    this.emit('disabled')
    this.transport.pause()
    this.enabled = false
  }
}

abstract class SynchronizedPlaybackManager extends TonePlaybackManager {
  protected linkClient?: AbletonLinkClient
  protected readonly automaticSynchronizationLoop: Tone.Loop

  // Start playback immediately at the beginning of the song
  // TODO(theis): check if really necessary
  protected startPlaybackNowFromBeginning(): void {
    this.transport.start()
  }

  // Start playback immediately at the beginning of the song
  // TODO(theis): check if really necessary
  protected startPlaybackNowWithLatencyCompensation(): void {
    this.transport.start(undefined, `0:${this.latencyCompensation_beats}`)
  }

  // TODO(theis): can this be replaced with super.start()?
  synchronizedStartCallback: () => Promise<void> = async () => {
    await Tone.getContext().resume()
    this.startPlaybackNowWithLatencyCompensation()
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async play() {
    if (this.linkClient == null || !this.linkClient.isEnabled) {
      // start the normal way
      await super.play()
    } else {
      // wait for Link-socket to give downbeat signal
      await this.startOnNextDownbeat()
    }
  }

  protected currentDownbeatCallback: (() => Promise<void>) | null = null

  // Listens for the next 'downbeat' event from the Ableton Link Client and
  // starts then.
  // Note: we make sure to clean-up the potential leftover listeners
  protected async startOnNextDownbeat(): Promise<void> {
    if (this.linkClient == undefined) {
      throw new Error(
        'This method should only be called with Ableton Link enabled'
      )
    }
    return new Promise<void>((resolve) => {
      if (this.currentDownbeatCallback != null) {
        this.linkClient?.removeListener(
          'downbeat',
          this.currentDownbeatCallback
        )
      }
      this.currentDownbeatCallback = () =>
        this.synchronizedStartCallback().then(resolve)
      setTimeout(() => {
        if (this.currentDownbeatCallback != null) {
          this.linkClient?.removeListener(
            'downbeat',
            this.currentDownbeatCallback
          )
        }
      }, 10000)
      this.linkClient?.once('downbeat', this.currentDownbeatCallback)
    })
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async stop() {
    await super.stop()
  }

  protected requestLinkPhaseUpdate(): void {
    if (
      this.transport.state == 'started' &&
      this.linkClient != null &&
      this.linkClient.isEnabled
    ) {
      this.linkClient.requestPhaseAsync()
    }
  }

  protected onPhaseUpdate(phase: number): void {
    // Set the position in the current measure to the provided phase
    // TODO(theis): should we use the `link.quantum` value?
    // Shift the playback head by the lookahead for latency compensation

    this.transport.position = `${this.getCurrentMeasure()}:${
      phase + this.latencyCompensation_beats
    }`
  }

  registerLinkClient(linkClient: AbletonLinkClient) {
    if (this.linkClient == null) {
      this.linkClient = linkClient
      this.linkClient.abletonLinkAPI.onPhase(
        this.linkClient.windowId,
        (phase: number) => this.onPhaseUpdate(phase)
      )
    } else {
      log.error('Ableton Link Client already registered')
    }
  }

  // Helper function to access the current measure in the Transport
  protected getCurrentMeasure(): string {
    const currentMeasure = this.transport.position.toString().split(':')[0]
    return currentMeasure
  }

  // HACK(theis): Quick-and-dirty automatic phase-locking to Ableton Link
  protected scheduleAutomaticResync(): Tone.Loop {
    const automaticSynchronizationLoop = new Tone.Loop(() => {
      this.requestLinkPhaseUpdate()
    }, '2n').start('4n')
    automaticSynchronizationLoop.humanize = 0.02
    return automaticSynchronizationLoop
  }

  constructor() {
    super()
    this.automaticSynchronizationLoop = this.scheduleAutomaticResync()
  }

  get latencyCompensation_beats(): number {
    const phaseCorrection_beats =
      (this.transport.bpm.value / 60) *
      (this.transport.context.lookAhead + this.midiLatencyCompensation * 100)
    return phaseCorrection_beats
  }

  midiLatencyCompensation: number = 0
}

export abstract class PlaybackManager<
  InpainterT extends Inpainter = Inpainter
> extends SynchronizedPlaybackManager {
  readonly inpainter: InpainterT
  protected abstract onInpainterChange(data: unknown): void

  constructor(inpainter: InpainterT) {
    super()
    this.inpainter = inpainter
    this.inpainter.on('change', (data) => this.onInpainterChange(data))
  }
}
