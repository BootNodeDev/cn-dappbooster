import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Stepper } from '@/components/ui/Stepper.tsx'

const STEPS = ['Create vault', 'Create account']

describe('Stepper', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders every step label', () => {
    render(
      <Stepper
        steps={STEPS}
        current={1}
      />,
    )
    assert.ok(screen.getByText('Create vault'))
    assert.ok(screen.getByText('Create account'))
  })

  it('marks the current step active and earlier steps complete', () => {
    render(
      <Stepper
        steps={STEPS}
        current={2}
      />,
    )
    assert.equal(screen.getByTestId('step-1').getAttribute('data-state'), 'complete')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'active')
    assert.equal(screen.getByTestId('step-2').getAttribute('aria-current'), 'step')
  })

  it('marks later steps upcoming and only the active step has aria-current', () => {
    render(
      <Stepper
        steps={STEPS}
        current={1}
      />,
    )
    assert.equal(screen.getByTestId('step-1').getAttribute('data-state'), 'active')
    assert.equal(screen.getByTestId('step-1').getAttribute('aria-current'), 'step')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'upcoming')
    assert.equal(screen.getByTestId('step-2').getAttribute('aria-current'), null)
  })
})
