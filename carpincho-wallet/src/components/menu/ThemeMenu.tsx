import { OptionList } from '@/components/ui/OptionList'
import type { ThemeMode } from '@/theme/ThemeContext'
import { useTheme } from '@/theme/useTheme'

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const ThemeMenu = (): JSX.Element => {
  const { mode, setMode } = useTheme()
  return (
    <OptionList
      options={THEME_OPTIONS}
      value={mode}
      onSelect={setMode}
    />
  )
}
