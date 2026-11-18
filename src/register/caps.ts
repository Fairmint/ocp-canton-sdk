/**
 * The OpenCapTable-v35 register's policy caps, as the ledger enforces them, and the SDK's own batch budget.
 *
 * Caps that operations can add up to are counted per transaction, across every operation of a `CapTable_Apply` or
 * `CapTable_Restate`, and the ledger refuses a transaction over any of them. The SDK also sizes each batch, counting
 * every input and created contract at its full payload, to at most {@link SDK_BATCH_BYTE_BUDGET}, because the counted
 * caps alone cannot price every payload.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/tree/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable
 */

/** Operations per `CapTable_Apply` (`Apply.maxOperationsPerApply`). */
export const MAX_OPERATIONS_PER_APPLY = 500;

/** Register contracts archived or created per `CapTable_Restate` (`Restate.maxContractsPerRestatement`). */
export const MAX_CONTRACTS_PER_RESTATEMENT = 500;

/** Contracts per `CapTable_Purge` (`CapTable.maxContractsPerPurge`). */
export const MAX_CONTRACTS_PER_PURGE = 500;

/** Lots per hold placement, settlement or consolidation (`Apply.maxLotsPerOperation`). */
export const MAX_LOTS_PER_OPERATION = 50;

/** Hold cancellations per `CapTable_CancelHolds` (`Holds.maxHoldCancellationsPerTransaction`). */
export const MAX_HOLD_CANCELLATIONS_PER_TRANSACTION = 50;

/** Open holds per security, voided settlement holds included (`State.maxHoldsPerSecurity`). */
export const MAX_HOLDS_PER_SECURITY = 32;

/** Recorded splits per stock class (`State.maxSplitsPerClass`). */
export const MAX_SPLITS_PER_CLASS = 64;

/** Stock classes per stock plan, checked when the plan is written (`References.maxClassesPerStockPlan`). */
export const MAX_CLASSES_PER_STOCK_PLAN = 16;

/** Explicit vesting tranches per security; a longer schedule stays on vesting terms plus a snapshot (`State.maxTranchesPerSecurity`). */
export const MAX_TRANCHES_PER_SECURITY = 1500;

/** Vesting tranches summed over the states and issuances a transaction reads or writes (`Book.maxTranchesPerTransaction`). */
export const MAX_TRANCHES_PER_TRANSACTION = 20000;

/** Writer-chosen IDs claimed per transaction (`Book.maxClaimsPerTransaction`). */
export const MAX_CLAIMS_PER_TRANSACTION = 500;

/** `OcfIdShard`s created per transaction, rewritten shards included (`Book.maxShardsCreatedPerTransaction`). */
export const MAX_SHARDS_CREATED_PER_TRANSACTION = 4096;

/** Claim hashes per `OcfIdShard`; the 65th splits it (`State.maxHashesPerShard`). */
export const MAX_HASHES_PER_SHARD = 64;

/**
 * Polymorphic references (a document's related objects, a financing's issuances and capitalization-definition
 * targets) checked per transaction (`Book.maxPolymorphicReferencesPerTransaction`).
 */
export const MAX_POLYMORPHIC_REFERENCES_PER_TRANSACTION = 100;

/**
 * Polymorphic references one record stores (`References.maxStoredPolymorphicReferences`). A larger financing or
 * document is created and then extended by restatements that check only the references they add.
 */
export const MAX_STORED_POLYMORPHIC_REFERENCES = 1000;

/** The most bytes the SDK puts in one batch, counting every input and created contract at its full payload: 8 MiB. */
export const SDK_BATCH_BYTE_BUDGET = 8 * 1024 * 1024;

/** The synchronizer's default `maxRequestSize`, the limit on a transaction's confirmation request. */
export const DEFAULT_MAX_REQUEST_SIZE = 10_485_760;
