import { ConnectKitProvider } from 'canton-connect-kit'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/toast'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { connectKitConfig } from '@/wallet/ConnectKitConfig'
import { VestingDataProvider } from '@/wallet/VestingDataProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export const App = (): React.JSX.Element => (
  <ThemeProvider>
    <ConnectKitProvider config={connectKitConfig}>
      <VestingDataProvider>
        <RouterProvider router={router} />
        <Toaster />
      </VestingDataProvider>
    </ConnectKitProvider>
  </ThemeProvider>
)
