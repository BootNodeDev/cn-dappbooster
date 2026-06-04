import { useExecute, useLedger, useParty } from 'canton-connect-kit'
import { useEffect, useState } from 'react'
import { SecondaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { COPY_ICON, EYE_ICON } from '@/components/ui/icons'
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

// Ledger/RPC rejections aren't always Error instances — Canton surfaces a
// structured `{ cause, code, ... }` object. Pull out a readable message instead
// of letting a bare object render as "[object Object]".
const errorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  if (err !== null && typeof err === 'object') {
    const record = err as Record<string, unknown>
    if (typeof record.cause === 'string') {
      return record.cause
    }
    if (typeof record.message === 'string') {
      return record.message
    }
    try {
      return JSON.stringify(err)
    } catch {
      return 'Unexpected error'
    }
  }
  return 'Unexpected error'
}

type ManageRole = 'staff' | 'cardholder'
type PartyDrafts = Record<string, Partial<Record<ManageRole, string>>>

// Stable per-slot keys for the fixed 10-slot punch card (avoids index-as-key).
const SLOT_KEYS = Array.from({ length: 10 }, (_, i) => `slot-${i}`)

// Preserve card order across ACS reloads. Daml choices recreate the Tally with a
// new contractId, and the active-contracts response doesn't preserve position —
// so a recreated card would otherwise jump. Each previous card keeps its slot,
// adopting the newly-created same-issuer successor; genuinely new cards append.
const reconcileOrder = (prev: TallyContract[], next: TallyContract[]): TallyContract[] => {
  const prevIds = new Set(prev.map((t) => t.contractId))
  const byId = new Map(next.map((t) => [t.contractId, t]))
  const claimed = new Set<string>()
  const result: TallyContract[] = []
  for (const old of prev) {
    const same = byId.get(old.contractId)
    if (same !== undefined) {
      result.push(same)
      claimed.add(same.contractId)
      continue
    }
    const successor = next.find(
      (t) => !prevIds.has(t.contractId) && !claimed.has(t.contractId) && t.issuer === old.issuer,
    )
    if (successor !== undefined) {
      result.push(successor)
      claimed.add(successor.contractId)
    }
  }
  for (const t of next) {
    if (!claimed.has(t.contractId)) {
      result.push(t)
    }
  }
  return result
}

// 10-slot punch card. `filledSlots` is the exact set of slot indices to show as
// stamped; the rest become clickable "+" buttons when the active party may stamp.
// Clicking a slot fills THAT slot (not the next sequential one) — a transient,
// unstored visual: on page reload the set is reseeded sequentially from the
// on-ledger count.
const PunchCard = ({
  filledSlots,
  canAdd,
  busy,
  onAdd,
}: {
  filledSlots: number[]
  canAdd: boolean
  busy: boolean
  onAdd: (slot: number) => void
}): JSX.Element => (
  <div className="mt-2 grid grid-cols-5 gap-2">
    {SLOT_KEYS.map((key, i) => {
      if (filledSlots.includes(i)) {
        return (
          <div
            key={key}
            className="grid aspect-square place-items-center rounded-full bg-white text-3xl font-extrabold leading-none text-primary"
          >
            ★
          </div>
        )
      }
      if (!canAdd) {
        return (
          <div
            key={key}
            className="aspect-square rounded-full border-2 border-dashed border-white/55"
          />
        )
      }
      return (
        <button
          key={key}
          type="button"
          aria-label="Add stamp"
          data-testid="add-stamp"
          onClick={() => onAdd(i)}
          disabled={busy}
          className="grid aspect-square place-items-center rounded-full border-2 border-dashed border-white/55 text-3xl leading-none text-white/70 transition-colors enabled:hover:border-white enabled:hover:bg-white/20 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          +
        </button>
      )
    })}
  </div>
)

type ManageSectionProps = {
  addTestId: string
  buttonLabel: string
  disabled: boolean
  draft: string
  inputTestId: string
  onAdd: () => void
  onDraftChange: (value: string) => void
  title: string
}

// A Canton party id is `hint::fingerprint`; reject a non-empty draft that lacks
// the `::` separator before it reaches the ledger.
const isPartyIdShape = (value: string): boolean => value.trim().includes('::')

const ManageSection = ({
  addTestId,
  buttonLabel,
  disabled,
  draft,
  inputTestId,
  onAdd,
  onDraftChange,
  title,
}: ManageSectionProps): JSX.Element => {
  const trimmed = draft.trim()
  const invalid = trimmed !== '' && !isPartyIdShape(trimmed)
  return (
    <section>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && trimmed !== '' && !invalid) {
            onAdd()
          }
        }}
      >
        <TextInput
          data-testid={inputTestId}
          className="w-full font-mono text-sm"
          value={draft}
          error={invalid}
          aria-label={`${title} party id`}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="party::fingerprint"
          disabled={disabled}
        />
        {invalid && (
          <p className="text-xs text-danger">Enter a full party id (party::fingerprint).</p>
        )}
        <SecondaryButton
          type="submit"
          data-testid={addTestId}
          className="w-full"
          disabled={disabled || trimmed === '' || invalid}
        >
          {buttonLabel}
        </SecondaryButton>
      </form>
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
  // Which card + role the "view parties" modal and the "add party" modal target.
  const [view, setView] = useState<{ contractId: string; role: ManageRole } | undefined>(undefined)
  const [addTo, setAddTo] = useState<{ contractId: string; role: ManageRole } | undefined>(
    undefined,
  )
  // Per-card set of slot indices shown as stamped. Undefined until the user
  // clicks a slot; then it's frozen to "what was sequentially filled at that
  // moment, plus the clicked slot" so further stamps don't reflow the layout.
  // Not persisted — a page reload drops it and the card reseeds sequentially.
  const [filledSlots, setFilledSlots] = useState<Record<string, number[]>>({})

  const busy = isExecuting

  const copyText = async (text: string, message: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  }

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
      const parsed = (Array.isArray(response) ? response : []).flatMap((row) => {
        const tally = normalizeTallyContract(row)
        return tally === undefined ? [] : [tally]
      })
      const ordered = reconcileOrder(tallies, parsed)
      setTallies(ordered)
      return ordered
    } catch (err) {
      toast.error(errorMessage(err))
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
      toast.error(errorMessage(err))
      return undefined
    }
  }

  // Stamping is a consuming choice: it archives the Tally and creates a new one
  // with a fresh contractId. We must reload so the NEXT stamp targets the live
  // contract (otherwise the second stamp hits an archived contract and fails) —
  // then migrate the optimistic filled-slot overlay onto the recreated card so
  // the clicked positions stick instead of snapping back to sequential.
  const addStamp = async (tally: TallyContract, slot: number): Promise<void> => {
    if (party === undefined) {
      return
    }
    try {
      await execute({
        commandId: commandId('add-stamp'),
        commands: [addStampCommand(tally, party.partyId)],
        actAs: [party.partyId],
        readAs: [party.partyId],
        packageIdSelectionPreference: [TALLY_PACKAGE_ID],
      })
      const previousIds = new Set(tallies.map((t) => t.contractId))
      const ordered = await loadTalliesFor(party.partyId)
      const successor = ordered.find(
        (t) => !previousIds.has(t.contractId) && t.issuer === tally.issuer,
      )
      if (successor !== undefined) {
        setFilledSlots((prev) => {
          const overlay = prev[tally.contractId]
          if (overlay === undefined) {
            return prev
          }
          const rest = { ...prev }
          delete rest[tally.contractId]
          return { ...rest, [successor.contractId]: overlay }
        })
      }
      toast.success('Stamp added')
    } catch (err) {
      toast.error(errorMessage(err))
      // Tx rejected/failed: roll back the optimistic fill for this slot.
      setFilledSlots((prev) => {
        const current = prev[tally.contractId]
        if (current === undefined) {
          return prev
        }
        return { ...prev, [tally.contractId]: current.filter((s) => s !== slot) }
      })
    }
  }

  // Grant writer/viewer, then close the manage modal on success (and clear its
  // drafts). A failed grant returns undefined and leaves the modal open with the
  // typed value so the user can correct it.
  const runManageCommand = async (
    prefix: string,
    command: unknown,
    successMessage: string,
    card: TallyContract,
  ): Promise<void> => {
    const next = await runCommand(prefix, command, successMessage)
    if (next === undefined) {
      return
    }
    setAddTo(undefined)
    setPartyDrafts((prev) => {
      const rest = { ...prev }
      delete rest[card.contractId]
      return rest
    })
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

  const adding =
    addTo !== undefined ? tallies.find((t) => t.contractId === addTo.contractId) : undefined
  const viewed =
    view !== undefined ? tallies.find((t) => t.contractId === view.contractId) : undefined
  const viewedParties =
    viewed === undefined
      ? []
      : view?.role === 'staff'
        ? viewed.writers.map(([w]) => w)
        : viewed.viewers

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Your stamp cards</h2>
        <button
          type="button"
          data-testid="new-card"
          aria-label="New card"
          title="New card"
          onClick={() => {
            void runCommand('create-tally', createTallyCommand(party.partyId), 'Card created')
          }}
          disabled={busy}
          className="inline-grid size-10 place-items-center rounded-full border border-border-strong bg-surface text-2xl leading-none text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          +
        </button>
      </div>

      {tallies.length === 0 ? (
        <Card className="text-muted-foreground">
          <p className="m-0">No stamp cards yet. Create one to start collecting stamps.</p>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tallies.map((tally) => {
            const { filled, rewards } = stampStats(tally.value)
            const sequentialSlots = Array.from({ length: filled }, (_, i) => i)
            const slots = filledSlots[tally.contractId] ?? sequentialSlots
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
                    <span className="font-display text-sm font-bold">Stamps</span>
                    <span className="text-xs opacity-85">{slots.length} / 10</span>
                  </div>
                  <PunchCard
                    filledSlots={slots}
                    canAdd={canStamp(tally, party.partyId)}
                    busy={busy}
                    onAdd={(slot) => {
                      setFilledSlots((prev) => {
                        const base = prev[tally.contractId] ?? sequentialSlots
                        return {
                          ...prev,
                          [tally.contractId]: base.includes(slot) ? base : [...base, slot],
                        }
                      })
                      void addStamp(tally, slot)
                    }}
                  />
                  {rewards > 0 && (
                    <p className="m-0 mt-2 text-xs font-semibold opacity-90">
                      {rewards} reward{rewards === 1 ? '' : 's'} earned
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    Card {shortenIdentifier(tally.contractId)}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy card id"
                    title="Copy card id"
                    onClick={() => {
                      void copyText(tally.contractId, 'Card id copied.')
                    }}
                    className="inline-grid shrink-0 place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-3.5"
                  >
                    {COPY_ICON}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{tally.writers.length} staff</span>
                    <button
                      type="button"
                      aria-label="View staff"
                      title="View staff"
                      onClick={() => setView({ contractId: tally.contractId, role: 'staff' })}
                      className="inline-grid place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-3.5"
                    >
                      {EYE_ICON}
                    </button>
                    {tally.issuer === party.partyId && (
                      <button
                        type="button"
                        data-testid="open-add-staff"
                        aria-label="Add staff"
                        title="Add staff"
                        onClick={() => setAddTo({ contractId: tally.contractId, role: 'staff' })}
                        className="inline-grid size-5 place-items-center rounded-full border border-border-strong bg-surface text-sm leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <span className="h-4 w-px bg-border" aria-hidden="true" />
                  <div className="flex items-center gap-2">
                    <span>{tally.viewers.length} cardholders</span>
                    <button
                      type="button"
                      aria-label="View cardholders"
                      title="View cardholders"
                      onClick={() => setView({ contractId: tally.contractId, role: 'cardholder' })}
                      className="inline-grid place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-3.5"
                    >
                      {EYE_ICON}
                    </button>
                    {tally.issuer === party.partyId && (
                      <button
                        type="button"
                        data-testid="open-add-cardholder"
                        aria-label="Add cardholder"
                        title="Add cardholder"
                        onClick={() =>
                          setAddTo({ contractId: tally.contractId, role: 'cardholder' })
                        }
                        className="inline-grid size-5 place-items-center rounded-full border border-border-strong bg-surface text-sm leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      <Sheet
        open={addTo !== undefined && adding !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setAddTo(undefined)
          }
        }}
        side="center"
        title={addTo?.role === 'staff' ? 'Add staff' : 'Add cardholder'}
        description="Grant another party access to this card by their party id."
      >
        {addTo !== undefined && adding !== undefined && (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Create accounts in your wallet, then copy a party id from there to paste here.
            </p>
            <ManageSection
              addTestId={addTo.role === 'staff' ? 'add-staff' : 'add-cardholder'}
              buttonLabel={addTo.role === 'staff' ? 'Add staff' : 'Add cardholder'}
              disabled={adding.issuer !== party.partyId || busy}
              draft={draftFor(adding.contractId, addTo.role)}
              inputTestId={
                addTo.role === 'staff' ? 'staff-party-id-input' : 'cardholder-party-id-input'
              }
              onAdd={() => {
                const value = draftFor(adding.contractId, addTo.role).trim()
                void runManageCommand(
                  addTo.role === 'staff' ? 'grant-writer' : 'grant-viewer',
                  addTo.role === 'staff'
                    ? grantWriterCommand(adding, value)
                    : grantViewerCommand(adding, value),
                  addTo.role === 'staff' ? 'Staff added' : 'Cardholder added',
                  adding,
                )
              }}
              onDraftChange={(value) => updateDraft(adding.contractId, addTo.role, value)}
              title={addTo.role === 'staff' ? 'Staff' : 'Cardholders'}
            />
          </>
        )}
      </Sheet>

      <Sheet
        open={view !== undefined && viewed !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setView(undefined)
          }
        }}
        side="center"
        title={view?.role === 'staff' ? 'Staff' : 'Cardholders'}
        description="Party ids with access to this card."
      >
        {viewedParties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {view?.role === 'staff' ? 'No staff yet.' : 'No cardholders yet.'}
          </p>
        ) : (
          <ul className="flex h-72 flex-col gap-1 overflow-y-auto">
            {viewedParties.map((partyId) => (
              <li key={partyId} className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {formatPartyId(partyId)}
                </span>
                <button
                  type="button"
                  aria-label="Copy party id"
                  title="Copy party id"
                  onClick={() => {
                    void copyText(partyId, 'Party id copied.')
                  }}
                  className="inline-grid shrink-0 place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-3.5"
                >
                  {COPY_ICON}
                </button>
              </li>
            ))}
          </ul>
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
