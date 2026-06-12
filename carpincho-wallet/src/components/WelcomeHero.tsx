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

const FloatingLogo = ({
  size,
  duration,
}: {
  size: number
  duration?: string
}): React.JSX.Element => {
  const durationStyle = duration ? { animationDuration: duration } : undefined
  return (
    <div className="relative inline-flex items-center justify-center">
      <span
        className="animate-drift relative z-10 inline-flex"
        style={durationStyle}
      >
        <Logo size={size} />
      </span>
      <span
        aria-hidden="true"
        className="animate-logo-shadow pointer-events-none absolute left-1/2 -bottom-1"
        style={{
          width: size * 0.6,
          height: size * 0.14,
          background:
            'radial-gradient(ellipse at center, var(--logo-shadow-color) 0%, transparent 70%)',
          ...durationStyle,
        }}
      />
    </div>
  )
}

export const WelcomeHero = ({
  description,
  logoSize,
  layout = 'stacked',
}: WelcomeHeroProps): React.JSX.Element => {
  const size = logoSize ?? DEFAULT_LOGO_SIZE[layout]

  if (layout === 'compact') {
    return (
      <div className="relative flex flex-col items-center text-center pt-4 pb-5">
        <div className="flex items-center gap-3 animate-fade-in [animation-duration:520ms]">
          <FloatingLogo
            size={size}
            duration="6s"
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
        <FloatingLogo size={size} />
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
