import { createFileRoute } from '@tanstack/react-router'
import { VenueView } from '@/features/venue/VenueView'

export const Route = createFileRoute('/venue')({ component: VenueView })
