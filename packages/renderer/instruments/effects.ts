import * as Tone from 'tone'

export const limiter = new Tone.Limiter(-6).toDestination()
const chorus = new Tone.Chorus(1, 2, 0.5).toDestination()
let reverb: Promise<Tone.Reverb> | undefined = new Tone.Reverb()
  .toDestination()
  .generate()

// .then((generated) => {
//   reverb = generated
// })
export const effects = reverb // new Tone.Gain(0, 'decibels').connect(limiter)
