import type { ReactNode } from 'react'
import { WALLET_CONNECT_ICON } from '@/components/ui/icons'

export type Screen =
  | 'root'
  | 'wallet-connect'
  | 'settings'
  | 'theme'
  | 'security'
  | 'password'
  | 'auto-lock'
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
  'wallet-connect': {
    title: 'WalletConnect',
    description: 'Paste a WalletConnect URI to connect a dApp.',
    parent: 'root',
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
  to: Screen | 'logout'
  tone?: 'danger'
  icon?: ReactNode
}

// Leaf screens (theme, password, auto-lock) render dedicated components and are absent here.
export const MENU_LISTS: Partial<Record<Screen, MenuListRow[]>> = {
  root: [
    { label: 'WalletConnect', to: 'wallet-connect', icon: WALLET_CONNECT_ICON },
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
