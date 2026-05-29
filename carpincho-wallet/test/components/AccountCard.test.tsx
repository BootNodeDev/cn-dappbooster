import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountCard } from '@/components/AccountCard.tsx'
import { shortMiddle } from '@/utils/account.ts'
import type { AccountPublic } from '@/vault/types.ts'

// Test fixture: a primary account with a long party id exercises the same compact summary row used
// in the wallet popup while keeping the selected account deterministic for the dropdown menu.
const PRIMARY_ACCOUNT: AccountPublic = {
  id: 'primary-account',
  name: 'Primary Account',
  partyId: 'party-primary-1234567890abcdef',
  publicKeyBase64: 'primary-public-key',
  network: 'localnet',
  isPrimary: true,
  createdAt: 1,
}

// Test fixture: a secondary account proves the dropdown renders the full account list, not only the
// active account, while sharing the same measured menu width contract.
const SECONDARY_ACCOUNT: AccountPublic = {
  id: 'secondary-account',
  name: 'Secondary Account',
  partyId: 'party-secondary-1234567890abcdef',
  publicKeyBase64: 'secondary-public-key',
  network: 'localnet',
  isPrimary: false,
  createdAt: 2,
}

// Test fixture: this width represents the rendered account section in the popup. The dropdown should
// copy this number exactly so its border aligns with the account card edges.
const ACCOUNT_SECTION_WIDTH = 348
const ACCOUNT_SECTION_RIGHT = 400
const ACCOUNT_MENU_TRIGGER_RIGHT = 390

const originalResizeObserver = globalThis.ResizeObserver
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

class ImmediateResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback

  // Stores the callback Radix-era component code relies on so the test can synchronously report the
  // account section width without depending on browser layout support in happy-dom.
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  // Reports the observed element as having the account section width. The component should consume
  // that measurement and pass it to the portaled dropdown content.
  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: { width: ACCOUNT_SECTION_WIDTH },
        } as ResizeObserverEntry,
      ],
      this,
    )
  }

  // The component disconnects during cleanup; no observed state is retained by this test observer.
  disconnect(): void {}

  // The component does not call unobserve today, but the ResizeObserver interface requires it.
  unobserve(): void {}
}

// Test helper: installs deterministic layout measurements so Radix can render the portaled menu as
// if the wallet popup had a real card width and a caret inset from the card edge.
const installAccountLayoutShims = (): void => {
  globalThis.ResizeObserver = ImmediateResizeObserver
  HTMLElement.prototype.getBoundingClientRect = function () {
    const element = this as HTMLElement
    const isAccountMenuTrigger = element.dataset.testid === 'home-active-account'
    const width = isAccountMenuTrigger ? 32 : ACCOUNT_SECTION_WIDTH
    const right = isAccountMenuTrigger ? ACCOUNT_MENU_TRIGGER_RIGHT : ACCOUNT_SECTION_RIGHT
    const left = right - width

    return {
      width,
      height: isAccountMenuTrigger ? 32 : 96,
      top: 0,
      right,
      bottom: isAccountMenuTrigger ? 32 : 96,
      left,
      x: left,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
}

describe('AccountCard account menu layout', () => {
  // Scenario group: the current account card controls a portaled menu, so menu width must be driven
  // by the card measurement rather than by the small caret trigger button.
  afterEach(() => {
    // Cleanup restores the DOM and browser layout shims so other component tests see their defaults.
    cleanup()
    globalThis.ResizeObserver = originalResizeObserver
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  })

  // Scenario: the user opens the account dropdown from the caret on a rendered account card; the
  // expected result is a menu whose inline width matches the full account section width.
  it('sizes the account menu to match the current account section', async () => {
    const user = userEvent.setup()

    // Setup: happy-dom has no real layout, so the account card reports a known popup-width
    // measurement through both ResizeObserver and getBoundingClientRect.
    installAccountLayoutShims()

    // Setup: the rendered card has a primary account plus another selectable account so the menu has
    // real account rows and the Add account action in the same layout as production.
    render(
      <AccountCard
        primary={PRIMARY_ACCOUNT}
        accountsSorted={[PRIMARY_ACCOUNT, SECONDARY_ACCOUNT]}
        onSelectAccount={() => undefined}
        onAddAccount={() => undefined}
        onCopyPartyId={() => undefined}
      />,
    )

    // Action: opening the caret menu should render the Radix dropdown content into the portal.
    await user.click(screen.getByRole('button', { name: /open account menu/i }))

    // Assertion: the menu uses the measured account section width, not the default fixed menu width.
    const menu = await screen.findByRole('menu')
    assert.equal((menu as HTMLElement).style.width, `${ACCOUNT_SECTION_WIDTH}px`)
  })

  // Scenario: the opened account menu should reuse the same visual row contract as the active account
  // summary: avatar, shortened party id, and an explicit copy action for each account.
  it('renders menu accounts with reusable party-id rows and per-account copy buttons', async () => {
    const selectedAccountIds: string[] = []
    const copiedPartyIds: string[] = []
    const user = userEvent.setup()

    // Setup: the same layout shims keep this behavioral test focused on rendered account rows rather
    // than happy-dom geometry limitations.
    installAccountLayoutShims()

    // Setup: callbacks record whether the user copied a party id or selected a different account.
    render(
      <AccountCard
        primary={PRIMARY_ACCOUNT}
        accountsSorted={[PRIMARY_ACCOUNT, SECONDARY_ACCOUNT]}
        onSelectAccount={(id) => selectedAccountIds.push(id)}
        onAddAccount={() => undefined}
        onCopyPartyId={(partyId) => copiedPartyIds.push(partyId)}
      />,
    )

    // Action: opening the menu should render all accounts with the same party-id row shape.
    await user.click(screen.getByRole('button', { name: /open account menu/i }))

    const menu = await screen.findByRole('menu')
    const menuCopyButtons = within(menu).getAllByRole('button', { name: /copy party id/i })

    // Assertion: account names are no longer the visible row label; party ids are the stable account
    // identifier shown in both the active account row and menu rows.
    assert.equal(screen.queryByText('Secondary Account'), null)
    assert.ok((menu.textContent ?? '').includes(shortMiddle(PRIMARY_ACCOUNT.partyId, 12, 7)))
    assert.ok((menu.textContent ?? '').includes(shortMiddle(SECONDARY_ACCOUNT.partyId, 12, 7)))
    assert.equal(menuCopyButtons.length, 2)

    // Action: copying from a menu row should copy that account's party id without selecting it.
    await user.click(menuCopyButtons[1])

    // Assertion: copy is an independent row action, while selecting remains bound to the menu row.
    assert.deepEqual(copiedPartyIds, [SECONDARY_ACCOUNT.partyId])
    assert.deepEqual(selectedAccountIds, [])
  })

  // Scenario: the caret icon is the user's visual state indicator for the account menu, so it needs
  // to point right while closed and down while the menu is open.
  it('rotates the account menu caret when the menu opens and closes', async () => {
    const user = userEvent.setup()

    // Setup: layout shims let Radix open and close the portaled menu consistently in happy-dom.
    installAccountLayoutShims()

    // Setup: a regular account card exposes the caret trigger beside the active account row.
    render(
      <AccountCard
        primary={PRIMARY_ACCOUNT}
        accountsSorted={[PRIMARY_ACCOUNT, SECONDARY_ACCOUNT]}
        onSelectAccount={() => undefined}
        onAddAccount={() => undefined}
        onCopyPartyId={() => undefined}
      />,
    )

    const trigger = screen.getByRole('button', { name: /open account menu/i })
    const caret = screen.getByTestId('account-menu-caret')

    // Assertion: the closed menu starts with the right-facing caret state.
    assert.match(caret.className, /rotate-\[-45deg\]/)

    // Action: opening the menu should update the visual state indicator immediately.
    await user.click(trigger)
    await screen.findByRole('menu')

    // Assertion: the open menu uses the down-facing caret state.
    assert.match(caret.className, /rotate-45/)

    // Action: closing via Escape should restore the closed visual state.
    await user.keyboard('{Escape}')

    // Assertion: after close, the caret returns to the right-facing state.
    assert.equal(screen.queryByRole('menu'), null)
    assert.match(caret.className, /rotate-\[-45deg\]/)
  })
})
