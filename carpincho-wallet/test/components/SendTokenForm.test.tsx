import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import {
  type Cip56SendApi,
  SendTokenForm,
  transferDeadlineExpiration,
} from '@/components/SendTokenForm'
import { toast } from '@/components/ui/toast'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '12.5000000000',
  source: 'scan',
}

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

const renderForm = (sendApi: Cip56SendApi, onSent: () => void): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <SendTokenForm
        account={ACCOUNT}
        summary={SUMMARY}
        sendApi={sendApi}
        onSent={onSent}
      />
    </VaultContext.Provider>,
  )
}

describe('SendTokenForm', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('submits a transfer for the preset token without a token field', async () => {
    // Scenario: the token is already chosen by the detail modal, so the form drops
    // the token dropdown and sends against the passed-in instrument id.
    const sent: Parameters<Cip56SendApi['createTokenTransfer']>[0][] = []
    let sentCount = 0
    const sendApi: Cip56SendApi = {
      createTokenTransfer: async (params) => {
        sent.push(params)
        return { updateId: 'update-transfer-1' }
      },
    }

    renderForm(sendApi, () => {
      sentCount += 1
    })

    assert.equal(screen.queryByLabelText('Token'), null)
    await userEvent.type(screen.getByLabelText('Recipient party'), 'receiver::party')
    await userEvent.type(screen.getByLabelText('Amount'), '7.5')
    await userEvent.type(screen.getByLabelText('Memo'), 'lunch')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await screen.findByText('Transfer submitted.')
    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.account.partyId, 'alice::party')
    assert.equal(sent[0]?.recipient, 'receiver::party')
    assert.equal(sent[0]?.amount, '7.5')
    assert.deepEqual(sent[0]?.instrumentId, { admin: 'dso::party', id: 'Amulet' })
    assert.equal(sent[0]?.memo, 'lunch')
    assert.equal(sentCount, 1)
  })

  it('computes calendar deadline expirations from the selected preset', () => {
    // Scenario: deadline presets must resolve to absolute ISO timestamps using
    // calendar arithmetic for month/year.
    const now = new Date('2026-06-10T12:00:00.000Z')

    assert.equal(transferDeadlineExpiration('1h', now).toISOString(), '2026-06-10T13:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1d', now).toISOString(), '2026-06-11T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1w', now).toISOString(), '2026-06-17T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1m', now).toISOString(), '2026-07-10T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1y', now).toISOString(), '2027-06-10T12:00:00.000Z')
  })
})
