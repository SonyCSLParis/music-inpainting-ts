import { LinearScale, LinearScaleOptions, Tick, Ticks } from 'chart.js'
import { finiteOrDefault } from 'chart.js/helpers'

export type Mel = number
export type Hertz = number

type MelScaleSpecificOptions = {
  melBreakFrequency: Hertz
}

type MelScaleOptions = LinearScaleOptions & MelScaleSpecificOptions

export class MelScaleHelper {
  readonly melBreakFrequency: Hertz
  readonly melQFactor: number

  static readonly GANSYNTH_MEL_BREAK_FREQUENCY_HERTZ: Hertz = 700
  static readonly GANSYNTH_MEL_HIGH_FREQUENCY_Q = 1127

  constructor(
    melBreakFrequency: Hertz = MelScaleHelper.GANSYNTH_MEL_BREAK_FREQUENCY_HERTZ
  ) {
    this.melBreakFrequency = melBreakFrequency
    this.melQFactor = this.computeMelQFactor()
  }

  protected computeMelQFactor(): number {
    if (
      this.melBreakFrequency !=
      MelScaleHelper.GANSYNTH_MEL_BREAK_FREQUENCY_HERTZ
    ) {
      // by convention, 1000mels should be equal to 1000Hz
      return 1000 / Math.log(1 + 1000 / this.melBreakFrequency)
    } else {
      // for consistency with the GANSynth codebase
      return MelScaleHelper.GANSYNTH_MEL_HIGH_FREQUENCY_Q
    }
  }

  // Convert from mel scale to linear scale
  melToHertz(mel: number): Hertz {
    return this.melBreakFrequency * (Math.exp(mel / this.melQFactor) - 1.0)
  }

  // Convert from linear scale to mel scale
  hertzToMel(hertz: Hertz): number {
    return this.melQFactor * Math.log(1.0 + hertz / this.melBreakFrequency)
  }
}

type MinMaxRange = { min: number; max: number }

// isMajor() and generateTicks() pulled from the Chart.js sources:
// https://github.com/chartjs/Chart.js/blob/56661e448d8478e7cbce0f30d70d0bf1d2a2da8c/src/scales/scale.logarithmic.js
function isMajor(tickVal: number): boolean {
  const remain = tickVal / Math.pow(10, Math.floor(Math.log10(tickVal)))
  return remain === 1
}

// y-axis scale for (Linear) Mel Scale frequencies with custom break frequency
export class MelFrequencyScale extends LinearScale<MelScaleOptions> {
  protected melScaleHelper: MelScaleHelper
  protected _startValue: Mel
  protected _valueRange: Mel

  static maxTicksLimit = 20

  configure(): void {
    super.configure()
    this.melScaleHelper = new MelScaleHelper(this.options.melBreakFrequency)
    this._startValue = this.melScaleHelper.hertzToMel(this.min)
    this._valueRange =
      this.melScaleHelper.hertzToMel(this.max) - this._startValue
  }

  getPixelForValue(value: Hertz): number {
    const melValue = this.melScaleHelper.hertzToMel(value)
    const pixel = super.getPixelForValue(melValue)
    return pixel
  }

  getValueForPixel(pixel: number): number {
    const logScaleValue = super.getValueForPixel(pixel)
    return this.melScaleHelper.melToHertz(logScaleValue)
  }

  buildTicks(): Tick[] {
    const logarithmicallySpacedTicks = this.generateTicks(
      { min: this.min, max: this.max },
      { min: this.min, max: this.max }
    )
    return logarithmicallySpacedTicks.filter((tick: Tick): boolean => {
      const value = tick.value
      if ([this.min, this.max].includes(value)) {
        return true
      }
      const firstDigit = value / Math.pow(10, Math.floor(Math.log10(value)))
      return [1, 2, 5].includes(firstDigit)
    })
  }

  getLabelForValue(value: number): string {
    return super.getLabelForValue(value) + 'Hz'
  }

  static formatLabel(label: string): string {
    return label.length > 0 ? label + 'Hz' : ''
  }

  /**
   * Generate a set of Linear ticks
   * @param generationOptions the options used to generate the ticks
   * @param dataRange the range of the data
   * @returns {object[]} array of tick objects
   */
  generateTicks(
    generationOptions: MinMaxRange,
    dataRange: MinMaxRange
  ): Tick[] {
    const endExp = Math.floor(Math.log10(dataRange.max))
    const endSignificand = Math.ceil(dataRange.max / Math.pow(10, endExp))

    const ticks: Tick[] = []

    const firstTick = generationOptions.min
    ticks.push({ value: firstTick, major: true })

    let tickVal = finiteOrDefault(
      generationOptions.min,
      Math.pow(10, Math.floor(Math.log10(dataRange.min)))
    )

    let exp = Math.floor(Math.log10(tickVal))
    if (this.height < 200) {
      exp = Math.max(exp, 3)
    }
    if (this.height < 500) {
      exp = Math.max(exp, 2)
    }
    let significand = Math.floor(tickVal / Math.pow(10, exp)) + 1
    let precision = exp < 0 ? Math.pow(10, Math.abs(exp)) : 1

    do {
      tickVal =
        Math.round(significand * Math.pow(10, exp) * precision) / precision
      ticks.push({ value: tickVal, major: isMajor(tickVal) })

      ++significand
      if (significand === 10) {
        significand = 1
        ++exp
        precision = exp >= 0 ? 1 : precision
      }
    } while (exp < endExp || (exp === endExp && significand < endSignificand))

    const lastTick = generationOptions.max
    ticks.push({ value: lastTick, major: true })

    return ticks
  }
}

MelFrequencyScale.id = 'mel'
MelFrequencyScale.defaults = {
  min: 20,
  max: 8000,
  melBreakFrequency: MelScaleHelper.GANSYNTH_MEL_BREAK_FREQUENCY_HERTZ,
  ticks: {
    callback: function (
      this: MelFrequencyScale,
      value: number,
      index: number,
      ticks: Tick[]
    ): string {
      return MelFrequencyScale.formatLabel(
        Ticks.formatters.numeric.bind(this)(value, index, ticks)
      )
    },
    major: {
      enabled: true,
    },
    includeBounds: true,
  },
}

declare module 'chart.js' {
  interface CartesianScaleTypeRegistry {
    mel: {
      options: MelScaleOptions
    }
  }
}
