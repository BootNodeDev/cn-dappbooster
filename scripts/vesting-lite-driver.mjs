#!/usr/bin/env node
// Vesting Lite integration proof + live encoding check. Drives the full lifecycle
// through the wallet-service ledgerApi proxy against the upgraded `vesting-lite`
// package and asserts the demo's claims:
//   - explicit disclosure is REQUIRED (proposer can't use the observer-less factory without it)
//   - the lifecycle completes for BOTH a linear and a milestone schedule (factory -> proposal
//     -> accept -> claim), proving the JSON-LF VestingCurve variant round-trips on the ledger
//   - cancel is value-preserving: a mid-vesting cancel hands the beneficiary a VestedClaim of
//     owed = vested - claimed, which the beneficiary can then withdraw
//   - privacy holds (a bystander sees none of the contracts)
// Time is on-ledger getTime, so schedules are anchored relative to wall-clock now.
// Usage: PKG=<vesting-lite package-id> node scripts/vesting-lite-driver.mjs

const RPC_URL = process.env.RPC_URL ?? 'http://localhost:3010/rpc'
const PKG = process.env.PKG
if (!PKG) {
    throw new Error('set PKG=<vesting-lite package-id> (dpm damlc inspect-dar ... --json | .main_package_id)')
}
const FACTORY = `${PKG}:Vesting:VestingFactory`
const PROPOSAL = `${PKG}:Vesting:VestingProposal`
const CONTRACT = `${PKG}:Vesting:VestingContract`
const CLAIM = `${PKG}:Vesting:VestedClaim`
const STAMP = Date.now()

// Schedule builders matching the frontend's encodeSchedule (JSON-LF):
//   variant -> { tag, value }; tuple (Time, Decimal) -> { _1, _2 }; Time -> ISO; Decimal -> string.
const iso = (msFromNow) => new Date(STAMP + msFromNow).toISOString()
const linear = (startMs, endMs, cliffMs) => ({
    curve: { tag: 'LinearVesting', value: { start: iso(startMs), end: iso(endMs) } },
    cliff: iso(cliffMs),
})
const milestone = (points, cliffMs) => ({
    curve: { tag: 'MilestoneVesting', value: { points: points.map(([ms, fr]) => ({ _1: iso(ms), _2: fr })) } },
    cliff: iso(cliffMs),
})

const rpc = async (method, params) => {
    const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
    })
    const text = await response.text()
    const payload = JSON.parse(text)
    if (!response.ok || payload.error !== undefined) {
        const err = new Error(`${method} -> ${text.slice(0, 300)}`)
        err.detail = text
        throw err
    }
    return payload.result
}
const ledger = (requestMethod, resource, body) =>
    rpc('ledgerApi', { requestMethod, resource, ...(body === undefined ? {} : { body }) })

const createParty = async (hint) => {
    const res = await ledger('post', '/v2/parties', { partyIdHint: hint })
    const party = res?.partyDetails?.party
    await ledger('post', '/v2/users/wallet-service/rights', {
        userId: 'wallet-service',
        identityProviderId: '',
        rights: [{ kind: { CanActAs: { value: { party } } } }],
    })
    return party
}

const submit = (actAs, command, disclosed) =>
    ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
        commandId: `vesting-${STAMP}-${crypto.randomUUID().slice(0, 8)}`,
        actAs: [actAs],
        readAs: [actAs],
        commands: [command],
        ...(disclosed === undefined ? {} : { disclosedContracts: disclosed }),
    })

const exerciseResultOf = (tree) => {
    const events = tree?.transactionTree?.eventsById ?? {}
    for (const e of Object.values(events)) {
        if (e.ExercisedTreeEvent) {
            return e.ExercisedTreeEvent.value.exerciseResult
        }
        if (e.CreatedTreeEvent) {
            return e.CreatedTreeEvent.value.contractId
        }
    }
    return undefined
}

const readAcs = async (party, templateId) => {
    const end = await ledger('get', '/v2/state/ledger-end')
    const rows = await ledger('post', '/v2/state/active-contracts', {
        filter: {
            filtersByParty: {
                [party]: {
                    cumulative: [
                        {
                            identifierFilter: {
                                TemplateFilter: { value: { templateId, includeCreatedEventBlob: true } },
                            },
                        },
                    ],
                },
            },
        },
        activeAtOffset: end.offset,
        verbose: true,
    })
    return Array.isArray(rows) ? rows : []
}

const argOf = (row) => row?.contractEntry?.JsActiveContract?.createdEvent?.createArgument
const cidOf = (row) => row?.contractEntry?.JsActiveContract?.createdEvent?.contractId
const disclosedFromAcs = (row) => {
    const active = row.contractEntry?.JsActiveContract
    const ev = active?.createdEvent
    return { templateId: FACTORY, contractId: ev.contractId, createdEventBlob: ev.createdEventBlob, synchronizerId: active.synchronizerId }
}

let pass = 0
let fail = 0
const ok = (cond, label) => {
    if (cond) { pass++; console.log(`✅ ${label}`) }
    else { fail++; console.log(`❌ ${label}`) }
}
const expectThrow = async (label, fn) => {
    try {
        await fn()
        fail++
        console.log(`❌ ${label} (unexpectedly succeeded)`)
    } catch (e) {
        pass++
        console.log(`✅ ${label} (rejected: ${String(e.message).slice(0, 90)})`)
    }
}

const createVia = (proposer, beneficiary, total, schedule, factoryRef) =>
    submit(proposer, {
        ExerciseCommand: {
            templateId: FACTORY, contractId: factoryRef.contractId, choice: 'Factory_CreateVesting',
            choiceArgument: { proposer, beneficiary, total, schedule, note: null },
        },
    }, [factoryRef])
const accept = (beneficiary, proposalCid) =>
    submit(beneficiary, { ExerciseCommand: { templateId: PROPOSAL, contractId: proposalCid, choice: 'Proposal_Accept', choiceArgument: {} } })
const claim = (beneficiary, contractCid, amount) =>
    submit(beneficiary, { ExerciseCommand: { templateId: CONTRACT, contractId: contractCid, choice: 'Contract_Claim', choiceArgument: { amount } } })

const main = async () => {
    const provider = await createParty(`vesting-provider-${STAMP}`)
    const proposer = await createParty(`vesting-proposer-${STAMP}`)
    const beneficiary = await createParty(`vesting-beneficiary-${STAMP}`)
    const bystander = await createParty(`vesting-bystander-${STAMP}`)
    console.log('parties: provider/proposer/beneficiary/bystander created\n')

    // 1. provider creates the observer-less factory
    await submit(provider, { CreateCommand: { templateId: FACTORY, createArguments: { provider } } })
    const factoryRows = await readAcs(provider, FACTORY)
    ok(factoryRows.length >= 1, 'provider sees the factory')
    const factoryRef = disclosedFromAcs(factoryRows[0])

    // 2. proposer CANNOT use the observer-less factory without explicit disclosure
    const fullyVested = linear(-200_000, -100_000, -200_000) // start/end in the past -> vested == total
    await expectThrow('proposer create WITHOUT disclosure fails', () =>
        submit(proposer, { ExerciseCommand: { templateId: FACTORY, contractId: factoryRef.contractId, choice: 'Factory_CreateVesting', choiceArgument: { proposer, beneficiary, total: '1000', schedule: fullyVested, note: null } } }))

    // 3. LINEAR create via disclosure (proves the LinearVesting variant round-trips on the ledger)
    const linProposal = exerciseResultOf(await createVia(proposer, beneficiary, '1000', fullyVested, factoryRef))
    ok(typeof linProposal === 'string', 'linear: create proposal via disclosure (LinearVesting variant accepted)')
    const linContract = exerciseResultOf(await accept(beneficiary, linProposal))
    ok(typeof linContract === 'string', 'linear: beneficiary accepts -> contract')

    // dump the round-tripped schedule so the frontend decoder shape is visible
    const linArg = argOf((await readAcs(beneficiary, CONTRACT)).find((r) => argOf(r)))
    console.log(`   round-tripped schedule: ${JSON.stringify(linArg?.schedule)}`)
    ok(linArg?.schedule?.curve?.tag === 'LinearVesting', 'linear: ACS read decodes curve.tag = LinearVesting')

    // 4. over-claim past vested fails; then claim the full 1000 (fully vested)
    await expectThrow('linear: over-claim beyond vested fails', () => claim(beneficiary, linContract, '1001'))
    let c = exerciseResultOf(await claim(beneficiary, linContract, '600'))
    c = exerciseResultOf(await claim(beneficiary, c, '400'))
    const claimed = argOf((await readAcs(beneficiary, CONTRACT)).find((r) => argOf(r)?.total === '1000.0000000000'))?.claimed
    ok(claimed === '1000.0000000000', `linear: claimed reaches 1000 (got ${claimed})`)

    // 5. MILESTONE create (proves the MilestoneVesting variant round-trips); first point reached -> 40% vested
    const ms = milestone([[-100_000, '0.4'], [3_600_000, '1.0']], -100_000)
    const msProposal = exerciseResultOf(await createVia(proposer, beneficiary, '1000', ms, factoryRef))
    ok(typeof msProposal === 'string', 'milestone: create proposal via disclosure (MilestoneVesting variant accepted)')
    const msContract = exerciseResultOf(await accept(beneficiary, msProposal))
    await expectThrow('milestone: claim beyond reached fraction (500 > 400) fails', () => claim(beneficiary, msContract, '500'))
    const msAfter = exerciseResultOf(await claim(beneficiary, msContract, '400'))
    ok(typeof msAfter === 'string', 'milestone: claim 400 (the reached 40%) succeeds')

    // 6. cancel is value-preserving: fully-vested grant, claim 300, cancel -> VestedClaim owed 700
    const cancelProposal = exerciseResultOf(await createVia(proposer, beneficiary, '1000', fullyVested, factoryRef))
    const cancelContract = exerciseResultOf(await accept(beneficiary, cancelProposal))
    const cc = exerciseResultOf(await claim(beneficiary, cancelContract, '300'))
    await submit(proposer, { ExerciseCommand: { templateId: CONTRACT, contractId: cc, choice: 'Contract_Cancel', choiceArgument: {} } })
    const claimRows = await readAcs(beneficiary, CLAIM)
    const residual = claimRows.map(argOf).find((a) => a)
    ok(residual?.amount === '700.0000000000', `cancel: beneficiary gets a VestedClaim of owed=700 (got ${residual?.amount})`)
    // beneficiary withdraws the full residual -> claim archived
    const claimCid = claimRows.map(cidOf).find((id) => id)
    await submit(beneficiary, { ExerciseCommand: { templateId: CLAIM, contractId: claimCid, choice: 'Claim_Withdraw', choiceArgument: { withdrawAmount: '700' } } })
    ok((await readAcs(beneficiary, CLAIM)).length === 0, 'cancel: beneficiary withdraws the residual -> claim drained')

    // 7. privacy: a bystander sees none of the vesting contracts/proposals/claims
    const [bc, bp, bcl] = await Promise.all([readAcs(bystander, CONTRACT), readAcs(bystander, PROPOSAL), readAcs(bystander, CLAIM)])
    ok(bc.length === 0 && bp.length === 0 && bcl.length === 0, 'bystander sees 0 vesting contracts/proposals/claims')

    console.log(`\n${pass} passed, ${fail} failed`)
    if (fail > 0) {
        process.exit(1)
    }
}

main().catch((e) => {
    console.error(`FATAL: ${e.message}`)
    if (e.detail) {
        console.error(e.detail.slice(0, 600))
    }
    process.exit(1)
})
