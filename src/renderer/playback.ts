import * as Tone from 'tone'
import { Transport as ToneTransport } from 'tone/build/esm/core/clock/Transport'
import log from 'loglevel'

import { AbletonLinkClient } from './ableton_link/linkClient.abstract'
import EventEmitter from 'events'

log.setLevel(log.levels.INFO)

export interface MinimalPlaybackManager {
  play(): Promise<unknown>
  stop(): Promise<void>
}

abstract class TonePlaybackManager extends EventEmitter {
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
  protected linkClient?: AbletonLinkClient

  // Start playback immediately at the beginning of the song
  // TODO(theis): check if really necessary
  protected startPlaybackNowFromBeginning(): void {
    this.transport.start('+0.03', '0:0:0')
  }

  // TODO(theis): can this be replaced with super.start()?
  async synchronizedStartCallback(): Promise<void> {
    await Tone.getContext().resume()
    this.startPlaybackNowFromBeginning()
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async play() {
    if (this.linkClient == null || !this.linkClient.isEnabled) {
      // start the normal way
      await super.play()
    } else {
      log.debug('Ableton Link: Waiting for `downbeat` message...')
      // wait for Link-socket to give downbeat signal
      this.linkClient.once('downbeat', () => {
        log.debug(
          'Ableton Link: Received `downbeat` message, starting playback'
        )
        void this.synchronizedStartCallback()
      })
    }
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async stop() {
    if (this.linkClient != null && this.linkClient.isEnabled) {
      log.info('LINK: Cancelling previously scheduled playback start')
      this.linkClient.removeListener(
        'downbeat',
        () => void this.synchronizedStartCallback()
      )
    }
    await super.stop()
  }

  synchronizeToLink(): void {
    if (
      this.transport.state == 'started' &&
      this.linkClient != null &&
      this.linkClient.isEnabled
    ) {
      this.linkClient.sendToServer('get-phase')
    }
  }

  registerLinkClient(linkClient: AbletonLinkClient) {
    if (this.linkClient == null) {
      this.linkClient = linkClient
      this.linkClient.onServerMessage('phase', (_, phase: number) => {
        // Set the position in the current measure to the provided phase
        // TODO(theis): should we use the `link.quantum` value?
        const currentMeasure = this.getCurrentMeasure().toString()
        this.transport.position = currentMeasure + ':' + phase.toString()
      })
    } else {
      log.error('Ableton Link Client already registered')
    }
  }

  // Helper function to access the current measure in the Transport
  protected getCurrentMeasure(): number {
    const currentMeasure = this.transport.position.toString().split('')[0]
    return parseInt(currentMeasure)
  }

  // HACK(theis): Quick-and-dirty automatic phase-locking to Ableton Link
  protected scheduleAutomaticResync() {
    new Tone.Loop(() => {
      this.synchronizeToLink()
    }, '2m').start('16n')
  }

  constructor() {
    super()
    this.scheduleAutomaticResync()
  }
}

export class PlaybackManager extends SynchronizedPlaybackManager {}
