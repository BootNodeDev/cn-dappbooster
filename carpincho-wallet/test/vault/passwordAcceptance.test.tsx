import { strict as assert } from 'node:assert'
import { afterEach, test } from 'node:test'
import { cleanup, render, waitFor } from '@testing-library/react'
import { isPasswordAcceptable, usePasswordStrengthReady } from '@/vault/passwordStrength'

const Probe = (): JSX.Element => (
  <span data-testid="ready">{usePasswordStrengthReady() ? 'ready' : 'loading'}</span>
)

afterEach(() => {
  cleanup()
})

test('rejects weak passwords and accepts strong ones at the default score', async () => {
  const { getByTestId } = render(<Probe />)
  await waitFor(() => assert.equal(getByTestId('ready').textContent, 'ready'))
  // Default minimum is now zxcvbn 3 (fail closed): a guessable password is rejected.
  assert.equal(isPasswordAcceptable('monkey99'), false)
  // A strong passphrase clears the bar regardless of length.
  assert.equal(isPasswordAcceptable('correct-horse-battery'), true)
})
