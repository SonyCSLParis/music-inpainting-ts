// Code for the melodic LFO function
// Create LFO controls and map them to trigger periodic regenerations server-side

import * as Nexus from 'nexusui'

export function createLFOControls(): void {
  const LFOControlsGridElement: HTMLDivElement = document.createElement('div')
  LFOControlsGridElement.id = 'lfo-controls'
  document.body.appendChild(LFOControlsGridElement)

  const LFOToggleElement: HTMLElement = document.createElement('div')
  LFOToggleElement.id = 'LFO-toggle'
  LFOControlsGridElement.appendChild(LFOToggleElement)

  const LFORateElement: HTMLElement = document.createElement('div')
  LFORateElement.id = 'LFO-rate'
  LFOControlsGridElement.appendChild(LFORateElement)

  const LFOValueElement: HTMLElement = document.createElement('div')
  LFOValueElement.id = 'LFO-value'
  LFOControlsGridElement.appendChild(LFOValueElement)

  const lfoToggle = new Nexus.Toggle('#LFO-toggle', {
    size: [40, 20],
    state: false,
  })
  let useLFO = false
  lfoToggle.on('change', (toggleOn) => {
    useLFO = toggleOn
  })

  LFOToggleElement.style.setProperty('width', '100%')
  LFOToggleElement.style.setProperty('padding-top', '30px')

  const LFONameElement = document.createElement('div')
  LFONameElement.textContent = 'Improvizer'
  LFOToggleElement.appendChild(LFONameElement)
  LFONameElement.style.setProperty('padding-top', '25px')

  const lfoRateDial = new Nexus.Dial('#LFO-rate', {
    interaction: 'vertical',
  })
  const LFORateNameElement = document.createElement('div')
  LFORateNameElement.textContent = 'Rate'
  LFORateElement.appendChild(LFORateNameElement)

  const lfoValueDial = new Nexus.Dial('#LFO-value', {
    interaction: 'vertical',
  })
  const LFOValueNameElement = document.createElement('div')
  LFOValueNameElement.textContent = 'Value'
  LFOValueElement.appendChild(LFOValueNameElement)
}

function triggerRegeneration(): void {
  throw Error('Not implemented')
}
