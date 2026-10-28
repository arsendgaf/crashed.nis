import { Outlet, useLocation } from 'react-router'
import Providers from '@/lib/providers/index.tsx'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function AppLayout() {
  return (
    <Providers>
      <RouteOutlet />
    </Providers>
  )
}

function RouteOutlet() {
  const { pathname } = useLocation()
  const dashboardRoutes = new Set<string>(['/', '/reports', '/settings', '/predict'])

  return dashboardRoutes.has(pathname) ? <DashboardLayout /> : <Outlet />
}
