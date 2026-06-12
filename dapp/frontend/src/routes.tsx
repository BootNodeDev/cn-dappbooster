import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { CreateGrantPage } from '@/features/create/CreateGrantPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { GrantDetailPage } from '@/features/grant-detail/GrantDetailPage'

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
