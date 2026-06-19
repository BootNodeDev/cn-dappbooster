import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailRow } from '@/components/ui/DetailRow'
import { TooltipProvider } from '@/components/ui/Tooltip'

describe('DetailRow', () => {
  afterEach(cleanup)

  it('shows a copy button only when copyLabel is set', () => {
    const { rerender } = render(
      <TooltipProvider>
        <dl>
          <DetailRow
            label="party"
            value="alice::party"
          />
        </dl>
      </TooltipProvider>,
    )
    assert.equal(screen.queryByRole('button', { name: /Copy/i }), null)

    rerender(
      <TooltipProvider>
        <dl>
          <DetailRow
            label="party"
            value="alice::party"
            copyLabel="party ID"
          />
        </dl>
      </TooltipProvider>,
    )
    assert.ok(screen.getByRole('button', { name: 'Copy party ID' }))
  })
})
