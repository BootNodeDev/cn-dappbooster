import type { ReactNode } from 'react'
import { WALLET_CONNECT_ICON } from '@/components/ui/icons'

export type Screen =
  | 'root'
  | 'wallet-connect'
  | 'settings'
  | 'import-private-key'
  | 'export-private-key'
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
    description: 'Theme, security, and account key preferences.',
    parent: 'root',
  },
  'import-private-key': {
    title: 'Import private key',
    description: 'Import an existing Canton party into this vault.',
    parent: 'settings',
  },
  'export-private-key': {
    title: 'Export private key',
    description: 'Reveal the selected party private key.',
    parent: 'settings',
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
    { label: 'Import private key', to: 'import-private-key' },
    { label: 'Export private key', to: 'export-private-key' },
  ],
  security: [
    { label: 'Password', to: 'password' },
    { label: 'Auto-lock', to: 'auto-lock' },
  ],
}
