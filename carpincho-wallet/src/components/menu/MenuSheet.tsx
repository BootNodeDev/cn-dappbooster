import { useEffect, useRef, useState } from 'react'
import { MenuList } from '@/components/menu/MenuList.tsx'
import { type Direction, MENU_LISTS, SCREENS, type Screen } from '@/components/menu/screens.ts'
import { ThemeMenu } from '@/components/menu/ThemeMenu.tsx'
import { AutoLockList, PasswordForm } from '@/components/SecurityPanel.tsx'
import { Sheet } from '@/components/ui/Sheet.tsx'
import { useVault } from '@/vault/useVault.ts'

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
  const list = MENU_LISTS[screen]
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
        {list !== undefined && (
          <MenuList
            rows={list}
            onNavigate={goTo}
            onLogout={onLogout}
          />
        )}
        {screen === 'theme' && <ThemeMenu />}
        {screen === 'password' && <PasswordForm />}
        {screen === 'auto-lock' && <AutoLockList />}
      </div>
    </Sheet>
  )
}
