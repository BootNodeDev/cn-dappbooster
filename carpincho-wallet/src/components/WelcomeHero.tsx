import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

type WelcomeHeroLayout = 'stacked' | 'compact'

interface WelcomeHeroProps {
  description?: ReactNode
  logoSize?: number
  layout?: WelcomeHeroLayout
}

const WORDMARK_BASE =
  'font-display font-semibold text-primary dark:bg-[image:var(--bg-gradient-brand)] dark:bg-clip-text dark:text-transparent leading-[1.02] tracking-[-0.03em] lowercase'

const DEFAULT_LOGO_SIZE: Record<WelcomeHeroLayout, number> = {
  stacked: 132,
  compact: 52,
}

export const WelcomeHero = ({
  description,
  logoSize,
  layout = 'stacked',
}: WelcomeHeroProps): JSX.Element => {
  const size = logoSize ?? DEFAULT_LOGO_SIZE[layout]

  if (layout === 'compact') {
    return (
      <div className="relative flex flex-col items-center text-center pt-4 pb-5">
        <div className="flex items-center gap-3 animate-fade-in [animation-duration:520ms]">
          <Logo
            size={size}
            className="animate-drift"
          />
          <span className={`${WORDMARK_BASE} text-[2rem]`}>carpincho</span>
        </div>
        {description !== undefined && (
          <p className="mt-2 text-soft text-[1rem] leading-relaxed animate-slide-up-and-fade [animation-delay:120ms] [animation-fill-mode:backwards]">
            {description}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center text-center pt-4 pb-7">
      <div className="animate-fade-in [animation-duration:520ms]">
        <Logo
          size={size}
          className="animate-drift"
        />
      </div>
      <div
        className={`${WORDMARK_BASE} mt-4 text-[2.75rem] animate-slide-up-and-fade [animation-delay:80ms] [animation-fill-mode:backwards]`}
      >
        carpincho
      </div>
      {description !== undefined && (
        <p className="mt-3 max-w-[34ch] text-soft text-[1rem] leading-relaxed animate-slide-up-and-fade [animation-delay:160ms] [animation-fill-mode:backwards]">
          {description}
        </p>
      )}
    </div>
  )
}
