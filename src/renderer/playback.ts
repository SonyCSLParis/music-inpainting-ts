import * as Tone from 'tone'
import { Transport as ToneTransport } from 'tone/build/esm/core/clock/Transport'
import log from 'loglevel'

import LinkClient from './ableton_link/linkClient'

log.setLevel(log.levels.INFO)

export interface MinimalPlaybackManager {
  play(): Promise<unknown>
  stop(): Promise<void>
}

abstract class TonePlaybackManager {
  static readonly playbackLookahead = 0.3

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

  // adds a small delay to ensure playback as recommended in the Tone.js docs
  protected safeStartPlayback(): void {
    this.transport.start(this.safeStartDuration)
  }

  async play() {
    await this.resumeContext()
    // start the normal way
    this.safeStartPlayback()
  }

  protected stopSound(): void {
    this.transport.stop()
  }

  async stop() {
    await this.resumeContext()
    this.stopSound()
  }

  toggleLowLatency(force?: boolean): void {
    if (force != undefined) {
      force
        ? (this.transport.context.lookAhead = 0)
        : (this.transport.context.lookAhead = PlaybackManager.playbackLookahead)
    } else {
      this.transport.context.lookAhead == PlaybackManager.playbackLookahead
        ? (this.transport.context.lookAhead = 0)
        : (this.transport.context.lookAhead = PlaybackManager.playbackLookahead)
    }
    this.context.emit('statechange')
  }
}

abstract class SynchronizedPlaybackManager extends TonePlaybackManager {
  // Start playback immediately at the beginning of the song
  protected startPlaybackNowFromBeginning(): void {
    this.transport.start('+0.03', '0:0:0')
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async play() {
    await this.resumeContext()
    if (!LinkClient.isEnabled()) {
      // start the normal way
      this.safeStartPlayback()
    } else {
      log.info('LINK: Waiting for `downbeat` message...')
      // wait for Link-socket to give downbeat signal
      await LinkClient.once('downbeat', () => {
        this.startPlaybackNowFromBeginning()
      })
      log.info('LINK: Received `downbeat` message, starting playback')
    }
  }

  // Set the position in the current measure to the provided phase
  // TODO(theis): should we use the `link.quantum` value?
  synchronizeToLink(): void {
    if (this.transport.state == 'started' && LinkClient.isEnabled()) {
      const currentMeasure = this.getCurrentMeasure().toString()
      this.transport.position =
        currentMeasure + ':' + LinkClient.getPhaseSynchronous().toString()
    }
  }

  // Helper function to access the current measure in the Transport
  protected getCurrentMeasure(): number {
    const currentMeasure = this.transport.position.toString().split('')[0]
    return parseInt(currentMeasure)
  }

  // Quick-and-dirty automatic phase-locking to Ableton Link
  protected scheduleAutomaticResync() {
    new Tone.Loop(() => {
      this.synchronizeToLink()
    }, '3m').start('16n')
  }

  constructor() {
    super()
    this.scheduleAutomaticResync()
  }
}

export class PlaybackManager extends SynchronizedPlaybackManager {}
