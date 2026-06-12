// AmuletBackend: VestingBackend implementation against Splice LocalNet.
//
// Key differences from a simple ledger-ACS backend:
//   - Template ids are split across two packages: amulet-vesting (deployment.pkg)
//     and splice-amulet (deployment.splicePkg, fallback to SPLICE_PKG_FALLBACK).
//   - Every mutating choice takes an AppTransferContext { amuletRules, openMiningRound,
//     featuredAppRight? }. loadTransferContext() fetches these from the SCAN service
//     (not the ledger ACS) because LocalNet's JSON Ledger API returns empty
//     createdEventBlob for DSO-owned contracts.
//   - createVesting reads the proposer's Amulet holdings to collect enough amuletCids
//     to cover the grant total. The factory is read from the operator's ACS (proposer
//     === operator in this demo) and NOT disclosed alongside the ctx-bearing choices.
//
// Config shape expected in /public/amulet-parties.json:
//   {
//     "rpcUrl":    "http://localhost:3010/rpc",
//     "pkg":       "e4afada3...",
//     "operator":  "<party-id>",
//     "splicePkg": "90987abe..."
//   }
// `splicePkg` falls back to SPLICE_PKG_FALLBACK when absent.

// ── Known splice-amulet 0.1.19 package id ────────────────────────────────────
// ASSUMPTION [A1]: stable across all LocalNet deployments at version 0.1.19.
// Verified from the DAR: damlc inspect-dar splice-amulet-0.1.19.dar →
// main_package_id = 90987abecbcb1d004b063ddfe3b4b5d46cf3814ce89114a86c8cd75ff3cb8a4b
const SPLICE_PKG_FALLBACK = '90987abecbcb1d004b063ddfe3b4b5d46cf3814ce89114a86c8cd75ff3cb8a4b'

// ── Package NAMES (for ACS TemplateFilters) ──────────────────────────────────
// The JSON Ledger API rejects package-id-qualified template ids in active-contracts
// filters ("expected a package name") — Canton's smart-contract-upgrade rule. Filters
// must use `#<package-name>:Module:Entity`. Commands and disclosed contracts keep the
// package-id-qualified form. These names are stable: amulet-vesting from our daml.yaml,
// splice-amulet from the Splice 0.1.19 package.
const AMULET_VESTING_PKG_NAME = 'amulet-vesting'
const SPLICE_AMULET_PKG_NAME = 'splice-amulet'

import type { DisclosedContract, LedgerCommand, SubmitFn } from '@/wallet/Wallet'
import {
  type AppTransferContextArg,
  buildAmuletAcceptCommand,
  buildAmuletCancelCommand,
  buildAmuletClaimResidualCommand,
  buildAmuletCreateVestingCommand,
  buildAmuletWithdrawCommand,
} from './amuletCommands'
import { buildDisclosedContract, type DisclosedRef, extractCreatedEventBlob } from './commands'
import { walletServiceRequest } from './ledgerApi'
import {
  type CreateVestInput,
  composeNote,
  type Deployment,
  rowToClaim,
  rowToGrant,
  rowToProposal,
  type VestingBackend,
  type VestingView,
} from './VestingBackend'

// ── ACS row shape ────────────────────────────────────────────────────────────
type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        createdEventBlob?: string
        createArgument?: Record<string, unknown>
      }
      synchronizerId?: string
    }
  }
}

// TransferContext loaded from the SCAN service, ready to pass in a command.
type TransferContext = {
  arg: AppTransferContextArg
  disclosures: DisclosedContract[]
}

// ── SCAN API response shapes ─────────────────────────────────────────────────
// Verified against live Splice SCAN responses.

type ScanAmuletRulesResponse = {
  // POST /api/scan/v0/amulet-rules
  amulet_rules_update?: {
    contract?: {
      template_id?: string
      contract_id?: string
      payload?: unknown
      created_event_blob?: string
      created_at?: string
    }
    domain_id?: string
  }
}

type ScanMiningRoundContract = {
  contract_id?: string
  created_event_blob?: string
  payload?: {
    round?: {
      number?: unknown
    }
    opensAt?: string
  }
}

type ScanMiningRoundsResponse = {
  // POST /api/scan/v0/open-and-issuing-mining-rounds
  // open_mining_rounds is an OBJECT keyed by contractId — NOT an array.
  open_mining_rounds?: Record<string, { contract?: ScanMiningRoundContract }>
  issuing_mining_rounds?: Record<string, unknown>
  time_to_live_in_microseconds?: unknown
}

export class AmuletBackend implements VestingBackend {
  readonly mode = 'amulet' as const
  private readonly rpcUrl: string
  private readonly submitFn: SubmitFn
  private readonly operator: string
  private readonly factoryTid: string
  private readonly proposalTid: string
  private readonly contractTid: string
  private readonly claimTid: string
  private readonly amuletTid: string
  private readonly amuletRulesTid: string
  private readonly openMiningRoundTid: string
  private readonly filterNameByPkg: Record<string, string>

  // Two transports by design:
  //   - submit (SubmitFn): wallet-signed command submission as the connected
  //     external party (canton-connect-kit → Carpincho).
  //   - rpcUrl (wallet-service /rpc): SCAN context + cross-party ACS reads.
  // The cross-party reads below (factory from the OPERATOR's ACS in
  // createVesting; the proposer's input Amulets in discloseAcceptInputs) MUST
  // stay on the wallet-service channel — the connected party cannot readAs the
  // operator, and SCAN is not exposed through connect-kit.
  constructor(rpcUrl: string, deployment: Deployment, submit: SubmitFn) {
    this.rpcUrl = rpcUrl
    this.submitFn = submit
    this.operator = deployment.operator
    const pkg = deployment.pkg
    const sp = deployment.splicePkg ?? SPLICE_PKG_FALLBACK
    this.factoryTid = `${pkg}:AmuletVesting:AmuletVestingFactory`
    this.proposalTid = `${pkg}:AmuletVesting:AmuletVestingProposal`
    this.contractTid = `${pkg}:AmuletVesting:AmuletVestingContract`
    this.claimTid = `${pkg}:AmuletVesting:AmuletVestedClaim`
    this.amuletTid = `${sp}:Splice.Amulet:Amulet`
    this.amuletRulesTid = `${sp}:Splice.AmuletRules:AmuletRules`
    this.openMiningRoundTid = `${sp}:Splice.Round:OpenMiningRound`
    this.filterNameByPkg = { [pkg]: AMULET_VESTING_PKG_NAME, [sp]: SPLICE_AMULET_PKG_NAME }
  }

  // ACS TemplateFilters require a package-NAME identifier (#name:Module:Entity); the
  // JSON Ledger API rejects package-id-qualified ids in filters. Commands and disclosed
  // contracts keep the package-id-qualified template id unchanged.
  private filterTemplateId(templateId: string): string {
    const [packageId, module, entity] = templateId.split(':')
    const name = this.filterNameByPkg[packageId]
    return name === undefined ? templateId : `#${name}:${module}:${entity}`
  }

  async isAvailable(): Promise<boolean> {
    if (this.rpcUrl === '') {
      return false
    }
    try {
      await this.ledgerEnd()
      return true
    } catch {
      return false
    }
  }

  private async ledgerEnd(): Promise<string | number> {
    const result = await walletServiceRequest<{ offset?: string | number }>(
      this.rpcUrl,
      'ledgerApi',
      { requestMethod: 'get', resource: '/v2/state/ledger-end' },
    )
    if (result.offset === undefined) {
      throw new Error('Ledger API did not return an offset')
    }
    return result.offset
  }

  // ASSUMPTION [A3]: ACS response shape from wallet-service ledgerApi is:
  // each item is AcsRow with contractEntry.JsActiveContract.createdEvent.
  // `offset` lets a caller reading several templates at once pass one shared ledger-end
  // so the reads form a consistent snapshot and avoid a round-trip per template.
  private async readAcs(
    party: string,
    templateId: string,
    offset?: string | number,
  ): Promise<AcsRow[]> {
    const at = offset ?? (await this.ledgerEnd())
    const rows = await walletServiceRequest<unknown>(this.rpcUrl, 'ledgerApi', {
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: {
          filtersByParty: {
            [party]: {
              cumulative: [
                {
                  identifierFilter: {
                    TemplateFilter: {
                      value: {
                        templateId: this.filterTemplateId(templateId),
                        includeCreatedEventBlob: true,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
        activeAtOffset: at,
        verbose: true,
      },
    })
    return Array.isArray(rows) ? (rows as AcsRow[]) : []
  }

  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed?: DisclosedContract[],
  ): Promise<unknown> {
    return this.submitFn(actAs, command, disclosed)
  }

  async viewAs(partyId: string): Promise<VestingView> {
    // One ledger-end for all three reads: a consistent snapshot, one fewer round-trip
    // each, and no risk of the reads landing on different offsets.
    const offset = await this.ledgerEnd()
    const [proposalRows, contractRows, claimRows] = await Promise.all([
      this.readAcs(partyId, this.proposalTid, offset),
      this.readAcs(partyId, this.contractTid, offset),
      this.readAcs(partyId, this.claimTid, offset),
    ])

    type RowParam = Parameters<typeof rowToProposal>[0]

    const proposals = proposalRows
      .map((row) => rowToProposal(row as RowParam))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
    const grants = contractRows
      .map((row) => rowToGrant(row as RowParam))
      .filter((g): g is NonNullable<typeof g> => g !== undefined)
    const claims = claimRows
      .map((row) => rowToClaim(row as RowParam))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
    return { proposals, grants, claims }
  }

  // ── loadTransferContext ──────────────────────────────────────────────────────
  // Fetches AmuletRules and the latest OpenMiningRound from the SCAN service via
  // the wallet-service `scanApi` JSON-RPC method.
  //
  // RATIONALE: LocalNet's JSON Ledger API returns empty `createdEventBlob` for
  // DSO-signed contracts. The SCAN service always carries the full blob.
  //
  // ASSUMPTION [A2]: see ScanAmuletRulesResponse / ScanMiningRoundsResponse types.
  // ASSUMPTION [A4]: featuredAppRight is always None (operator is not a featured-app provider).
  private async loadTransferContext(): Promise<TransferContext> {
    const [rulesResponse, roundsResponse] = await Promise.all([
      walletServiceRequest<ScanAmuletRulesResponse>(this.rpcUrl, 'scanApi', {
        resource: '/api/scan/v0/amulet-rules',
        requestMethod: 'post',
        body: {},
      }),
      walletServiceRequest<ScanMiningRoundsResponse>(this.rpcUrl, 'scanApi', {
        resource: '/api/scan/v0/open-and-issuing-mining-rounds',
        requestMethod: 'post',
        body: {
          cached_open_mining_round_contract_ids: [],
          cached_issuing_round_contract_ids: [],
        },
      }),
    ])

    // ── AmuletRules ──────────────────────────────────────────────────────────
    const rulesUpdate = rulesResponse.amulet_rules_update
    if (rulesUpdate === undefined) {
      throw new Error('AmuletRules not found in SCAN response — missing `amulet_rules_update`')
    }
    const rulesContract = rulesUpdate.contract
    const rulesCid = rulesContract?.contract_id
    const rulesBlob = rulesContract?.created_event_blob
    const synchronizerId = rulesUpdate.domain_id
    if (rulesCid === undefined || rulesBlob === undefined || rulesBlob === '') {
      throw new Error('AmuletRules contract_id or created_event_blob absent in SCAN response')
    }
    const rulesRef: DisclosedRef = {
      contractId: rulesCid,
      createdEventBlob: rulesBlob,
      synchronizerId,
    }

    // ── OpenMiningRound — pick highest round number ──────────────────────────
    const openRoundsMap = roundsResponse.open_mining_rounds
    if (openRoundsMap === undefined || Object.keys(openRoundsMap).length === 0) {
      throw new Error('OpenMiningRound not found in SCAN response — missing `open_mining_rounds`')
    }

    const roundContracts = Object.values(openRoundsMap)
      .map((entry) => entry.contract)
      .filter((c): c is ScanMiningRoundContract => c !== undefined)

    const roundRef = pickLatestScanRound(roundContracts, synchronizerId)
    if (roundRef === undefined) {
      throw new Error(
        'No valid OpenMiningRound entries in SCAN response (missing contract_id or blob)',
      )
    }

    const arg: AppTransferContextArg = {
      amuletRules: rulesCid,
      openMiningRound: roundRef.contractId,
      featuredAppRight: null, // [A4]
    }

    const disclosures: DisclosedContract[] = [
      buildDisclosedContract(this.amuletRulesTid, rulesRef),
      buildDisclosedContract(this.openMiningRoundTid, roundRef),
    ]

    return { arg, disclosures }
  }

  // ── createVesting ────────────────────────────────────────────────────────────
  // Factory is read from the operator's ACS (proposer === operator in this demo).
  // Only AmuletRules + OpenMiningRound are disclosed (on the ctx-bearing choices).
  // The factory is disclosed to the proposer so they can exercise it without
  // on-ledger visibility.
  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
    const factoryRows = await this.readAcs(this.operator, this.factoryTid)
    const factoryRef = factoryRows
      .map((row) => extractCreatedEventBlob(row as Parameters<typeof extractCreatedEventBlob>[0]))
      .find((ref) => ref !== undefined)
    if (factoryRef === undefined) {
      throw new Error('AmuletVestingFactory not found — run the amulet-vesting bootstrap')
    }

    const amuletCids = await this.selectAmuletCids(args.proposer, args.totalAmount)

    const command = buildAmuletCreateVestingCommand(this.factoryTid, factoryRef.contractId, {
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      amuletCids,
      note: composeNote(args.title, args.note),
    })

    await this.submit(args.proposer, command, [buildDisclosedContract(this.factoryTid, factoryRef)])

    return { disclosedBytes: factoryRef.createdEventBlob.length }
  }

  async accept(args: { receiver: string; proposalCid: string }): Promise<void> {
    const { arg, disclosures } = await this.loadTransferContext()
    const inputDisclosures = await this.discloseAcceptInputs(args.proposalCid)
    const command = buildAmuletAcceptCommand(this.proposalTid, args.proposalCid, arg)
    await this.submit(args.receiver, command, [...disclosures, ...inputDisclosures])
  }

  // ── discloseAcceptInputs ─────────────────────────────────────────────────────
  // AmuletVestingProposal_Accept is submitted by the receiver but self-transfers the
  // PROPOSER's input Amulets into the escrow. The receiver is not a stakeholder of those
  // Amulets, so they must be explicitly disclosed or the submission fails CONTRACT_NOT_FOUND.
  // Read the proposal (visible to the operator, always a signatory as provider) for its
  // amuletCids + proposer, then pull each input Amulet's createdEventBlob from the proposer's
  // ACS (operator-owned Amulets carry a non-empty blob, unlike DSO-signed AmuletRules).
  private async discloseAcceptInputs(proposalCid: string): Promise<DisclosedContract[]> {
    const proposalRows = await this.readAcs(this.operator, this.proposalTid)
    const proposal = proposalRows
      .map((row) => createdArg(row))
      .find((entry) => entry?.contractId === proposalCid)
    if (proposal === undefined) {
      throw new Error('AmuletVestingProposal not found for accept disclosure')
    }
    const amuletCids = Array.isArray(proposal.arg.amuletCids)
      ? (proposal.arg.amuletCids as string[])
      : []
    const proposer = String(proposal.arg.proposer ?? '')
    if (amuletCids.length === 0 || proposer === '') {
      return []
    }
    const wanted = new Set(amuletCids)
    const amuletRows = await this.readAcs(proposer, this.amuletTid)
    return amuletRows
      .map((row) => extractCreatedEventBlob(row as Parameters<typeof extractCreatedEventBlob>[0]))
      .filter((ref): ref is DisclosedRef => ref !== undefined && wanted.has(ref.contractId))
      .map((ref) => buildDisclosedContract(this.amuletTid, ref))
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: number }): Promise<void> {
    const { arg, disclosures } = await this.loadTransferContext()
    const command = buildAmuletWithdrawCommand(this.contractTid, args.contractCid, args.amount, arg)
    await this.submit(args.receiver, command, disclosures)
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    const { arg, disclosures } = await this.loadTransferContext()
    const command = buildAmuletCancelCommand(this.contractTid, args.contractCid, arg)
    await this.submit(args.creator, command, disclosures)
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: number }): Promise<void> {
    const { arg, disclosures } = await this.loadTransferContext()
    const command = buildAmuletClaimResidualCommand(this.claimTid, args.claimCid, args.amount, arg)
    await this.submit(args.receiver, command, disclosures)
  }

  // The party's total available Canton Coin = sum of its Amulet holdings. Backs the
  // create form's "Fund from" balance + over-funding guard.
  async availableFunds(party: string): Promise<number> {
    const holdings = await this.amuletHoldings(party)
    return holdings.reduce((sum, holding) => sum + holding.amount, 0)
  }

  // ── amuletHoldings ───────────────────────────────────────────────────────────
  // Reads a party's Amulet holdings as { contractId, amount }.
  //
  // ASSUMPTION [A5]: Amulet `amount` is a nested record `{ initialAmount: Decimal, ... }`
  // (ExpiringAmount in DAML). If the JSON-LF field is a flat Decimal, the extraction
  // falls back gracefully.
  //
  // LIMITATION: this reports `initialAmount`, the value at creation. An Amulet's
  // spendable value decays by the holding fee each round (the one non-zero fee CIP-78
  // permits), so the live balance is slightly lower. `selectAmuletCids` adds a buffer
  // holding to absorb that gap; `availableFunds` may still overstate by the accrued fee.
  private async amuletHoldings(party: string): Promise<{ contractId: string; amount: number }[]> {
    const rows = await this.readAcs(party, this.amuletTid)
    return rows
      .map((row) => {
        const event = row.contractEntry?.JsActiveContract?.createdEvent
        if (event?.contractId === undefined) {
          return undefined
        }
        const amountField = (event.createArgument as { amount?: unknown } | undefined)?.amount
        // ASSUMPTION [A5]: nested record. Fallback to flat if `initialAmount` absent.
        const initialAmount =
          amountField !== null &&
          typeof amountField === 'object' &&
          'initialAmount' in (amountField as object)
            ? Number((amountField as { initialAmount?: unknown }).initialAmount ?? 0)
            : Number(amountField ?? 0)
        return { contractId: event.contractId, amount: initialAmount }
      })
      .filter((h): h is { contractId: string; amount: number } => h !== undefined)
  }

  // Greedily selects Amulet holdings (largest first) whose sum >= requiredAmount. Once
  // the target is met it pulls in one extra holding when available: the reported amounts
  // are `initialAmount` (pre-decay), so an exact-fit set can fall short of the actual
  // transfer total by the accrued holding fee. The buffer makes the Accept resilient
  // without failing a funder who has only just enough.
  private async selectAmuletCids(party: string, requiredAmount: number): Promise<string[]> {
    const holdings = (await this.amuletHoldings(party)).sort((a, b) => b.amount - a.amount)

    const selected: string[] = []
    let accumulated = 0

    for (const holding of holdings) {
      const metTarget = accumulated >= requiredAmount
      if (metTarget && selected.length > 0) {
        // one holding of headroom past the target, then stop
        selected.push(holding.contractId)
        accumulated += holding.amount
        break
      }
      selected.push(holding.contractId)
      accumulated += holding.amount
    }

    if (accumulated < requiredAmount) {
      throw new Error(
        `Insufficient Amulet balance: need ${requiredAmount}, found ${accumulated} across ${holdings.length} holding(s)`,
      )
    }

    return selected
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Pull { contractId, createArgument } out of an active-contracts row (verbose read).
const createdArg = (
  row: AcsRow,
): { contractId: string; arg: Record<string, unknown> } | undefined => {
  const event = row.contractEntry?.JsActiveContract?.createdEvent
  if (event?.contractId === undefined || event.createArgument === undefined) {
    return undefined
  }
  return { contractId: event.contractId, arg: event.createArgument }
}

// Pick the OpenMiningRound with the highest round number that has already OPENED.
// round number lives at contract.payload.round.number (int as string in SCAN response);
// opensAt is the round's open instant. The highest-numbered round is frequently still
// pre-opening — using it aborts the transfer with 'deadline-not-exceeded' against
// openRound.opensAt — so rounds whose opensAt is in the future are skipped.
const pickLatestScanRound = (
  contracts: ScanMiningRoundContract[],
  synchronizerId: string | undefined,
): DisclosedRef | undefined => {
  const nowMs = Date.now()
  const candidates = contracts
    .map((contract) => {
      const cid = contract.contract_id
      const blob = contract.created_event_blob
      if (cid === undefined || blob === undefined || blob === '') {
        return undefined
      }
      const opensAtMs = Date.parse(contract.payload?.opensAt ?? '')
      if (Number.isNaN(opensAtMs) || opensAtMs > nowMs) {
        return undefined
      }
      const roundNum = Number(contract.payload?.round?.number ?? 0)
      return {
        ref: { contractId: cid, createdEventBlob: blob, synchronizerId } satisfies DisclosedRef,
        roundNum,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== undefined)

  if (candidates.length === 0) {
    return undefined
  }
  return candidates.reduce((best, c) => (c.roundNum > best.roundNum ? c : best)).ref
}
