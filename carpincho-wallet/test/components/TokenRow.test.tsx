import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { TokenRow } from '@/components/TokenRow'

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '9997',
  utxoCount: 2,
  lockedCount: 0,
  unlockedCount: 2,
  source: 'utxos',
}

describe('TokenRow', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the token name and UTXO subtitle as an icon row with a chevron', () => {
    // Scenario: the assets list should read like an activity row, not a card with
    // an inline expander: token icon left, name + UTXO count center, chevron right.
    const { container } = render(
      <TokenRow
        summary={SUMMARY}
        onOpen={() => undefined}
      />,
    )

    assert.equal(screen.getByText('Amulet').textContent, 'Amulet')
    assert.equal(screen.getByText('2 UTXOs').textContent, '2 UTXOs')
    assert.ok(container.querySelector('img'), 'the row should show the token icon')
    assert.equal(screen.queryByRole('button', { name: /show holdings/i }), null)
  })

  it('singularises a lone UTXO and notes locked holdings', () => {
    // Scenario: subtitle pluralisation and the locked-count suffix carry over from
    // the old card so users keep that at-a-glance detail.
    render(
      <TokenRow
        summary={{ ...SUMMARY, utxoCount: 1, lockedCount: 1, unlockedCount: 0 }}
        onOpen={() => undefined}
      />,
    )

    assert.equal(screen.getByText('1 UTXO · 1 locked').textContent, '1 UTXO · 1 locked')
  })

  it('falls back to a load-on-demand subtitle when the count is unknown', () => {
    // Scenario: Scan summaries arrive without a UTXO count; the row must not render
    // "undefined UTXOs".
    render(
      <TokenRow
        summary={{ ...SUMMARY, utxoCount: undefined, lockedCount: undefined }}
        onOpen={() => undefined}
      />,
    )

    assert.equal(screen.getByText('UTXOs load on demand').textContent, 'UTXOs load on demand')
  })

  it('opens the token when the row is clicked', async () => {
    // Scenario: the whole row is the affordance that opens the token detail modal.
    let opened = 0
    render(
      <TokenRow
        summary={SUMMARY}
        onOpen={() => {
          opened += 1
        }}
      />,
    )

    await userEvent.click(screen.getByRole('button'))

    assert.equal(opened, 1)
  })
})
