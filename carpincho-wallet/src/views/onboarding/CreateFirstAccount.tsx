import { CreateAccountForm } from '@/components/CreateAccountForm.tsx'
import { Card } from '@/components/ui/Card.tsx'

export const CreateFirstAccount = (): JSX.Element => (
  <Card className="mb-3">
    <h2 className="m-0 mb-1 font-display text-[1.6rem] font-semibold text-foreground tracking-[-0.02em] leading-tight">
      Create your first account
    </h2>
    <CreateAccountForm />
  </Card>
)
