import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react'
import { MockDarkPoolClient } from './client/MockDarkPoolClient'
import { startSimEngine } from './client/simEngine'
import type { DarkPoolClient } from './types'

const DarkPoolContext = createContext<DarkPoolClient | null>(null)

export const DarkPoolProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const ref = useRef<MockDarkPoolClient>()
  // Pass a truthy seed so the mock uses real wall-clock timestamps in the app
  // (tests pass 0 for a deterministic incrementing clock).
  if (!ref.current) ref.current = new MockDarkPoolClient(1)
  useEffect(() => startSimEngine(ref.current as MockDarkPoolClient), [])
  return <DarkPoolContext.Provider value={ref.current}>{children}</DarkPoolContext.Provider>
}

export const useDarkPoolClient = (): DarkPoolClient => {
  const client = useContext(DarkPoolContext)
  if (!client) throw new Error('useDarkPoolClient must be used within DarkPoolProvider')
  return client
}
