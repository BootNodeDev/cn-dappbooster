import { createFileRoute } from '@tanstack/react-router'
import { TradeView } from '@/features/trade/TradeView'

export const Route = createFileRoute('/')({ component: TradeView })
