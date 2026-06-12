// Submission seam. The dApp builds ledger commands + explicit disclosures and
// hands them to a SubmitFn, which signs and submits them as the acting party.
//
// Today the SubmitFn is backed by canton-connect-kit's useExecute() → Carpincho
// (external-key signing via prepareExecuteAndWait). ACS/SCAN reads do NOT go
// through here — they use the wallet-service /rpc sidecar (see AmuletBackend),
// because the connected external party cannot read the operator/DSO contracts
// the Amulet flow discloses.

// JSON Ledger API v2 command — always an ExerciseCommand in this dApp.
export type LedgerCommand = {
  ExerciseCommand: {
    templateId: string
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

// Explicitly-disclosed contract (JSON Ledger API v2 disclosedContracts entry).
export type DisclosedContract = {
  templateId: string
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
}

// Signs and submits a command as `actingParty`, carrying any explicit disclosures.
export type SubmitFn = (
  actingParty: string,
  command: LedgerCommand,
  disclosed?: DisclosedContract[],
) => Promise<unknown>
