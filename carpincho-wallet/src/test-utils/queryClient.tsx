import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Creates an isolated query cache so tests cannot share CIP-56 server state.
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })

// Wraps a test subtree in a fresh TanStack Query provider.
export const TestQueryClientProvider = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)
