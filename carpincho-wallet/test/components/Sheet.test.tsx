import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Sheet } from '@/components/ui/Sheet'

const renderSheet = (props: Partial<React.ComponentProps<typeof Sheet>> = {}): void => {
  render(
    <Sheet
      open={true}
      onOpenChange={() => undefined}
      title="Connection"
      description="Connection settings."
      {...props}
    >
      <div>body</div>
    </Sheet>,
  )
}

describe('Sheet', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the title visibly by default', () => {
    renderSheet()
    const title = screen.getByText('Connection')
    assert.doesNotMatch(title.className, /sr-only/)
  })

  it('keeps the title accessible but visually hidden when hideTitle is set', () => {
    renderSheet({ hideTitle: true })
    const title = screen.getByText('Connection')
    // Still in the accessibility tree (screen readers), just visually hidden.
    assert.match(title.className, /sr-only/)
  })

  it('applies a caller-supplied titleClassName', () => {
    renderSheet({ titleClassName: 'text-lg' })
    const title = screen.getByText('Connection')
    assert.match(title.className, /text-lg/)
  })
})
