// create a token
const CreateTokenTemplateId =
  "ffb33c88f9d1f5d5ad545523fa9fa72949a5c0c7d777fce5fa6f5f2444349806:RegistryToken.Holding:RegistryHolding";
const CreateTokenArgs = {
  instrumentId: {
    admin:
      "nico::12201fd6c1885a4c8655461213732915229e3abe9242ed9dba56c6eda38fe772e6ef",
    id: "pf2",
  },
  owner:
    "hackit::1220ff7e2e5a25c0a8fa368eae2fe2490f5628c6531d7fa8efb429c0c2001bfd1c83",
  amount: "5566.0",
};

//pf 5566

// Mint token
const MintTemplateID =
  "ffb33c88f9d1f5d5ad545523fa9fa72949a5c0c7d777fce5fa6f5f2444349806:RegistryToken.Registry:Registry";
const MintContractID =
  "0087f2d5a484774e8e4bc529650563358029f913de134710022a345c81da104267ca121220f790397bf412ae80369b682b192570284ea284d7a4e753ee4cfb51e8423150f0";
const Choice = "Mint";
const mintArgs = {
  owner:
    "hackit::1220ff7e2e5a25c0a8fa368eae2fe2490f5628c6531d7fa8efb429c0c2001bfd1c83",
  instrumentId: {
    admin:
      "nico::12201fd6c1885a4c8655461213732915229e3abe9242ed9dba56c6eda38fe772e6ef",
    id: "pf",
  },
  amount: "4",
};

// Transfer a token
const TransferTemplateID =
  "55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281:Splice.Api.Token.TransferInstructionV1:TransferFactory";
const TransferContractID = "";
const TransferArgs2 = {
  expectedAdmin:
    "a116449f21866350cd7c85496cfd41ef::12201e8a9366e1b8b68b55699d7812ed3f5c4fdb60fe677012ba2fe7f87f5653d83f",
  transfer: {
    sender: "<sender-party>",
    receiver: "<receiver-party>",
    amount: "10.0",
    instrumentId: {
      admin:
        "a116449f21866350cd7c85496cfd41ef::12201e8a9366e1b8b68b55699d7812ed3f5c4fdb60fe677012ba2fe7f87f5653d83f",
      id: "BNT",
    },
    requestedAt: "2026-06-13T00:00:00Z",
    executeBefore: "2026-06-20T00:00:00Z",
    inputHoldingCids: ["<sender-holding-cid>"],
    meta: { values: {} },
  },
  extraArgs: {
    context: { values: {} },
    meta: { values: {} },
  },
};
