import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { type Theme, ThemeContext } from '@/theme/ThemeContext.ts'

const STORAGE_KEY = 'carpincho-theme'

const readStoredTheme = (): Theme | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // ignore
  }
  return null
}

const readInitial = (): Theme => {
  const stored = readStoredTheme()
  if (stored) {
    return stored
  }
  if (typeof window === 'undefined') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [theme, setThemeState] = useState<Theme>(readInitial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void => {
      // Respect any explicit user choice that has been persisted.
      if (readStoredTheme() !== null) {
        return
      }
      setThemeState(e.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const persist = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore quota / privacy errors
    }
  }, [])

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next)
      persist(next)
    },
    [persist],
  )

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      persist(next)
      return next
    })
  }, [persist])

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
