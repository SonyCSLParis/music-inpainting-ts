import * as Tone from 'tone'
import { RecursivePartial } from 'tone/build/esm/core/util/Interface'

export const steelPan_original = {
  voice: Tone.Synth,
  options: {
    oscillator: {
      type: 'fatsawtooth17',
      // partials: [0.2, 1, 0, 0.5, 0.1],
      spread: 40,
      count: 3,
    },
    envelope: {
      attack: 0.001,
      decay: 1,
      sustain: 0,
      release: 0.5,
    },
    portamento: 0.05,
  },
}

export const steelPan: Partial<Tone.PolySynthOptions<Tone.Synth>> = {
  voice: Tone.Synth,
  options: {
    oscillator: {
      type: 'fatsawtooth',
      // partials: [0.2, 1, 0, 0.5, 0.1],
      spread: 60,
      count: 7,
    },
    envelope: {
      attack: 0.1,
      decay: 2,
      sustain: 0.3,
      release: 0.3,
    },
    portamento: 0.1,
  },
}

export const alienChorus: Partial<Tone.PolySynthOptions<Tone.Synth>> = {
  voice: Tone.Synth,
  options: {
    oscillator: {
      type: 'fatsine4',
      spread: 60,
      count: 10,
    },
    envelope: {
      attack: 0.4,
      decay: 0.01,
      sustain: 1,
      attackCurve: 'sine',
      releaseCurve: 'sine',
      release: 0.4,
    },
  },
}

export const dropPulse: Partial<Tone.PolySynthOptions<Tone.Synth>> = {
  voice: Tone.Synth,
  options: {
    oscillator: {
      type: 'pulse',
      width: 0.8,
    },
    envelope: {
      attack: 0.01,
      decay: 0.05,
      sustain: 0.2,
      releaseCurve: 'bounce',
      release: 0.4,
    },
  },
}

export const delicateWindPart: Partial<Tone.PolySynthOptions<Tone.Synth>> = {
  voice: Tone.Synth,
  options: {
    portamento: 0.0,
    oscillator: {
      type: 'square4',
    },
    envelope: {
      attack: 2,
      decay: 1,
      sustain: 0.2,
      release: 2,
    },
  },
}

export const kalimba: Partial<Tone.PolySynthOptions<Tone.FMSynth>> = {
  voice: Tone.FMSynth,
  options: {
    harmonicity: 8,
    modulationIndex: 2,
    oscillator: {
      type: 'sine',
    },
    envelope: {
      attack: 0.001,
      decay: 2,
      sustain: 0.1,
      release: 2,
    },
    modulation: {
      type: 'square',
    },
    modulationEnvelope: {
      attack: 0.002,
      decay: 0.2,
      sustain: 0,
      release: 0.2,
    },
  },
}

export const electricCello: Partial<Tone.PolySynthOptions<Tone.FMSynth>> = {
  voice: Tone.FMSynth,
  options: {
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: {
      type: 'triangle',
    },
    envelope: {
      attack: 0.2,
      decay: 0.3,
      sustain: 0.1,
      release: 1.2,
    },
    modulation: {
      type: 'square',
    },
    modulationEnvelope: {
      attack: 0.01,
      decay: 0.5,
      sustain: 0.2,
      release: 0.1,
    },
  },
}

export const harmonics: Partial<Tone.PolySynthOptions<Tone.AMSynth>> = {
  voice: Tone.AMSynth,
  options: {
    harmonicity: 3.999,
    oscillator: {
      type: 'square',
    },
    envelope: {
      attack: 0.03,
      decay: 0.3,
      sustain: 0.7,
      release: 0.8,
    },
    modulation: {
      volume: 12,
      type: 'square6',
    },
    modulationEnvelope: {
      attack: 2,
      decay: 3,
      sustain: 0.8,
      release: 0.1,
    },
  },
}

export const tiny: Partial<Tone.PolySynthOptions<Tone.AMSynth>> = {
  voice: Tone.AMSynth,
  options: {
    harmonicity: 2,
    oscillator: {
      type: 'amsine2',
      modulationType: 'sine',
      harmonicity: 1.01,
    },
    envelope: {
      attack: 0.006,
      decay: 4,
      sustain: 0.04,
      release: 1.2,
    },
    modulation: {
      volume: 13,
      type: 'amsine2',
      modulationType: 'sine',
      harmonicity: 12,
    },
    modulationEnvelope: {
      attack: 0.006,
      decay: 0.2,
      sustain: 0.2,
      release: 0.4,
    },
  },
}
export const main: Tone.PolySynthOptions<Tone.FMSynth> = {
  ...tiny,
  options: {
    harmonicity: 20,
    oscillator: {
      type: 'pulse',
      // modulationType: 'sine',
      // harmonicity: 1.01,
    },
    envelope: {
      attack: 0.002,
      decay: 2,
      sustain: 0.04,
      release: 1.2,
    },
    modulation: {
      volume: 30,
      type: 'amsine2',
      modulationType: 'sine',
      harmonicity: 13,
    },
    modulationEnvelope: {
      attack: 0.006,
      decay: 1,
      sustain: 0.2,
      release: 0.4,
    },
    portamento: 0.2,
  },
}

if (import.meta.hot) {
  // import.meta.hot.accept()
}
