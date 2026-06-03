import { cn } from '@/utils/cn'

export const MENU_ROW_BASE_CLASS =
  'w-full px-4 py-3 rounded-lg bg-surface border border-border ' +
  'hover:border-border-strong focus-visible:outline-none focus-visible:shadow-focus'

interface MenuRowProps {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

export const MenuRow = ({ label, onClick, tone = 'default' }: MenuRowProps): JSX.Element => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className={cn(
        MENU_ROW_BASE_CLASS,
        'text-left',
        tone === 'danger' && 'text-danger hover:border-danger',
      )}
    >
      {label}
    </button>
  </li>
)
