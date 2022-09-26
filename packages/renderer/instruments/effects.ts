import * as Tone from 'tone'

export const limiter = new Tone.Limiter(-6)
const chorus = new Tone.Chorus(1, 2, 0.5)
const gainReduction = new Tone.Gain(-10, 'decibels')
// const reverbWet = new Tone.Gain(-7, 'decibels').toDestination()
let reverb: Promise<Tone.Reverb> | undefined = new Tone.Reverb({
  decay: 3,
  preDelay: 0.02,
  wet: 0.15,
}).generate()
// let reverb: Promise<Tone.Reverb> | undefined = new Promise((resolve) => {
//   resolve(new Tone.Gain(-10, 'decibels').toDestination())
// })

// .then((generated) => {
//   reverb = generated
// })
export const effects = new Promise<Tone.ToneAudioNode>(async (resolve) => {
  const maybeReverb = await reverb
  if (maybeReverb != null) {
    const useReverb = true
    if (useReverb) {
      gainReduction.gain.value = -10
      resolve(
        gainReduction.connect(limiter).connect(maybeReverb.toDestination())
      )
    } else {
      maybeReverb.disconnect()
      gainReduction.gain.value = -20
      resolve(gainReduction.connect(limiter.toDestination())) //.connect(maybeReverb))
    }
  } else {
    resolve(limiter.toDestination())
  }
}) // new Tone.Gain(0, 'decibels').connect(limiter)
