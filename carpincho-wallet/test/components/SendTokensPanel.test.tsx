import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  type Cip56SendApi,
  SendTokensPanel,
  transferDeadlineExpiration,
} from '@/components/SendTokensPanel'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active self-custodial party that sends tokens.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

// Builds the minimum unlocked vault context required by the send panel.
const baseVault = (): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: () => undefined,
    accounts: [ACCOUNT],
    primary: ACCOUNT,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ACCOUNT,
    removeAccount: async () => undefined,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
    changePassword: async () => undefined,
    verifyPassword: () => true,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

// Mounts the send panel with injectable APIs so the test observes only UI intent.
const renderSendTokens = (holdingsApi: Cip56HoldingsApi, sendApi: Cip56SendApi): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <SendTokensPanel
        holdingsApi={holdingsApi}
        sendApi={sendApi}
      />
    </VaultContext.Provider>,
  )
}

describe('SendTokensPanel', () => {
  afterEach(() => {
    // The send panel polls holdings through a hook; cleanup stops the poller between scenarios.
    cleanup()
  })

  it('submits a transfer for the selected token with recipient, amount, memo, and deadline', async () => {
    // Scenario: Alice has one Amulet holding and wants to create an outgoing
    // transfer request. The panel should derive the sender from the active
    // account, default the deadline to 1h, and pass the selected instrument id.
    const sent: Parameters<Cip56SendApi['createTokenTransfer']>[0][] = []
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldings: async () => [
        {
          contractId: 'holding-cid-1',
          interfaceViewValue: {
            owner: 'alice::party',
            amount: '12.5000000000',
            instrumentId: { admin: 'dso::party', id: 'Amulet' },
            lock: null,
          },
        },
      ],
    }
    const sendApi: Cip56SendApi = {
      createTokenTransfer: async (params) => {
        sent.push(params)
        return { updateId: 'update-transfer-1' }
      },
    }

    renderSendTokens(holdingsApi, sendApi)

    await screen.findByRole('option', { name: /Amulet/ })
    await userEvent.type(screen.getByLabelText('Recipient party'), 'receiver::party')
    await userEvent.type(screen.getByLabelText('Amount'), '7.5')
    await userEvent.type(screen.getByLabelText('Memo'), 'lunch')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.account.partyId, 'alice::party')
    assert.equal(sent[0]?.recipient, 'receiver::party')
    assert.equal(sent[0]?.amount, '7.5')
    assert.deepEqual(sent[0]?.instrumentId, { admin: 'dso::party', id: 'Amulet' })
    assert.equal(sent[0]?.memo, 'lunch')
    assert.equal(typeof sent[0]?.expirationDate, 'string')
    assert.equal(
      await screen.findByText('Transfer submitted.'),
      screen.getByText('Transfer submitted.'),
    )
  })

  it('computes calendar deadline expirations from the selected preset', () => {
    // Scenario: deadline options are user-facing presets, but the transfer
    // command needs an absolute ISO timestamp. Month/year options must use
    // calendar arithmetic instead of fixed day counts.
    const now = new Date('2026-06-10T12:00:00.000Z')

    assert.equal(transferDeadlineExpiration('1h', now).toISOString(), '2026-06-10T13:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1d', now).toISOString(), '2026-06-11T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1w', now).toISOString(), '2026-06-17T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1m', now).toISOString(), '2026-07-10T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1y', now).toISOString(), '2027-06-10T12:00:00.000Z')
  })
})
