export type Screen = 'root' | 'settings' | 'theme' | 'security' | 'password' | 'auto-lock'
export type Direction = 'forward' | 'back'

interface ScreenConfig {
  title: string
  description: string
  parent: Screen | null
}

export const SCREENS: Record<Screen, ScreenConfig> = {
  root: {
    title: 'Menu',
    description: 'Wallet menu.',
    parent: null,
  },
  settings: {
    title: 'Settings',
    description: 'Theme and security preferences.',
    parent: 'root',
  },
  theme: {
    title: 'Theme',
    description: 'Choose light, dark, or follow the system setting.',
    parent: 'settings',
  },
  security: {
    title: 'Security & Password',
    description: 'Choose between password change and auto-lock configuration.',
    parent: 'settings',
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

export interface MenuListRow {
  label: string
  // A screen to drill into, or 'logout' for the one terminal action.
  to: Screen | 'logout'
  tone?: 'danger'
}

// Navigation-list screens. Leaf screens (theme, password, auto-lock) render a
// dedicated component instead and are absent from this map.
export const MENU_LISTS: Partial<Record<Screen, MenuListRow[]>> = {
  root: [
    { label: 'Settings', to: 'settings' },
    { label: 'Log out', to: 'logout', tone: 'danger' },
  ],
  settings: [
    { label: 'Theme', to: 'theme' },
    { label: 'Security & Password', to: 'security' },
  ],
  security: [
    { label: 'Password', to: 'password' },
    { label: 'Auto-lock', to: 'auto-lock' },
  ],
}
