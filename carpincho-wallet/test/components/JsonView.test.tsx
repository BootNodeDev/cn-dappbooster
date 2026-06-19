import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { JsonView } from '@/components/ui/JsonView'

describe('JsonView', () => {
  afterEach(cleanup)

  it('renders object keys and values', () => {
    render(<JsonView value={{ admin: 'alice::party' }} />)
    // key renders in .w-rjv-object-key; value renders in .w-rjv-value — both are leaf spans
    assert.ok(screen.getByText(/admin/))
    assert.ok(
      screen.getAllByText((_t, node) => node?.textContent?.includes('alice::party') ?? false)
        .length > 0,
    )
  })
})
