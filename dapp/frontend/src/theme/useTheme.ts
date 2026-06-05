import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from '@/theme/ThemeContext'

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return ctx
}
