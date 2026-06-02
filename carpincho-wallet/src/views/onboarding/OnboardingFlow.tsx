import { Stepper } from '@/components/ui/Stepper.tsx'
import { WelcomeHero } from '@/components/WelcomeHero.tsx'
import { useVault } from '@/vault/useVault.ts'
import { CreateFirstAccount } from '@/views/onboarding/CreateFirstAccount.tsx'
import { CreateVault } from '@/views/onboarding/CreateVault.tsx'

const ONBOARDING_STEPS = ['Create vault', 'Create account']

export const OnboardingFlow = (): JSX.Element => {
  const v = useVault()
  const step = v.hasVault ? 2 : 1
  return (
    <div>
      <WelcomeHero description="Canton development wallet." />
      <Stepper
        steps={ONBOARDING_STEPS}
        current={step}
      />
      <div
        key={step}
        className="animate-slide-up-and-fade [animation-fill-mode:backwards]"
      >
        {step === 1 ? <CreateVault /> : <CreateFirstAccount />}
      </div>
    </div>
  )
}
