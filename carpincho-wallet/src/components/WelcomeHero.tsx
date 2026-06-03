import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

interface WelcomeHeroProps {
  description?: ReactNode
  logoSize?: number
}

export const WelcomeHero = ({ description, logoSize = 132 }: WelcomeHeroProps): JSX.Element => (
  <div className="relative flex flex-col items-center text-center pt-4 pb-7">
    <div className="animate-fade-in [animation-duration:520ms]">
      <Logo
        size={logoSize}
        className="animate-drift"
      />
    </div>
    <div className="mt-4 font-display text-[2.75rem] font-semibold text-primary dark:bg-[image:var(--bg-gradient-brand)] dark:bg-clip-text dark:text-transparent leading-[1.02] tracking-[-0.03em] lowercase animate-slide-up-and-fade [animation-delay:80ms] [animation-fill-mode:backwards]">
      carpincho
    </div>
    {description !== undefined && (
      <p className="mt-3 max-w-[34ch] text-soft text-[1rem] leading-relaxed animate-slide-up-and-fade [animation-delay:160ms] [animation-fill-mode:backwards]">
        {description}
      </p>
    )}
  </div>
)
