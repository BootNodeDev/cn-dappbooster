import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type Item = { id: string; label: string }

const ITEMS: Item[] = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'bravo', label: 'Bravo' },
  { id: 'charlie', label: 'Charlie' },
]

const DropdownHarness = ({ onSelect }: { onSelect: (id: string) => void }): JSX.Element => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button type="button">Open menu</button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content>
        {ITEMS.map((i) => (
          <DropdownMenu.Item
            key={i.id}
            onSelect={() => onSelect(i.id)}
          >
            {i.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
)

describe('DropdownMenu (Radix)', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens on trigger click and renders items with menuitem role', async () => {
    const user = userEvent.setup()
    render(<DropdownHarness onSelect={() => {}} />)

    const trigger = screen.getByRole('button', { name: /open menu/i })
    await user.click(trigger)

    const menu = await screen.findByRole('menu')
    assert.ok(menu)
    const items = screen.getAllByRole('menuitem')
    assert.equal(items.length, 3)
    assert.equal(items[0].textContent, 'Alpha')
  })

  it('navigates with arrow keys and fires onSelect on Enter', async () => {
    const seen: string[] = []
    const user = userEvent.setup()
    render(<DropdownHarness onSelect={(id) => seen.push(id)} />)

    const trigger = screen.getByRole('button', { name: /open menu/i })
    await user.click(trigger)
    await screen.findByRole('menu')

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    assert.deepEqual(seen, ['bravo'])
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DropdownHarness onSelect={() => {}} />)

    const trigger = screen.getByRole('button', { name: /open menu/i })
    await user.click(trigger)
    await screen.findByRole('menu')

    await user.keyboard('{Escape}')

    assert.equal(screen.queryByRole('menu'), null)
    assert.equal(document.activeElement, trigger)
  })
})
