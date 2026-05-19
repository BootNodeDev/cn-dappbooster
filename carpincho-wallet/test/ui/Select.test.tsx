import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Select, SelectItem } from '@/components/ui/Select.tsx'

type Option = { id: string; label: string }

const OPTIONS: Option[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
]

const SelectHarness = ({
  initial = '',
  onChange,
}: {
  initial?: string
  onChange?: (value: string) => void
}): JSX.Element => {
  const [value, setValue] = useState(initial)
  return (
    <Select
      id="test-select"
      placeholder="Pick one"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    >
      {OPTIONS.map((o) => (
        <SelectItem
          key={o.id}
          value={o.id}
        >
          {o.label}
        </SelectItem>
      ))}
    </Select>
  )
}

describe('Select (Radix)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a placeholder trigger with combobox role', () => {
    render(<SelectHarness />)
    const trigger = screen.getByRole('combobox')
    assert.ok(trigger)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  })

  it('opens, navigates by keyboard, and selects with Enter', async () => {
    const seen: string[] = []
    const user = userEvent.setup()
    render(<SelectHarness onChange={(v) => seen.push(v)} />)

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    const listbox = await screen.findByRole('listbox')
    assert.ok(listbox)

    await user.keyboard('{ArrowDown}{Enter}')

    assert.deepEqual(seen, ['two'])
    assert.equal(trigger.textContent?.includes('Two'), true)
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<SelectHarness initial="one" />)

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')

    assert.equal(screen.queryByRole('listbox'), null)
    assert.equal(document.activeElement, trigger)
  })
})
