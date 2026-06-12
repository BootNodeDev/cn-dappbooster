import { create } from 'zustand'

export type DashboardView = 'cards' | 'table'

interface UiState {
  dashboardView: DashboardView
  setDashboardView: (view: DashboardView) => void
}

export const useUiStore = create<UiState>((set) => ({
  dashboardView: 'cards',
  setDashboardView: (dashboardView) => set({ dashboardView }),
}))
