import { ICON_BUTTON_CLASS, ROUND_ICON_BUTTON_CHROME } from '@/components/ui/Button.tsx'
import { useTheme } from '@/theme/useTheme.ts'
import { cn } from '@/utils/cn.ts'

const BUTTON_CLASS = cn(
  ICON_BUTTON_CLASS,
  ROUND_ICON_BUTTON_CHROME,
  'relative size-9 bg-surface/85 overflow-hidden',
)

const ICON_BASE =
  'absolute inset-0 m-auto transition-all duration-300 ease-out will-change-transform'

export const ThemeToggle = (): JSX.Element => {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      className={BUTTON_CLASS}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(
          ICON_BASE,
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75',
        )}
      >
        <circle
          cx="12"
          cy="12"
          r="4"
        />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m4.93 19.07 1.41-1.41" />
        <path d="m17.66 6.34 1.41-1.41" />
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(
          ICON_BASE,
          isDark ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100',
        )}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}
