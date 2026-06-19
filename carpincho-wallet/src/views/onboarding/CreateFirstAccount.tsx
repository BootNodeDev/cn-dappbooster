import { CreateAccountForm } from '@/components/CreateAccountForm'
import { Card } from '@/components/ui/Card'

// First-account creation. Connection lives in its own onboarding step now, so this is
// just the account form.
export const CreateFirstAccount = (): JSX.Element => (
  <Card>
    <CreateAccountForm showIntro />
  </Card>
)
