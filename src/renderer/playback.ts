// <reference path='./jquery-exists.d.ts'/>

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
  get transport(): ToneTransport {
    return Tone.getTransport()
  }

  readonly safeStartDuration: Tone.Unit.Time = '+0.1'

  // adds a small delay to ensure playback as recommended in the Tone.js docs
  protected safeStartPlayback(): void {
    this.transport.start(this.safeStartDuration)
  }

  async play() {
    await Tone.getContext().resume()
    // start the normal way
    this.safeStartPlayback()
  }

  protected stopSound(): void {
    this.transport.stop()
  }

  async stop() {
    await Tone.getContext().resume()
    this.stopSound()
  }
}

abstract class SynchronizedPlaybackManager extends TonePlaybackManager {
  // Start playback immediately at the beginning of the song
  protected startPlaybackNowFromBeginning(): void {
    this.transport.start('+0.03', '0:0:0')
  }

  // Start playback either immediately or in sync with Link if Link is enabled
  async play() {
    await Tone.getContext().resume()
    if (!LinkClient.isEnabled()) {
      // start the normal way
      this.safeStartPlayback()
    } else {
      log.info('LINK: Waiting for `downbeat` message...')
      // wait for Link-socket to give downbeat signal
      await LinkClient.once('downbeat', async () => {
        this.startPlaybackNowFromBeginning()
      })
      log.info('LINK: Received `downbeat` message, starting playback')
    }
  }

  // Set the position in the current measure to the provided phase
  // TODO(theis): should we use the `link.quantum` value?
  synchronizeToLink(): void {
    if (Tone.getTransport().state == 'started' && LinkClient.isEnabled()) {
      const currentMeasure = this.getCurrentMeasure().toString()
      Tone.getTransport().position =
        currentMeasure + ':' + LinkClient.getPhaseSynchronous().toString()
    }
  }

  // Helper function to access the current measure in the Transport
  protected getCurrentMeasure(): number {
    const currentMeasure = Tone.getTransport().position.toString().split('')[0]
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
