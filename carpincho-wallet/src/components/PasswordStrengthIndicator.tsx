import { Tooltip } from '@/components/ui/Tooltip'
import { MIN_PASSWORD_SCORE, scorePassword } from '@/vault/passwordStrength'

type Tier = { segmentColor: string; labelColor: string; label: string }

const TOO_WEAK: Tier = { segmentColor: 'bg-danger', labelColor: 'text-danger', label: 'Too weak' }
const FAIR: Tier = { segmentColor: 'bg-warning', labelColor: 'text-warning', label: 'Fair' }
const STRONG: Tier = { segmentColor: 'bg-success', labelColor: 'text-success', label: 'Strong' }
const EXCELLENT: Tier = {
  segmentColor: 'bg-primary',
  labelColor: 'text-primary',
  label: 'Excellent',
}

const TIERS: readonly Tier[] = [TOO_WEAK, TOO_WEAK, FAIR, STRONG, EXCELLENT]

const REQUIRED_LABEL = (TIERS[MIN_PASSWORD_SCORE] ?? STRONG).label

type Props = {
  password: string
  id?: string
}

export const PasswordStrengthIndicator = ({ password, id }: Props): JSX.Element => {
  const score = scorePassword(password)
  const tier = TIERS[Math.min(Math.max(score, 0), 4)] ?? TOO_WEAK
  const empty = password.length === 0

  return (
    <div
      className="flex flex-col gap-2"
      id={id}
    >
      <div className="relative pt-5">
        <span
          aria-live="polite"
          className={`absolute top-0 right-0 text-[0.75rem] font-mono ${empty ? 'invisible' : tier.labelColor}`}
        >
          {empty ? '' : tier.label}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((seg) => (
            <div
              key={seg}
              className={`h-1.5 flex-1 rounded-full transition-colors ${score >= seg ? tier.segmentColor : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1 text-[0.8rem] text-soft">
        <b>"{REQUIRED_LABEL}"</b> or better
        <Tooltip
          label="Password recommendations"
          content={
            <div className="flex flex-col gap-2">
              <p>
                Aim for <strong>12+ characters</strong>. Length is the biggest factor.
              </p>
              <p>
                A string of unrelated words (e.g.{' '}
                <span className="font-mono">correctly-growing-a-horse-battery</span>) is easier to
                remember and <strong>harder to crack</strong> than short complex passwords.
              </p>
              <p>
                Avoid names, dates, dictionary words, and common substitutions (pa$$word, p@ssw0rd).
              </p>
              <p>
                The vault is encrypted locally: a stolen vault file can be attacked offline without
                rate limits. Password strength is important.
              </p>
            </div>
          }
        />
      </p>
    </div>
  )
}
