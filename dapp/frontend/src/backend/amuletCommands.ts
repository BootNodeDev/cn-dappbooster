// Command builders for the 5 amulet-vesting choices. All argument record field
// names match the DAML definitions exactly (AmuletVesting.daml + AmuletRules.daml).
//
// AppTransferContext (Splice.AmuletRules):
//   { amuletRules: ContractId AmuletRules
//     openMiningRound: ContractId OpenMiningRound
//     featuredAppRight: Optional (ContractId FeaturedAppRight) }
//
// JSON-LF encoding: Optional None → null, Optional (Some x) → x (bare value).

import type { VestingSchedule } from '@/lib/schedule'
import { encodeSchedule } from './commands'

// The AppTransferContext record as passed in choiceArgument JSON.
export type AppTransferContextArg = {
  amuletRules: string
  openMiningRound: string
  featuredAppRight: string | null
}

// ── AmuletVestingFactory_CreateVesting (nonconsuming) ────────────────────────
// controller: proposer

type CreateVestingArgs = {
  proposer: string
  receiver: string
  totalAmount: number
  schedule: VestingSchedule
  note?: string
}

// Legacy choice field, kept for SCU upgrade compatibility. Coins are now chosen at
// accept time, so creation always passes an empty list.
const LEGACY_AMULET_CIDS: string[] = []

export const buildAmuletCreateVestingCommand = (
  factoryTid: string,
  factoryCid: string,
  args: CreateVestingArgs,
) => ({
  ExerciseCommand: {
    templateId: factoryTid,
    contractId: factoryCid,
    choice: 'AmuletVestingFactory_CreateVesting',
    choiceArgument: {
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: String(args.totalAmount),
      schedule: encodeSchedule(args.schedule),
      amuletCids: LEGACY_AMULET_CIDS,
      note: args.note ?? null,
    },
  },
})

// ── AmuletVestingProposal_Accept ─────────────────────────────────────────────
// controller: receiver

export const buildAmuletAcceptCommand = (
  proposalTid: string,
  proposalCid: string,
  ctx: AppTransferContextArg,
  inputAmuletCids: string[],
) => ({
  ExerciseCommand: {
    templateId: proposalTid,
    contractId: proposalCid,
    choice: 'AmuletVestingProposal_Accept',
    choiceArgument: { ctx, inputAmuletCids },
  },
})

// ── AmuletVestingContract_Withdraw ───────────────────────────────────────────
// controller: receiver

export const buildAmuletWithdrawCommand = (
  contractTid: string,
  contractCid: string,
  withdrawAmount: number,
  ctx: AppTransferContextArg,
) => ({
  ExerciseCommand: {
    templateId: contractTid,
    contractId: contractCid,
    choice: 'AmuletVestingContract_Withdraw',
    choiceArgument: {
      withdrawAmount: String(withdrawAmount),
      ctx,
    },
  },
})

// ── AmuletVestingContract_Cancel ─────────────────────────────────────────────
// controller: creator

export const buildAmuletCancelCommand = (
  contractTid: string,
  contractCid: string,
  ctx: AppTransferContextArg,
) => ({
  ExerciseCommand: {
    templateId: contractTid,
    contractId: contractCid,
    choice: 'AmuletVestingContract_Cancel',
    choiceArgument: { ctx },
  },
})

// ── AmuletVestedClaim_Withdraw ───────────────────────────────────────────────
// controller: receiver

export const buildAmuletClaimResidualCommand = (
  claimTid: string,
  claimCid: string,
  withdrawAmount: number,
  ctx: AppTransferContextArg,
) => ({
  ExerciseCommand: {
    templateId: claimTid,
    contractId: claimCid,
    choice: 'AmuletVestedClaim_Withdraw',
    choiceArgument: {
      withdrawAmount: String(withdrawAmount),
      ctx,
    },
  },
})
