import type { MenuListRow, Screen } from '@/components/menu/screens.ts'
import { MenuRow } from '@/components/ui/MenuRow.tsx'

export const MENU_LIST_CLASS = 'flex flex-col gap-2 list-none m-0 p-0'

interface MenuListProps {
  rows: MenuListRow[]
  onNavigate: (screen: Screen) => void
  onLogout: () => void
}

export const MenuList = ({ rows, onNavigate, onLogout }: MenuListProps): JSX.Element => (
  <ul className={MENU_LIST_CLASS}>
    {rows.map(({ label, to, tone }) => (
      <MenuRow
        key={label}
        label={label}
        tone={tone}
        onClick={to === 'logout' ? onLogout : () => onNavigate(to)}
      />
    ))}
  </ul>
)
