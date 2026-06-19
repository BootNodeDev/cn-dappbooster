import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UtilDetail } from '@/components/utils/UtilDetail'

describe('UtilDetail', () => {
  afterEach(cleanup)

  it('shows the title and calls onBack when the back button is clicked', async () => {
    let backs = 0
    render(
      <UtilDetail
        title="Create contract"
        onBack={() => {
          backs += 1
        }}
      >
        <p>body</p>
      </UtilDetail>,
    )

    assert.ok(screen.getByText('Create contract'))
    assert.ok(screen.getByText('body'))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    assert.equal(backs, 1)
  })
})
