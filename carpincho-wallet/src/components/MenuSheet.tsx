import { useEffect, useRef, useState } from 'react'
import { AutoLockList, PasswordForm } from '@/components/SecurityPanel.tsx'
import { MenuRow } from '@/components/ui/MenuRow.tsx'
import { Sheet } from '@/components/ui/Sheet.tsx'
import { useVault } from '@/vault/useVault.ts'

type Screen = 'root' | 'security' | 'password' | 'auto-lock'
type Direction = 'forward' | 'back'

interface ScreenConfig {
  title: string
  description: string
  parent: Screen | null
}

const SCREENS: Record<Screen, ScreenConfig> = {
  root: {
    title: 'Menu',
    description: 'Wallet menu.',
    parent: null,
  },
  security: {
    title: 'Security & Password',
    description: 'Choose between password change and auto-lock configuration.',
    parent: 'root',
  },
  password: {
    title: 'Password',
    description: 'Verify the current password and set a new one.',
    parent: 'security',
  },
  'auto-lock': {
    title: 'Auto-lock',
    description: 'Choose how long the wallet stays unlocked while idle.',
    parent: 'security',
  },
}

const MENU_LIST_CLASS = 'flex flex-col gap-2 list-none m-0 p-0'

interface MenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const MenuSheet = ({ open, onOpenChange }: MenuSheetProps): JSX.Element => {
  const v = useVault()
  const [screen, setScreen] = useState<Screen>('root')
  const [direction, setDirection] = useState<Direction>('forward')
  const screenRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every screen change to refocus the new view.
  useEffect(() => {
    if (!open) return
    const root = screenRef.current
    if (root === null) return
    const target = root.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    )
    target?.focus()
  }, [open, screen])

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setScreen('root')
      setDirection('forward')
    }
    onOpenChange(next)
  }

  const goTo = (next: Screen): void => {
    setDirection('forward')
    setScreen(next)
  }

  const goBack = (): void => {
    const parent = SCREENS[screen].parent
    if (parent === null) return
    setDirection('back')
    setScreen(parent)
  }

  const onLogout = (): void => {
    v.lock()
    onOpenChange(false)
  }

  const config = SCREENS[screen]
  const animationClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      title={config.title}
      description={config.description}
      onBack={config.parent !== null ? goBack : undefined}
      side="right"
    >
      <div
        key={screen}
        ref={screenRef}
        className={animationClass}
      >
        {screen === 'root' && (
          <ul className={MENU_LIST_CLASS}>
            <MenuRow
              label="Security & Password"
              onClick={() => goTo('security')}
            />
            <MenuRow
              label="Log out"
              tone="danger"
              onClick={onLogout}
            />
          </ul>
        )}
        {screen === 'security' && (
          <ul className={MENU_LIST_CLASS}>
            <MenuRow
              label="Password"
              onClick={() => goTo('password')}
            />
            <MenuRow
              label="Auto-lock"
              onClick={() => goTo('auto-lock')}
            />
          </ul>
        )}
        {screen === 'password' && <PasswordForm />}
        {screen === 'auto-lock' && <AutoLockList />}
      </div>
    </Sheet>
  )
}
