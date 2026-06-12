// Maps a dApp ledger command + explicit disclosures onto canton-connect-kit's
// ExecuteParams. Pure (no React, no I/O) so it is unit-testable; the
// VestingDataProvider feeds the result to useExecute().execute().

import type { ExecuteParams } from 'canton-connect-kit'
import type { DisclosedContract, LedgerCommand } from './Wallet'

export const toExecuteParams = (
  actingParty: string,
  command: LedgerCommand,
  disclosed?: DisclosedContract[],
): ExecuteParams => {
  // Every disclosure in one submission shares a synchronizer (same domain);
  // surface it so prepareExecuteAndWait targets that domain explicitly.
  const synchronizerId = disclosed?.map((entry) => entry.synchronizerId).find(Boolean)
  return {
    commands: [command],
    actAs: [actingParty],
    readAs: [actingParty],
    ...(disclosed === undefined ? {} : { disclosedContracts: disclosed }),
    ...(synchronizerId === undefined || synchronizerId === '' ? {} : { synchronizerId }),
  }
}
