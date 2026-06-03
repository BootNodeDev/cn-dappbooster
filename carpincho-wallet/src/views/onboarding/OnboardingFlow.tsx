import { Stepper } from '@/components/ui/Stepper'
import { WelcomeHero } from '@/components/WelcomeHero'
import { useVault } from '@/vault/useVault'
import { CreateFirstAccount } from '@/views/onboarding/CreateFirstAccount'
import { CreateVault } from '@/views/onboarding/CreateVault'

const ONBOARDING_STEPS = ['Create Vault', 'Create Account']

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
