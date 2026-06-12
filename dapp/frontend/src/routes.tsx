import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'

// Route-level code splitting: each page is its own chunk so the initial bundle
// (and framer-motion pulled in by the dashboard) is not paid for upfront. AppShell
// wraps <Outlet> in <Suspense>, so a chunk load shows the full-screen spinner.
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const CreateGrantPage = lazy(() =>
  import('@/features/create/CreateGrantPage').then((m) => ({ default: m.CreateGrantPage })),
)
const GrantDetailPage = lazy(() =>
  import('@/features/grant-detail/GrantDetailPage').then((m) => ({ default: m.GrantDetailPage })),
)

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'create', element: <CreateGrantPage /> },
      { path: 'grants/:id', element: <GrantDetailPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]
