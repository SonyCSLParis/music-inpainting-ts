import { getPathToStaticFile } from './staticPath'
import * as ControlLabels from './controlLabels'
import { CycleSelect } from './cycleSelect'
import { SheetLocator } from './locator'

const availableGranularityIcons = new Map([
  [1, 'quarter-note.svg'],
  [2, 'half-note.svg'],
  [4, 'whole.svg'],
  [8, 'whole-two.png'],
  [12, 'whole-three.png'],
  [16, 'whole-four.png'],
])

function makeGranularityIconsList(
  granularities_quarters: number[]
): Map<number, string> {
  const granularitiesIcons = new Map<number, string>()
  const sortedGranularities = granularities_quarters.sort()

  for (
    let granularity_index = 0, num_granularities = sortedGranularities.length;
    granularity_index < num_granularities;
    granularity_index++
  ) {
    const granularity = sortedGranularities[granularity_index]
    const iconName = availableGranularityIcons.has(granularity)
      ? availableGranularityIcons.get(granularity)
      : // TODO create better icon for unusual duration or simply use HTMLContent in button?
        'whole.svg'

    granularitiesIcons.set(granularity, iconName)
  }

  return granularitiesIcons
}

// Time-granularity selector
export function renderGranularitySelect(
  containerElement: HTMLElement,
  granularities_quarters: number[]
): CycleSelect<number> {
  const iconsBasePath: string = getPathToStaticFile('icons')
  const granularityIcons = makeGranularityIconsList(granularities_quarters)

  const granularitySelectContainerElement = document.createElement('div')
  granularitySelectContainerElement.classList.add('control-item')
  granularitySelectContainerElement.id = 'granularity-select-container'
  containerElement.appendChild(granularitySelectContainerElement)

  ControlLabels.createLabel(
    granularitySelectContainerElement,
    'granularity-select-label',
    false,
    undefined,
    containerElement
  )

  function granularityOnChange(this: CycleSelect<string>) {
    const duration_quarters: number = parseInt(this.value)
    const durationCSSClass: string = SheetLocator.makeGranularityCSSClass(
      duration_quarters
    )
    $('.notebox').removeClass('active')
    $('.' + durationCSSClass + '> .notebox').addClass('active')
  }

  const granularitySelect = new CycleSelect(
    granularitySelectContainerElement,
    granularityOnChange,
    granularityIcons,
    iconsBasePath
  )
  return granularitySelect
}
