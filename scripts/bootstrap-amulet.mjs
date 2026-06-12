#!/usr/bin/env node
/**
 * Bootstrap script for the Amulet vesting demo on Splice LocalNet.
 * Re-runnable: skips steps that are already done.
 */

import { createHmac } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const JSON_API = "http://localhost:3975";
const TAP_API  = "http://localhost:3903";
// rpcUrl written into amulet-parties.json: the dApp reads the ACS + SCAN context
// through the :3010 wallet-service container (canton-barebones compose).
const RPC_URL  = "http://localhost:3010/rpc";

// The app-provider party fingerprint is regenerated on every `canton builder reset`,
// so it is discovered at runtime from the participant's `app-provider` user (see
// resolveAppProviderParty in main). The env / literal below are only fallbacks.
let APP_PROVIDER_PARTY =
  process.env.APP_PROVIDER_PARTY ??
  "appprovider-localparty-1::1220e352fba014c1faedb9432b08021c34b1c4cbfd99f3cfda95a5f0a58027d1d53c";

// The amulet-vesting package id changes whenever the DAR is rebuilt, so prefer the
// PKG env (pass the id printed by `canton builder deploy`); fall back to the last-known.
const VESTING_PKG =
  process.env.PKG || "e4afada33a78374359383b769431ea68db6406181a368edaf818eb481a7a80a2";
const SPLICE_PKG =
  "90987abecbcb1d004b063ddfe3b4b5d46cf3814ce89114a86c8cd75ff3cb8a4b";

const FACTORY_TEMPLATE_ID = `${VESTING_PKG}:AmuletVesting:AmuletVestingFactory`;
const AMULET_TEMPLATE_ID  = `${SPLICE_PKG}:Splice.Amulet:Amulet`;
const HMAC_SECRET = "unsafe";

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function base64url(buf) {
  return buf.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mintToken(sub) {
  const header  = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify({
    sub,
    aud: "https://canton.network.global",
    exp: 9999999999,
  })));
  const sig = base64url(
    createHmac("sha256", HMAC_SECRET)
      .update(`${header}.${payload}`)
      .digest()
  );
  return `${header}.${payload}.${sig}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function api(method, path, body, token) {
  const url = `${JSON_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

async function get(path, token) { return api("GET", path, undefined, token); }
async function post(path, body, token) { return api("POST", path, body, token); }

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

function uniqueCmd() {
  return `bootstrap-amulet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getLedgerEnd(token) {
  const r = await get("/v2/state/ledger-end", token);
  if (!r.ok) throw new Error(`ledger-end failed: ${JSON.stringify(r.json)}`);
  return r.json.offset;
}

async function queryACS(party, templateSuffix, token) {
  const offset = await getLedgerEnd(token);
  const r = await post("/v2/state/active-contracts", {
    filter: {
      filtersByParty: {
        [party]: {
          cumulative: [{ Wildcard: {} }],
        },
      },
    },
    activeAtOffset: offset,
  }, token);
  if (!r.ok) throw new Error(`ACS query failed: ${JSON.stringify(r.json)}`);
  // Response is a JSON array, not an object with activeContracts
  const contracts = Array.isArray(r.json) ? r.json : (r.json.activeContracts ?? []);
  return contracts.filter(c => {
    const id =
      c?.contractEntry?.JsActiveContract?.createdEvent?.templateId ??
      c?.createdEvent?.templateId ??
      "";
    return id.includes(templateSuffix);
  });
}

function getCreatedEvent(c) {
  return (
    c?.contractEntry?.JsActiveContract?.createdEvent ??
    c?.createdEvent ??
    {}
  );
}

async function allocateParty(hint, displayName, token) {
  const r = await post("/v2/parties", { hint, displayName }, token);
  if (!r.ok) throw new Error(`allocate party failed: ${JSON.stringify(r.json)}`);
  return r.json.partyDetails?.party ?? r.json.party;
}

async function listParties(token) {
  const r = await get("/v2/parties", token);
  if (!r.ok) throw new Error(`list parties failed: ${JSON.stringify(r.json)}`);
  return r.json.partyDetails ?? [];
}

async function grantRights(userId, party, token) {
  const r = await post(`/v2/users/${userId}/rights`, {
    userId,
    rights: [{ kind: { CanActAs: { value: { party } } } }],
  }, token);
  if (!r.ok) throw new Error(`grant rights failed: ${JSON.stringify(r.json)}`);
  return r.json;
}

async function getUserRights(userId, token) {
  const r = await get(`/v2/users/${userId}/rights`, token);
  if (!r.ok) throw new Error(`get rights failed: ${JSON.stringify(r.json)}`);
  return r.json.rights ?? [];
}

async function tap(amount, token) {
  const res = await fetch(`${TAP_API}/api/validator/v0/wallet/tap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount: String(amount) }),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
}

async function submitAndWait(actAs, commands, token) {
  const r = await post("/v2/commands/submit-and-wait-for-transaction-tree", {
    actAs,
    readAs: [],
    commandId: uniqueCmd(),
    commands,
  }, token);
  return r;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "..");
const PARTIES_FILE = resolve(REPO_ROOT, "dapp/frontend/public/amulet-parties.json");

async function main() {
  console.log("=== Amulet vesting bootstrap ===\n");

  // --- 1. Mint tokens ---
  const ledgerToken = mintToken("ledger-api-user");
  const appToken    = mintToken("app-provider");
  console.log("[1] Minted JWT tokens for ledger-api-user and app-provider");

  // Resolve the app-provider party from the participant — it is regenerated on
  // every `canton builder reset`, so hardcoding it breaks a from-scratch run.
  const apUsers = await get("/v2/users", ledgerToken);
  const apUser = (apUsers.json?.users ?? []).find((u) => u.id === "app-provider");
  if (apUser?.primaryParty) {
    APP_PROVIDER_PARTY = apUser.primaryParty;
    console.log(`    Resolved app-provider party: ${APP_PROVIDER_PARTY}`);
  } else {
    console.log(`    WARN: could not resolve app-provider party; using fallback`);
  }

  // --- 2. Check / create AmuletVestingFactory ---
  console.log("\n[2] Looking for existing AmuletVestingFactory in app-provider ACS...");
  let factoryContractId;
  const existingFactories = await queryACS(APP_PROVIDER_PARTY, "AmuletVestingFactory", ledgerToken);
  if (existingFactories.length > 0) {
    factoryContractId = getCreatedEvent(existingFactories[0]).contractId;
    console.log(`    Found existing factory: ${factoryContractId}`);
  } else {
    console.log("    None found — creating AmuletVestingFactory...");
    const result = await submitAndWait(
      [APP_PROVIDER_PARTY],
      [{
        CreateCommand: {
          templateId: FACTORY_TEMPLATE_ID,
          createArguments: {
            factoryOwner: APP_PROVIDER_PARTY,
          },
        },
      }],
      ledgerToken,
    );
    if (!result.ok) {
      console.error("    ERROR creating factory:", JSON.stringify(result.json, null, 2));
      process.exit(1);
    }
    // v2 shape: { transactionTree: { eventsById: { "0": { CreatedTreeEvent: { value: { contractId } } } } } }
    const tree = result.json.transactionTree ?? result.json;
    const eventsById = tree.eventsById ?? {};
    let createdId;
    for (const ev of Object.values(eventsById)) {
      const cid =
        ev?.CreatedTreeEvent?.value?.contractId ??
        ev?.Created?.contractId ??
        ev?.created?.contractId;
      if (cid) { createdId = cid; break; }
    }
    if (!createdId) {
      console.error("    Could not extract contractId from response. Full response:");
      console.error(JSON.stringify(result.json, null, 2));
      process.exit(1);
    }
    factoryContractId = createdId;
    console.log(`    Created factory: ${factoryContractId}`);
  }

  // --- 3. Allocate receiver party ---
  // Re-runnable: persist receiver party in the config file so re-runs detect it.
  console.log("\n[3] Resolving amulet-receiver party...");
  let receiverParty;
  if (existsSync(PARTIES_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(PARTIES_FILE, "utf8"));
      if (existing.receiver) {
        receiverParty = existing.receiver;
        console.log(`    Found receiver in existing config: ${receiverParty}`);
      }
    } catch { /* ignore parse errors */ }
  }
  if (!receiverParty) {
    console.log("    Allocating new amulet-receiver party...");
    receiverParty = await allocateParty("amulet-receiver", "Amulet Receiver", ledgerToken);
    console.log(`    Allocated: ${receiverParty}`);
  }

  // Grant CanActAs on receiver to ledger-api-user if not already granted
  const currentRights = await getUserRights("ledger-api-user", ledgerToken);
  const alreadyGranted = currentRights.some(r =>
    r.kind?.CanActAs?.value?.party === receiverParty ||
    r.CanActAs?.party === receiverParty
  );
  if (alreadyGranted) {
    console.log("    ledger-api-user already has CanActAs on receiver");
  } else {
    console.log("    Granting CanActAs on receiver to ledger-api-user...");
    await grantRights("ledger-api-user", receiverParty, ledgerToken);
    console.log("    Granted.");
  }

  // --- 4. Check app-provider Amulet balance ---
  console.log("\n[4] Checking app-provider Amulet balance...");
  const amuletContracts = await queryACS(APP_PROVIDER_PARTY, "Splice.Amulet:Amulet", ledgerToken);
  const amuletBalance = amuletContracts.reduce((sum, c) => {
    const args = getCreatedEvent(c).createArgument ?? getCreatedEvent(c).createArguments ?? {};
    const amt = parseFloat(args?.amount?.initialAmount ?? 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  console.log(`    Found ${amuletContracts.length} Amulet contract(s), total ≈ ${amuletBalance} CC`);

  if (amuletContracts.length === 0) {
    console.log("    No Amulet found — tapping 500 CC...");
    const tapResult = await tap(500, appToken);
    if (!tapResult.ok) {
      console.error("    Tap failed:", tapResult.body);
    } else {
      console.log("    Tap succeeded:", tapResult.body);
    }
  }

  // --- 5. Write amulet-parties.json ---
  console.log("\n[5] Writing dapp/frontend/public/amulet-parties.json...");
  const partiesJson = {
    rpcUrl:    RPC_URL,
    pkg:       VESTING_PKG,
    splicePkg: SPLICE_PKG,
    operator:  APP_PROVIDER_PARTY,
    receiver:  receiverParty,
    factory:   factoryContractId,
  };
  writeFileSync(PARTIES_FILE, JSON.stringify(partiesJson, null, 2) + "\n");
  console.log("    Written:", PARTIES_FILE);

  // --- Summary ---
  console.log("\n=== Bootstrap complete ===");
  console.log(`Factory contractId : ${factoryContractId}`);
  console.log(`Receiver party     : ${receiverParty}`);
  console.log(`Amulet balance     : ~${amuletBalance} CC (${amuletContracts.length} contract(s))`);
  console.log(`amulet-parties.json:\n${JSON.stringify(partiesJson, null, 2)}`);
}

main().catch(err => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
