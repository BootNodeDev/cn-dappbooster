// Bootstraps the dark pool on a Canton ledger via the JSON Ledger API v2:
// allocate parties, (best-effort) grant the submitting user actAs, create the
// pool + the single admin-scoped registry contract, mint seed holdings, and
// write daml/dark-pool.bootstrap.json. Re-running allocates fresh parties; use
// a clean ledger or edit the emitted config to reuse.
import { writeFileSync } from 'node:fs'

const JSON_API = process.env.CANTON_JSON_API_URL ?? 'http://localhost:2975'
const TOKEN = process.env.CANTON_BACKEND_TOKEN
if (!TOKEN)
  throw new Error('CANTON_BACKEND_TOKEN is required (npm run canton:token -- ledger-api-user)')

const BASE_SYMBOL = process.env.DARK_POOL_BASE_SYMBOL ?? 'TTA'
const QUOTE_SYMBOL = process.env.DARK_POOL_QUOTE_SYMBOL ?? 'TTB'
const POOL_ID = process.env.DARK_POOL_POOL_ID ?? `${BASE_SYMBOL}-${QUOTE_SYMBOL}`
const SEED_AMOUNT = process.env.DARK_POOL_SEED_AMOUNT ?? '10000.0'

// Resolved at step 0; referenced by submit().
let USER_ID = 'ledger-api-user'

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

const call = async (method, path, body) => {
  const res = await fetch(`${JSON_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  return text.length ? JSON.parse(text) : {}
}

const allocateParty = async (hint) => {
  const r = await call('POST', '/v2/parties', { partyIdHint: hint, identityProviderId: '' })
  return r.partyDetails.party
}

// Submit a command set actAs `actAs`, return the resulting transaction events.
const submit = async (actAs, commands) => {
  const commandId = `bootstrap-${actAs.slice(0, 12)}-${process.hrtime.bigint()}`
  const r = await call('POST', '/v2/commands/submit-and-wait-for-transaction', {
    commands: { commandId, actAs: [actAs], userId: USER_ID, commands },
    transactionFormat: {
      eventFormat: {
        filtersByParty: {
          [actAs]: {
            cumulative: [
              { identifierFilter: { WildcardFilter: { includeCreatedEventBlob: false } } },
            ],
          },
        },
        verbose: true,
      },
      transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
    },
  })
  return r.transaction.events
}

const createdCid = (events, entitySuffix) => {
  for (const e of events) {
    const c = e.CreatedEvent
    if (c && c.templateId.endsWith(entitySuffix)) return c.contractId
  }
  throw new Error(`no CreatedEvent matching ${entitySuffix} in ${JSON.stringify(events)}`)
}

// --- 0. Resolve the submitting user (best-effort) ---
try {
  const me = await call('GET', '/v2/authenticated-user')
  USER_ID = me.user?.id ?? USER_ID
} catch (e) {
  console.warn(`authenticated-user lookup failed (${e.message}); using "${USER_ID}"`)
}
console.log(`submitting as user "${USER_ID}"`)

const grantActAs = async (party) => {
  try {
    await call('POST', `/v2/users/${encodeURIComponent(USER_ID)}/rights`, {
      userId: USER_ID,
      identityProviderId: '',
      rights: [{ kind: { CanActAs: { party } } }],
    })
  } catch (e) {
    console.warn(
      `grant CanActAs ${party} failed (${e.message}); continuing — the party-submitted commands below are the real actAs test`,
    )
  }
}

// --- 1. Parties ---
const venue = await allocateParty('darkpool-venue')
const admin = await allocateParty('darkpool-admin')
const alice = await allocateParty('darkpool-alice')
const bob = await allocateParty('darkpool-bob')
for (const p of [venue, admin, alice, bob]) await grantActAs(p)
console.log('parties:', { venue, admin, alice, bob })

// --- 2. The single admin-scoped registry contract (faucet + AllocationFactory) ---
const factoryCid = createdCid(
  await submit(admin, [
    {
      CreateCommand: {
        templateId: '#registry-token:RegistryToken:RegistryRules',
        createArguments: { admin },
      },
    },
  ]),
  ':RegistryToken:RegistryRules',
)

// --- 3. The pool, as venue ---
const base = { admin, id: BASE_SYMBOL }
const quote = { admin, id: QUOTE_SYMBOL }
const poolCid = createdCid(
  await submit(venue, [
    {
      CreateCommand: {
        templateId: '#dark-pool:DarkPool:DarkPool',
        createArguments: { venue, poolId: POOL_ID, base, quote, minFillFloor: '1.0' },
      },
    },
  ]),
  ':DarkPool:DarkPool',
)

// --- 4. Seed holdings: mint both instruments to alice and bob, as admin ---
const mint = (symbol, to) =>
  submit(admin, [
    {
      ExerciseCommand: {
        templateId: '#registry-token:RegistryToken:RegistryRules',
        contractId: factoryCid,
        choice: 'Mint',
        choiceArgument: { symbol, to, amount: SEED_AMOUNT },
      },
    },
  ])
for (const to of [alice, bob]) {
  await mint(BASE_SYMBOL, to)
  await mint(QUOTE_SYMBOL, to)
}

// --- 5. Emit the config the backend reads ---
const config = {
  jsonApiUrl: JSON_API,
  userId: USER_ID,
  parties: { venue, admin, traders: { alice, bob } },
  poolId: POOL_ID,
  instruments: { base, quote },
  factoryCid, // single admin-scoped AllocationFactory; both legs settle through it
  poolCid,
}
writeFileSync('daml/dark-pool.bootstrap.json', JSON.stringify(config, null, 2))
console.log('wrote daml/dark-pool.bootstrap.json')
console.log(JSON.stringify(config, null, 2))
