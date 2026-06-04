import { useExecute, useLedger, useParty } from 'canton-connect-kit'
import { useEffect, useState } from 'react'
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { formatPartyId, shortenIdentifier } from '../../utils/formatPartyId'
import {
  addStampCommand,
  canStamp,
  createTallyCommand,
  grantViewerCommand,
  grantWriterCommand,
  normalizeTallyContract,
  stampStats,
  TALLY_PACKAGE_ID,
  TALLY_TEMPLATE_ID,
  type TallyContract,
} from './loyaltySignature'

const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

type ManageRole = 'staff' | 'cardholder'
type PartyDrafts = Record<string, Partial<Record<ManageRole, string>>>

// Stable per-slot keys for the fixed 10-slot punch card (avoids index-as-key).
const SLOT_KEYS = Array.from({ length: 10 }, (_, i) => `slot-${i}`)

// 10-slot punch card. `filled` slots are stamped; the rest are open.
const PunchCard = ({ filled }: { filled: number }): JSX.Element => (
  <div className="mt-2 grid grid-cols-5 gap-1.5">
    {SLOT_KEYS.map((key, i) => (
      <div
        key={key}
        className={
          i < filled
            ? 'grid aspect-square place-items-center rounded-full bg-white font-extrabold text-primary'
            : 'grid aspect-square place-items-center rounded-full border-2 border-dashed border-white/55'
        }
      >
        {i < filled ? '★' : ''}
      </div>
    ))}
  </div>
)

type ManageSectionProps = {
  addTestId: string
  buttonLabel: string
  disabled: boolean
  draft: string
  emptyMessage: string
  inputTestId: string
  onAdd: () => void
  onDraftChange: (value: string) => void
  parties: string[]
  title: string
}

// A Canton party id is `hint::fingerprint`; treat a non-empty draft without the
// `::` separator as invalid so the field flags it before we hit the ledger.
const isPartyIdShape = (value: string): boolean => value.trim().includes('::')

const ManageSection = ({
  addTestId,
  buttonLabel,
  disabled,
  draft,
  emptyMessage,
  inputTestId,
  onAdd,
  onDraftChange,
  parties,
  title,
}: ManageSectionProps): JSX.Element => {
  const trimmed = draft.trim()
  const invalid = trimmed !== '' && !isPartyIdShape(trimmed)
  return (
    <section className="mb-6">
      <h3 className="mb-2 font-display text-base font-semibold text-foreground">{title}</h3>
      {parties.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {parties.map((partyId) => (
            <li key={partyId} className="break-all font-mono text-sm text-foreground">
              {formatPartyId(partyId)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            data-testid={inputTestId}
            className="font-mono text-sm"
            value={draft}
            error={invalid}
            aria-label={`${title} party id`}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="party::fingerprint"
            disabled={disabled}
          />
          {invalid && (
            <p className="mt-1 text-xs text-danger">Enter a full party id (party::fingerprint).</p>
          )}
        </div>
        <SecondaryButton
          data-testid={addTestId}
          className="shrink-0"
          onClick={onAdd}
          disabled={disabled || trimmed === '' || invalid}
        >
          {buttonLabel}
        </SecondaryButton>
      </div>
    </section>
  )
}

// Loyalty stamp card feature. Removable: delete this folder, its import + the
// <LoyaltyCard /> line in App.tsx, ../e2e/tests/features/loyalty, and the
// dapp/daml Tally module (see README "Removing a feature").
export const LoyaltyCard = (): JSX.Element | null => {
  const { party } = useParty()
  const { execute, lastTx, isExecuting } = useExecute()
  const { ledgerApi } = useLedger()

  const [tallies, setTallies] = useState<TallyContract[]>([])
  const [partyDrafts, setPartyDrafts] = useState<PartyDrafts>({})
  const [manageId, setManageId] = useState<string | undefined>(undefined)

  const busy = isExecuting

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the ACS only when the active party identity changes
  useEffect(() => {
    if (party === undefined) {
      setTallies([])
      return
    }
    void loadTalliesFor(party.partyId)
  }, [party?.partyId])

  const loadTalliesFor = async (partyId: string): Promise<TallyContract[]> => {
    try {
      const ledgerEnd = (await ledgerApi({
        requestMethod: 'get',
        resource: '/v2/state/ledger-end',
      })) as { offset?: number }
      if (typeof ledgerEnd.offset !== 'number') {
        throw new Error('ledger-end did not return an offset')
      }
      const response = (await ledgerApi({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: {
          filter: {
            filtersByParty: {
              [partyId]: {
                cumulative: [
                  {
                    identifierFilter: {
                      TemplateFilter: {
                        value: { templateId: TALLY_TEMPLATE_ID, includeCreatedEventBlob: true },
                      },
                    },
                  },
                ],
              },
            },
          },
          activeAtOffset: ledgerEnd.offset,
          verbose: true,
        },
      })) as unknown[]
      const next = (Array.isArray(response) ? response : []).flatMap((row) => {
        const tally = normalizeTallyContract(row)
        return tally === undefined ? [] : [tally]
      })
      setTallies(next)
      return next
    } catch (err) {
      toast.error((err as Error).message)
      return []
    }
  }

  const runCommand = async (
    prefix: string,
    command: unknown,
    successMessage: string,
  ): Promise<TallyContract[] | undefined> => {
    if (party === undefined) {
      return undefined
    }
    try {
      await execute({
        commandId: commandId(prefix),
        commands: [command],
        actAs: [party.partyId],
        readAs: [party.partyId],
        packageIdSelectionPreference: [TALLY_PACKAGE_ID],
      })
      const next = await loadTalliesFor(party.partyId)
      toast.success(successMessage)
      return next
    } catch (err) {
      toast.error((err as Error).message)
      return undefined
    }
  }

  // Management choices (grant writer/viewer) archive the Tally and recreate it
  // with a fresh contractId, so the open Sheet — keyed on contractId — would lose
  // its target and close. Re-point manageId at the recreated card (the one new
  // contractId for this issuer) so the Sheet stays open across multiple adds.
  const runManageCommand = async (
    prefix: string,
    command: unknown,
    successMessage: string,
    card: TallyContract,
  ): Promise<void> => {
    const previousIds = new Set(tallies.map((t) => t.contractId))
    const next = await runCommand(prefix, command, successMessage)
    if (next === undefined) {
      return
    }
    const successor = next.find((t) => !previousIds.has(t.contractId) && t.issuer === card.issuer)
    setManageId(successor?.contractId)
  }

  const draftFor = (contractId: string, role: ManageRole): string =>
    partyDrafts[contractId]?.[role] ?? ''
  const updateDraft = (contractId: string, role: ManageRole, value: string): void => {
    setPartyDrafts((prev) => ({
      ...prev,
      [contractId]: { ...prev[contractId], [role]: value },
    }))
  }

  if (party === undefined) {
    return null
  }

  const managed = tallies.find((t) => t.contractId === manageId)

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Your stamp cards</h2>
        <PrimaryButton
          data-testid="new-card"
          onClick={() => {
            void runCommand('create-tally', createTallyCommand(party.partyId), 'Card created')
          }}
          disabled={busy}
        >
          New card
        </PrimaryButton>
      </div>

      {tallies.length === 0 ? (
        <Card className="text-muted-foreground">
          <p className="m-0">No stamp cards yet. Create one to start collecting stamps.</p>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tallies.map((tally) => {
            const { filled, rewards } = stampStats(tally.value)
            return (
              <Card
                key={tally.contractId}
                className="flex flex-col gap-3"
                data-testid="tally-card"
                data-value={tally.value}
                data-contract-id={tally.contractId}
                data-issuer={tally.issuer}
                data-writers={tally.writers.length}
                data-viewers={tally.viewers.length}
              >
                <div className="rounded-xl bg-[image:var(--bg-gradient-brand)] p-3 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold">
                      {formatPartyId(tally.issuer)}
                    </span>
                    <span className="text-xs opacity-85">{filled} / 10</span>
                  </div>
                  <PunchCard filled={filled} />
                  {rewards > 0 && (
                    <p className="m-0 mt-2 text-xs font-semibold opacity-90">
                      {rewards} reward{rewards === 1 ? '' : 's'} earned
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    Card {shortenIdentifier(tally.contractId)}
                  </span>
                  <PrimaryButton
                    data-testid="add-stamp"
                    onClick={() => {
                      void runCommand(
                        'add-stamp',
                        addStampCommand(tally, party.partyId),
                        'Stamp added',
                      )
                    }}
                    disabled={busy || !canStamp(tally, party.partyId)}
                  >
                    Add stamp
                  </PrimaryButton>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">
                    {tally.writers.length} staff · {tally.viewers.length} cardholders
                  </span>
                  <GhostButton
                    data-testid="manage-card"
                    onClick={() => setManageId(tally.contractId)}
                  >
                    Manage
                  </GhostButton>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      <Sheet
        open={managed !== undefined}
        onOpenChange={(open) => setManageId(open ? manageId : undefined)}
        side="right"
        title="Manage card"
        description="Add staff who can stamp this card, or cardholders who can view it."
      >
        {managed !== undefined && (
          <>
            <ManageSection
              addTestId="add-staff"
              buttonLabel="Add staff"
              disabled={managed.issuer !== party.partyId || busy}
              draft={draftFor(managed.contractId, 'staff')}
              emptyMessage="No staff yet."
              inputTestId="staff-party-id-input"
              onAdd={() => {
                void runManageCommand(
                  'grant-writer',
                  grantWriterCommand(managed, draftFor(managed.contractId, 'staff').trim()),
                  'Staff added',
                  managed,
                )
              }}
              onDraftChange={(value) => updateDraft(managed.contractId, 'staff', value)}
              parties={managed.writers.map(([writer]) => writer)}
              title="Staff"
            />
            <ManageSection
              addTestId="add-cardholder"
              buttonLabel="Add cardholder"
              disabled={managed.issuer !== party.partyId || busy}
              draft={draftFor(managed.contractId, 'cardholder')}
              emptyMessage="No cardholders yet."
              inputTestId="cardholder-party-id-input"
              onAdd={() => {
                void runManageCommand(
                  'grant-viewer',
                  grantViewerCommand(managed, draftFor(managed.contractId, 'cardholder').trim()),
                  'Cardholder added',
                  managed,
                )
              }}
              onDraftChange={(value) => updateDraft(managed.contractId, 'cardholder', value)}
              parties={managed.viewers}
              title="Cardholders"
            />
          </>
        )}
      </Sheet>

      {lastTx !== undefined && (
        <section
          className="ui-hidden"
          data-testid="tx-status"
          data-tx-status={lastTx.status}
          data-tx-command-id={lastTx.commandId ?? ''}
        >
          <span>Last activity: {lastTx.status}</span>
          {lastTx.commandId !== undefined && lastTx.commandId.length > 0 && (
            <code>{shortenIdentifier(lastTx.commandId)}</code>
          )}
        </section>
      )}
    </>
  )
}
