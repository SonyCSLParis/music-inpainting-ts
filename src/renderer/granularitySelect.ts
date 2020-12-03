import * as path from 'path';

import { static_correct} from './staticPath';
import * as ControlLabels from './controlLabels';
import { CycleSelect } from './cycleSelect';
import { SheetLocator } from './locator';

let availableGranularityIcons = new Map([
    ["1", 'quarter-note.svg'],
    ["2", 'half-note.svg'],
    ["4", 'whole.svg'],
    ["8", 'whole-two.png'],
    ["12", 'whole-three.png'],
    ["16", 'whole-four.png'],
])

function makeGranularityIconsList(granularities_quarters: string[]): Map<string, string> {
    let granularitiesIcons = new Map();
    const sortedGranularities = granularities_quarters.sort();

    for (let granularity_index=0, num_granularities=sortedGranularities.length;
        granularity_index<num_granularities; granularity_index++
    ) {
        const granularity = sortedGranularities[granularity_index];
        let iconName = (availableGranularityIcons.has(granularity)?
            availableGranularityIcons.get(granularity) :
            // TODO create better icon for unusual duration or simply use HTMLContent in button?
            'whole.svg');

        granularitiesIcons.set(granularity, iconName);
    };

    return granularitiesIcons;
}

// Time-granularity selector
export function renderGranularitySelect(containerElement: HTMLElement,
    granularities_quarters: string[]): void {
    let iconsBasePath: string = path.join(static_correct, 'icons');
    let granularityIcons = makeGranularityIconsList(granularities_quarters)

    let granularitySelectContainerElem: HTMLElement = document.createElement('control-item');
    granularitySelectContainerElem.id = 'granularity-select-container';
    containerElement.appendChild(granularitySelectContainerElem);

    ControlLabels.createLabel(granularitySelectContainerElem,
        'granularity-select-label');

    function granularityOnChange(ev) {
        const duration_quarters: number = parseInt(this.value);
        const durationCSSClass: string = SheetLocator.makeGranularityCSSClass(duration_quarters);
        $('.notebox').removeClass('active');
        $('.' + durationCSSClass + '> .notebox').addClass('active');
    };

    let granularitySelect = new CycleSelect(granularitySelectContainerElem,
        'granularity-select',
        {handleEvent: granularityOnChange},
        granularityIcons,
        iconsBasePath
    );

    granularitySelect.value = granularities_quarters[0];
};
