// Code for the melodic LFO function
// Create LFO controls and map them to trigger periodic regenerations server-side

import Nexus from './nexusColored'

export function createLFOControls(): void {
  const LFOControlsGridElement = document.createElement('div')
  LFOControlsGridElement.id = 'lfo-controls'
  document.body.appendChild(LFOControlsGridElement)

  const LFOToggleElement = document.createElement('div')
  LFOControlsGridElement.appendChild(LFOToggleElement)

  const lfoToggle = new Nexus.Toggle(LFOToggleElement, {
    size: [40, 20],
    state: false,
  })
  let useLFO = false
  lfoToggle.on('change', (toggleOn: boolean) => {
    useLFO = toggleOn
  })

  LFOToggleElement.style.setProperty('width', '100%')
  LFOToggleElement.style.setProperty('padding-top', '30px')

  const LFONameElement = document.createElement('div')
  LFONameElement.textContent = 'Improvizer'
  LFOToggleElement.appendChild(LFONameElement)
  LFONameElement.style.setProperty('padding-top', '25px')

  const LFORateElement = document.createElement('div')
  LFOControlsGridElement.appendChild(LFORateElement)
  const lfoRateDial = new Nexus.Dial(LFORateElement, {
    interaction: 'vertical',
  })
  const LFORateNameElement = document.createElement('div')
  LFORateNameElement.textContent = 'Rate'
  LFORateElement.appendChild(LFORateNameElement)

  const LFOValueElement = document.createElement('div')
  LFOControlsGridElement.appendChild(LFOValueElement)
  const lfoValueDial = new Nexus.Dial(LFOValueElement, {
    interaction: 'vertical',
  })
  const LFOValueNameElement = document.createElement('div')
  LFOValueNameElement.textContent = 'Value'
  LFOValueElement.appendChild(LFOValueNameElement)
}

function triggerRegeneration(): void {
  throw Error('Not implemented')
}
