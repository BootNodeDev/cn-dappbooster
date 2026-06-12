import { CreateAccountForm } from '@/components/CreateAccountForm'
import { Card } from '@/components/ui/Card'

export const CreateFirstAccount = (): React.JSX.Element => (
  <Card>
    <CreateAccountForm showIntro />
  </Card>
)
