/**
 * Native mirrors of the OpenCapTable-v35 register's ledger state.
 *
 * Each type keeps the Daml field names of its template or record in `Fairmint.OpenCapTable.State` (snake_case, as
 * the native OCF types do), so a reader can compare it with the ledger field by field. Decimals are canonical decimal
 * strings, dates are `YYYY-MM-DD`, Daml `Int`s are safe integers and a Daml `Optional` is `null` when absent. The
 * generated Daml types stay behind the package boundary; `src/register` holds the rules that operate on these.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/State.daml
 */

import type { OcpContractError } from '../errors/OcpContractError';
import type { OcpValidationError } from '../errors/OcpValidationError';
import type {
  OcfCreatableEntityType,
  OcfDataTypeFor,
  OcfEditableEntityType,
  OcfEntityType,
} from '../functions/OpenCapTable/capTable/entityTypes';
import type { CommandWithDisclosedContracts, SubmitAndWaitForTransactionResponse } from './common';
import type {
  HoldType,
  Monetary,
  OcfObjectType,
  OcfStakeholder,
  OcfStockCancellation,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockReissuance,
  OcfStockRepurchase,
  OcfStockTransfer,
  SecurityExemption,
  Vesting,
} from './native';

/** The identity every register contract carries (`Fairmint.OpenCapTable.Types.Core.Context`). */
export interface RegisterContext {
  /** `<factory_id>-<n>`, from the factory's counter */
  cap_table_id: string;
  issuer: string;
  system_operator: string;
  transfer_agent: string;
}

/** The two ID namespaces: OCF object IDs, unique across every object type, and security IDs, unique across instruments. */
export type IdNamespace = 'object' | 'security';

/**
 * The fixed vocabulary of derived-ID roles (`Fairmint.OpenCapTable.Ids.DerivedRole`, by its tag). An event on a stock
 * security's state derives each ID it writes from the state's security ID and `seq`, the role and an index.
 */
export type DerivedRole =
  | 'event'
  | 'hold'
  | 'hold_cancellation'
  | 'resulting_issuance'
  | 'resulting_security'
  | 'balance_issuance'
  | 'balance_security';

/** A split ratio: new shares per old share (`OcfRatio`). Both sides are positive on a recorded split. */
export interface SplitRatio {
  numerator: string;
  denominator: string;
}

/**
 * A hold open on a stock security (`OpenHold`). A `REGISTER_SETTLEMENT` hold puts some of the security's vested shares
 * on hold for one trade; a `STOP_TRANSFER` hold holds the whole security for a case or order.
 */
export interface OpenHold {
  /** The `TX_STOCK_HOLD` that placed it */
  hold_id: string;
  hold_type: HoldType;
  /** The settlement ID, or the stop's case or order reference */
  reference: string;
  /** The class's splits dated on or before the hold's date */
  split_epoch: number;
  /** Positive for `REGISTER_SETTLEMENT`, `null` for `STOP_TRANSFER`; never rescaled by a split */
  quantity: string | null;
}

/** Set only on the buyer's state that `CapTable_Settle` creates; every successor clears it (`Delivery`). */
export interface Delivery {
  /** The settlement ID */
  reference: string;
  /** The stakeholder that delivered the shares */
  seller_stakeholder_id: string;
  /** The `TX_STOCK_TRANSFER` that delivered them */
  transfer_id: string;
}

/**
 * How a security vests (`StockVesting`): fully vested, explicit OCF tranches sorted by date, or vesting terms whose
 * vested quantity is the TA's snapshot.
 */
export type StockVesting =
  { kind: 'none' } | { kind: 'tranches'; tranches: Vesting[] } | { kind: 'on_terms'; vesting_terms_id: string };

/**
 * The TA's record of how much of a security on vesting terms has vested (`VestedSnapshot`): monotone, at most the
 * quantity, in the security's current units.
 */
export interface VestedSnapshot {
  as_of: string;
  vested: string;
}

/**
 * The one consumable state of an outstanding stock security (the `StockSecurity` template). Every event on the
 * security consumes it and creates at most one successor; it names a stakeholder, never a holder party.
 */
export interface StockSecurityState {
  context: RegisterContext;
  security_id: string;
  issue_date: string;
  last_event_date: string;
  /** The OCF record that created this security */
  origin_transaction_id: string;
  /** Positive, in the units of the splits the state has applied */
  quantity: string;
  /** Security-level events so far */
  seq: number;
  /** The class's splits dated on or before `last_event_date` */
  split_epoch: number;
  stakeholder_id: string;
  stock_class_id: string;
  vesting: StockVesting;
  /** At most 32, voided ones included, with distinct references; at most one `REGISTER_SETTLEMENT` */
  holds: OpenHold[];
  delivery: Delivery | null;
  snapshot: VestedSnapshot | null;
  /** On vesting terms: shares accelerated since the snapshot, which bound later accelerations until the next one */
  accelerated_since_snapshot: string | null;
  /** Whether an event derived an ID from this security, which a reissue under the same security ID would derive again */
  derived_ids: boolean;
}

/** A split recorded on a class's epoch (`RecordedSplit`). */
export interface RecordedSplit {
  /** The `TX_STOCK_CLASS_SPLIT` */
  split_id: string;
  date: string;
  ratio: SplitRatio;
}

/**
 * A class's split list and freeze flag (the `StockClassEpoch` template), kept apart from its `StockClass` so that a
 * class edit does not fail trades in flight.
 */
export interface StockClassEpochState {
  context: RegisterContext;
  stock_class_id: string;
  frozen: boolean;
  /** Dates strictly increase; at most 64 */
  splits: RecordedSplit[];
}

/** One cell of the partition of the claim-hash space by bit prefix (the `OcfIdShard` template). */
export interface OcfIdShardState {
  context: RegisterContext;
  /** Leading bits of the hashes it covers, as "0" and "1"; at least 8 */
  prefix: string;
  /** At most 64 claim hashes, each 64 lowercase hex characters */
  claimed: string[];
}

/** The anchor's status (`CapTableStatus`): Active, then tearing down, then closed. */
export type CapTableStatus = 'ACTIVE' | 'TEARING_DOWN' | 'CLOSED';

/**
 * How an output issuance of a terminal event vests, from its OCF record (`VestingState.OutputVesting`): explicit
 * `vestings`, else vesting terms (unvested until the TA records a snapshot), else fully vested.
 */
export interface OutputVesting {
  quantity: string;
  vestings: Vesting[];
  on_terms: boolean;
}

/** What `deriveId` hashes: the event's security, the state's `seq` before the event, the role and an index. */
export interface DeriveIdInput {
  capTableId: string;
  securityId: string;
  /** The state's `seq` before the event; a non-negative safe integer */
  seq: number;
  role: DerivedRole;
  /** The output's position for the resulting roles, otherwise 0; a non-negative safe integer */
  index: number;
}

/**
 * The `OcfIdShard`s of one write's working set, by prefix, with the claim hashes each holds. Like the ledger's book,
 * it needs only the shards that cover the hashes the write claims or releases.
 */
export type ClaimedShards = ReadonlyMap<string, ReadonlySet<string>>;

/** One claim, release or pre-split applied to a working set of shards, as the ledger applies it. */
export interface ShardStep {
  /** The working set after the step */
  shards: Map<string, ReadonlySet<string>>;
  /** The prefix of the shard the step archives */
  consumed: string;
  /** The prefixes of the shards the step creates in its place, in prefix order; each counts toward the per-transaction cap */
  created: string[];
}

/** The outcome of a register rule the ledger evaluates to `Either Text a`: its value, or the ledger's refusal. */
export type RegisterResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

/** The outcome of a register check the ledger evaluates to `Either Text ()`. */
export type RegisterCheckResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

// ===== Reader and key index =====

/** Where a register contract sits on the ledger: its contract, template and the offset that created it. */
export interface RegisterContractRef {
  contractId: string;
  /** As the Ledger API returns it (package-id form) */
  templateId: string;
  /** The offset of the transaction that created the contract */
  createdOffset: number;
}

/** A cap table's anchor (the `CapTable` template): its identity is the book's `Context`. */
export interface RegisterAnchor extends RegisterContractRef {
  status: CapTableStatus;
}

/** One OCF record of a book, keyed by its object ID. */
export type RegisterRecord = {
  [EntityType in OcfEntityType]: RegisterRecordOf<EntityType>;
}[OcfEntityType];

/** One OCF record of a given entity kind. */
export interface RegisterRecordOf<EntityType extends OcfEntityType> extends RegisterContractRef {
  entityType: EntityType;
  objectId: string;
  objectType: OcfObjectType;
  /** Every security ID the record names, as its `OcfObject` view lists them */
  securityIds: string[];
  /** The record as native OCF; `null` when the index was read with `retainPayloads: false` */
  data: OcfDataTypeFor<EntityType> | null;
}

/** An active `StockSecurity`: the one consumable state of an outstanding stock security. */
export interface RegisterState extends RegisterContractRef {
  state: StockSecurityState;
}

/** An active `StockClassEpoch`: a class's split list and freeze flag. */
export interface RegisterEpoch extends RegisterContractRef {
  epoch: StockClassEpochState;
}

/** An active `OcfIdShard`: one cell of the partition of claimed IDs. */
export interface RegisterShard extends RegisterContractRef {
  shard: OcfIdShardState;
}

/** A hold open on a security, with whether a split dated on or before the read date voids it. */
export interface RegisterOpenHold extends OpenHold {
  voided: boolean;
}

/** A contract the reader admitted, with the `Context` of the book it belongs to. */
export type AdmittedRegisterContract =
  | { readonly kind: 'anchor'; readonly context: RegisterContext; readonly contract: RegisterAnchor }
  | { readonly kind: 'record'; readonly context: RegisterContext; readonly contract: RegisterRecord }
  | { readonly kind: 'state'; readonly context: RegisterContext; readonly contract: RegisterState }
  | { readonly kind: 'epoch'; readonly context: RegisterContext; readonly contract: RegisterEpoch }
  | { readonly kind: 'shard'; readonly context: RegisterContext; readonly contract: RegisterShard };

/**
 * Why the reader indexed a contract in no book. Any package can implement the reader interfaces with a copied view,
 * so the reader admits a contract only if every rule holds:
 *
 * - `invalid_event`: the created event is not a well-formed Ledger API created event.
 * - `wrong_package`: its package name is not `OpenCapTable-v35`.
 * - `unknown_template`: its module and entity are none of the register's 55 templates.
 * - `invalid_payload`: its payload does not decode through its generated codec, or not to native types.
 * - `missing_view`, `invalid_view`: the matching `OcfObject` or `RegisterContract` view is absent, failed, or does not
 *   decode.
 * - `view_mismatch`: the view's `cap_table_id` (or a register contract's `kind` and `key`) differs from the payload.
 * - `wrong_signatories`: its signatories are not exactly the issuer, `system_operator` and TA of its `Context`, three
 *   distinct parties.
 * - `record_mismatch`: an OCF record's view names another object ID, object type or set of security IDs.
 * - `foreign_context`: its `cap_table_id` is a book's, but its parties are not that book's anchor's.
 * - `duplicate_anchor`: two anchors share its `cap_table_id`, so no book under it is trusted.
 */
export type RegisterRejectionReason =
  | 'invalid_event'
  | 'wrong_package'
  | 'unknown_template'
  | 'invalid_payload'
  | 'missing_view'
  | 'invalid_view'
  | 'view_mismatch'
  | 'wrong_signatories'
  | 'record_mismatch'
  | 'foreign_context'
  | 'duplicate_anchor';

/** A contract the reader read but indexed in no book. */
export interface RegisterRejectedContract {
  contractId: string;
  templateId: string | null;
  packageName: string | null;
  /** The cap table its payload or view names, when either is readable */
  capTableId: string | null;
  reason: RegisterRejectionReason;
  message: string;
}

/**
 * Something the reader noticed that does not stop it from indexing a contract:
 *
 * - `package_id`: a contract of a package ID other than the bundled one (an upgrade keeps the package name).
 * - `incomplete_reassignment`: a contract the snapshot shows mid-reassignment between synchronizers, left out.
 */
export interface RegisterReadWarning {
  kind: 'package_id' | 'incomplete_reassignment';
  contractId: string;
  templateId: string | null;
  message: string;
}

/**
 * Something the key index found wrong with a book. A genuine book has none: each one means a write outside the package
 * choices, a faulty writer, or a reader that cannot decode part of the book.
 */
export type RegisterIndexFlag =
  /** No anchor carries this `Context` */
  | { readonly kind: 'missing_anchor' }
  /** More than one anchor carries this `Context` */
  | { readonly kind: 'duplicate_anchor'; readonly contractIds: string[] }
  /** Two records share an object ID */
  | { readonly kind: 'duplicate_object_id'; readonly objectId: string; readonly contractIds: string[] }
  /** Two issuances, of any instruments, share a security ID */
  | { readonly kind: 'duplicate_security_id'; readonly securityId: string; readonly contractIds: string[] }
  /** More than one active state for one security */
  | { readonly kind: 'duplicate_state'; readonly securityId: string; readonly contractIds: string[] }
  /** More than one epoch for one class */
  | { readonly kind: 'duplicate_epoch'; readonly stockClassId: string; readonly contractIds: string[] }
  /** Two shards cover overlapping parts of the claim-hash space (one prefix starts the other, or they are equal) */
  | { readonly kind: 'overlapping_shards'; readonly prefixes: [string, string]; readonly contractIds: [string, string] }
  /** The shards' prefixes leave part of the claim-hash space uncovered */
  | { readonly kind: 'incomplete_shard_partition'; readonly shardCount: number }
  /** A state whose `origin_transaction_id` names no record on the book */
  | {
      readonly kind: 'missing_origin';
      readonly securityId: string;
      readonly originTransactionId: string;
      readonly contractId: string;
    }
  /** A state whose `seq` is below the number of non-terminal event records naming its security */
  | {
      readonly kind: 'seq_below_event_records';
      readonly securityId: string;
      readonly seq: number;
      readonly eventRecords: number;
      readonly contractId: string;
    }
  /** A contract signed by this book's three parties that the reader could not admit, so the book reads incomplete */
  | {
      readonly kind: 'unreadable_contract';
      readonly contractId: string;
      readonly templateId: string | null;
      readonly reason: RegisterRejectionReason;
      readonly message: string;
    };

/** A Ledger API created event, as the active contract set and ledger-effects transactions deliver it. */
export interface RegisterCreatedEvent {
  contractId: string;
  templateId: string;
  packageName?: string;
  createArgument: unknown;
  signatories: readonly string[];
  /** The offset of the transaction that created the contract */
  offset: number;
  interfaceViews?: ReadonlyArray<{
    interfaceId: string;
    viewStatus?: { code: number; message?: string };
    viewValue?: unknown;
  }>;
}

/**
 * A ledger-effects transaction, read with the reader's event format (both reader interfaces, views included), whose
 * created and consumed contracts `register.RegisterIndex.applyTransaction` applies. The Ledger API client's
 * `SubmitAndWaitForTransactionResponse['transaction']` is one.
 */
export interface RegisterTransaction {
  offset: number;
  updateId?: string;
  events: ReadonlyArray<
    | { CreatedEvent: RegisterCreatedEvent }
    | { ArchivedEvent: { contractId: string } }
    | { ExercisedEvent: { contractId: string; consuming: boolean } }
  >;
}

/** What applying a transaction changed in a key index. */
export interface RegisterTransactionResult {
  /** False when the transaction's offset is not after the index's, so it was already applied */
  applied: boolean;
  /** Contracts of this book the transaction created and the index admitted */
  created: number;
  /** Contracts of this book the transaction consumed */
  consumed: number;
  /** Contracts of this book's cap table the transaction created that the index did not admit */
  rejected: RegisterRejectedContract[];
}

// ===== Anchor choices =====
//
// The arguments and results of the `CapTable` anchor's choices (`CapTable.daml`, `Apply.daml`, `Restate.daml`,
// `Holds.daml`). Daml records the choices take or return keep their Daml field names; the SDK's own envelopes around
// them (operation kinds, builder parameters) are camelCase. Contract IDs are strings.

/**
 * A built anchor command, ready to submit as `actAs`. Every anchor choice has one controller and fetches only contracts
 * its controller signs, so none is disclosed.
 */
export interface CapTableCommand extends CommandWithDisclosedContracts {
  /** The choice's controller: the transfer agent, or `system_operator` for `CapTable_Purge` and `CapTable_Close` */
  readonly actAs: string[];
}

/** An OCF record contract of a book (`OcfRecordCid`): its entity kind names the template. */
export interface RegisterRecordRef {
  entityType: OcfEntityType;
  contractId: string;
}

/**
 * The existing contracts a write reads or changes (`Book.BookInputs`). Operations name everything else by OCF ID, and
 * the ledger fetches each contract here by its template and checks it belongs to the cap table.
 */
export interface BookInputs {
  /** `StockSecurity` states the write consumes or reads */
  states: string[];
  /** `StockClassEpoch`s of the classes whose stock states the write creates or changes, or whose splits it records */
  epochs: string[];
  /** The `OcfIdShard`s that cover the IDs the write claims or releases */
  shards: string[];
  /** OCF records the write's references point at, and the records a restatement edits or deletes */
  records: RegisterRecordRef[];
}

/**
 * The stock events `CapTable_Apply` writes only with their output issuances, so each consumes its source's state and
 * creates its outputs atomically. None is ever written as a plain record.
 */
export type BundledStockEventEntityType =
  | 'stockTransfer'
  | 'stockCancellation'
  | 'stockRepurchase'
  | 'stockConversion'
  | 'stockReissuance'
  | 'stockConsolidation';

/**
 * The entity kinds `CapTable_Apply` writes as a plain record (`ApplyRecord`): every kind but the issuer (written with
 * the cap table, edited by `CapTable_Restate`), the hold pair (the hold choices write it) and the bundled stock events.
 */
export type ApplyRecordEntityType = Exclude<OcfCreatableEntityType, BundledStockEventEntityType>;

/** A plain OCF record of a `CapTable_Apply` batch: definitions, issuances, class- and plan-level records and events. */
export type ApplyRecordOperation = {
  [EntityType in ApplyRecordEntityType]: { kind: 'record'; type: EntityType; data: OcfDataTypeFor<EntityType> };
}[ApplyRecordEntityType];

/** A stock transfer with its resulting issuances, in the transfer's order, and its balance when shares remain. */
export interface ApplyStockTransferOperation {
  kind: 'stockTransfer';
  transfer: OcfStockTransfer;
  resulting: OcfStockIssuance[];
  balance?: OcfStockIssuance | null;
}

/** A stock cancellation, with its balance when shares remain. */
export interface ApplyStockCancellationOperation {
  kind: 'stockCancellation';
  cancellation: OcfStockCancellation;
  balance?: OcfStockIssuance | null;
}

/** A stock repurchase, with its balance when shares remain. */
export interface ApplyStockRepurchaseOperation {
  kind: 'stockRepurchase';
  repurchase: OcfStockRepurchase;
  balance?: OcfStockIssuance | null;
}

/** A stock conversion with its resulting issuances, in the conversion's order, and its balance when shares remain. */
export interface ApplyStockConversionOperation {
  kind: 'stockConversion';
  conversion: OcfStockConversion;
  resulting: OcfStockIssuance[];
  balance?: OcfStockIssuance | null;
}

/** A stock reissuance of a whole security, with its resulting issuances in the reissuance's order. */
export interface ApplyStockReissuanceOperation {
  kind: 'stockReissuance';
  reissuance: OcfStockReissuance;
  resulting: OcfStockIssuance[];
}

/** A stock consolidation of up to 50 securities of one stakeholder and class, with its one resulting issuance. */
export interface ApplyStockConsolidationOperation {
  kind: 'stockConsolidation';
  consolidation: OcfStockConsolidation;
  resultingIssuance: OcfStockIssuance;
}

/** The TA's vested quantity of a security on vesting terms as of a date (`ApplyVestingSnapshot`). Monotone. */
export interface ApplyVestingSnapshotOperation {
  kind: 'vestingSnapshot';
  securityId: string;
  /** `YYYY-MM-DD` */
  asOf: string;
  vested: string;
}

/** Splits an ID shard by its next bit, ahead of a large book's replication (`ApplyPreSplitShard`). */
export interface ApplyPreSplitShardOperation {
  kind: 'preSplitShard';
  /** The shard's prefix: at least 8 bits, as "0" and "1" */
  prefix: string;
}

/** One operation of a `CapTable_Apply` batch (`Apply.ApplyOperation`). */
export type ApplyOperation =
  | ApplyRecordOperation
  | ApplyStockTransferOperation
  | ApplyStockCancellationOperation
  | ApplyStockRepurchaseOperation
  | ApplyStockConversionOperation
  | ApplyStockReissuanceOperation
  | ApplyStockConsolidationOperation
  | ApplyVestingSnapshotOperation
  | ApplyPreSplitShardOperation;

/**
 * A stock state as a restatement sets it (`Restate.StateRestatement`), in the units of the splits on or before its
 * `last_event_date`.
 */
export interface StateRestatement {
  security_id: string;
  issue_date: string;
  last_event_date: string;
  origin_transaction_id: string;
  quantity: string;
  stakeholder_id: string;
  stock_class_id: string;
  vesting: StockVesting;
  snapshot: VestedSnapshot | null;
  /**
   * Always stated, as the snapshot it adds to is: the shares of a lot on vesting terms accelerated since the snapshot,
   * which bound later accelerations; `null` for none.
   */
  accelerated_since_snapshot: string | null;
  /**
   * Only to recreate the state of a security whose consuming record the restatement deletes: it must exceed the `seq`
   * of the state that record ended, read from the ledger. Omitted (or `null`) for the successor of an active state.
   */
  seq?: number | null;
}

/** An edit of a record (among the inputs) under its type and OCF ID (`RestateEdit`). */
export type RestateEditOperation = {
  [EntityType in OcfEditableEntityType]: { kind: 'edit'; type: EntityType; data: OcfDataTypeFor<EntityType> };
}[OcfEditableEntityType];

/** One operation of a `CapTable_Restate` (`Restate.RestateOperation`). */
export type RestateOperation =
  | RestateEditOperation
  /** Deletes a record (among the inputs) by object ID and releases the ID (`RestateDelete`) */
  | { kind: 'delete'; objectId: string }
  /** Replaces a security's state with its successor, or recreates one (`RestateSetState`) */
  | { kind: 'setState'; state: StateRestatement }
  /** Ends a security's state, with the deletion of its origin issuance in the restatement (`RestateEndState`) */
  | { kind: 'endState'; securityId: string };

/** A lot to place one hold on (`Holds.PlaceHoldLot`). */
export interface PlaceHoldLot {
  security_id: string;
  /** `REGISTER_SETTLEMENT`: positive and at most the lot's vested shares; absent for `STOP_TRANSFER` */
  quantity?: string | null;
  /** `REGISTER_SETTLEMENT`: the security's origin `TX_STOCK_ISSUANCE` contract; absent for `STOP_TRANSFER` */
  origin_issuance?: string | null;
}

/** A whole hold to cancel, current or voided, settlement or stop (`Holds.CancelHold`). */
export interface CancelHold {
  security_id: string;
  hold_id: string;
  reason_text: string;
}

/** A draw of shares on hold under a settlement (`Holds.DrawLot`); {@link PlannedDraw} computes one. */
export interface DrawLot {
  security_id: string;
  /** The lot's `REGISTER_SETTLEMENT` hold under the settlement */
  hold_id: string;
  /** Shares drawn: positive, at most the hold's quantity */
  quantity: string;
  /** The buyer's issuance's custom ID */
  custom_id: string;
  /** Price per share, in the trade's currency */
  share_price: Monetary;
  /** The share price times the quantity, rounded half-even at scale 10, in the share price's currency */
  buyer_cost_basis: Monetary;
  /** The origin's cost basis times remaining / quantity, floored; `null` if the origin has none or nothing remains */
  balance_cost_basis: Monetary | null;
  /** A lot on vesting terms: the balance's remaining vesting as explicit tranches; otherwise empty */
  balance_vestings: Vesting[];
  /** The lot's origin `TX_STOCK_ISSUANCE` contract */
  origin_issuance: string;
}

/** One lot of a settlement: a draw, or the cancellation of a hold the trade does not draw (`Holds.SettleLot`). */
export type SettleLot = { kind: 'draw'; lot: DrawLot } | { kind: 'cancel'; hold: CancelHold };

/** The buyer's stakeholder: an existing record, or a new one the settlement creates and claims (`Holds.SettleBuyer`). */
export type SettleBuyer = { kind: 'existing'; contractId: string } | { kind: 'new'; stakeholder: OcfStakeholder };

/** A contract `CapTable_Purge` archives (`CapTable.PurgeTarget`). */
export type PurgeTarget =
  | { kind: 'record'; entityType: OcfEntityType; contractId: string }
  | { kind: 'state' | 'epoch' | 'shard'; contractId: string };

/** What `CapTable_Apply` or `CapTable_Restate` created, each map in key order. */
export interface BookWriteResult {
  /** The OCF records created, by object ID */
  records: ReadonlyMap<string, RegisterRecordRef>;
  /** The stock states created, by security ID */
  states: ReadonlyMap<string, string>;
  /** The epochs created, by stock class ID */
  epochs: ReadonlyMap<string, string>;
  /** The ID shards created, by prefix */
  shards: ReadonlyMap<string, string>;
}

/** What a submitted `CapTable_Apply` or `CapTable_Restate` created, with its update. */
export interface BookWriteExecuteResult extends BookWriteResult {
  updateId: string;
  /** The submission's ledger-effects transaction */
  response: SubmitAndWaitForTransactionResponse;
}

/** Debugging metadata of one queued operation of a `CapTable_Apply` or `CapTable_Restate` batch. */
export interface CapTableOperationMeta {
  /** The operation's position in the batch */
  index: number;
  kind: ApplyOperation['kind'] | RestateOperation['kind'];
  /** The OCF entity kind the operation writes, when it writes one */
  entityType?: OcfEntityType;
  /** The OCF object ID it writes or deletes, or the shard prefix it splits */
  id?: string;
  /** The security it is on */
  securityId?: string;
}

/**
 * A failed `CapTable_Apply` or `CapTable_Restate` submission. Its `code` is the submission's (`OUTCOME_UNKNOWN` when the
 * ledger may have committed it, `CHOICE_FAILED` otherwise), its `cause` the transport's error, and `operations` lists
 * the batch's operations.
 */
export type CapTableWriteError = OcpContractError & { readonly operations?: readonly CapTableOperationMeta[] };

/** The settlement hold a stop canceled (`Holds.CanceledSettlementHold`). */
export interface CanceledSettlementHold {
  hold_id: string;
  reference: string;
  hold_cancellation_id: string;
}

/** One placed hold (`Holds.PlaceHoldResult`). */
export interface PlaceHoldResult {
  hold_id: string;
  security_id: string;
  stakeholder_id: string;
  stock_class_id: string;
  /** The class's splits dated on or before the hold's date */
  split_epoch: number;
  /** `REGISTER_SETTLEMENT`: the origin issuance's legends, for the desk's restriction-bucket check; else empty */
  stock_legend_ids: string[];
  /** `REGISTER_SETTLEMENT`: the origin issuance's exemptions; else empty */
  security_law_exemptions: SecurityExemption[];
  /** `STOP_TRANSFER`: the settlement hold it canceled, so the TA releases that trade; else `null` */
  canceled_settlement_hold: CanceledSettlementHold | null;
  /** The security's new state */
  state: string;
}

/** One canceled hold (`Holds.CancelHoldResult`). */
export interface CancelHoldResult {
  security_id: string;
  hold_id: string;
  hold_cancellation_id: string;
}

/** What `CapTable_CancelHolds` did (`CapTable_CancelHoldsResult`). */
export interface CancelHoldsResult {
  canceled: CancelHoldResult[];
  /** The new states, by security ID */
  states: ReadonlyMap<string, string>;
}

/** A drawn lot's delivered terms (`SettleDrawResult`). */
export interface DeliveredDraw {
  kind: 'draw';
  security_id: string;
  hold_id: string;
  quantity: string;
  share_price: Monetary;
  transfer_id: string;
  buyer_issuance_id: string;
  buyer_security_id: string;
  /** The buyer's new state, carrying the delivery record */
  buyer_state: string;
  balance_issuance_id: string | null;
  balance_security_id: string | null;
  balance_state: string | null;
  /** The origin issuance's legends and exemptions, copied to the buyer's issuance */
  stock_legend_ids: string[];
  security_law_exemptions: SecurityExemption[];
}

/** A hold the settlement canceled (`SettleCancelResult`). */
export interface DeliveredCancel {
  kind: 'cancel';
  security_id: string;
  hold_id: string;
  hold_cancellation_id: string;
  state: string;
}

/** One lot of a settlement's result. */
export type DeliveredLot = DeliveredDraw | DeliveredCancel;

/**
 * The delivered terms of one `CapTable_Settle` (`Holds.SettleResult`), which the desk checks against the accepted terms
 * before it pays. There is no delivery proof: these terms, in the settling transaction, are the record of delivery.
 */
export interface DeliveredTerms {
  context: RegisterContext;
  settlement_id: string;
  seller_stakeholder_id: string;
  buyer_stakeholder_id: string;
  stock_class_id: string;
  /** In the order the settlement named the lots */
  lots: DeliveredLot[];
  /** Total quantity delivered */
  quantity: string;
}

/** A ledger-effects transaction's events, as `submitAndWaitForTransaction` and the update reads return them. */
export interface LedgerEffectsTransaction {
  readonly updateId?: string;
  readonly events: readonly unknown[];
}

/** One `CapTable_Settle` exercised on an OpenCapTable-v35 anchor in a transaction, with its delivered terms. */
export interface SettlementInTransaction {
  /** The anchor the settlement was exercised on */
  capTableContractId: string;
  templateId: string;
  /** The exercised event's node in the transaction, when the event carries one */
  nodeId: number | null;
  terms: DeliveredTerms;
}

/** What `register.planDraw` needs to draw one lot under a settlement. */
export interface PlanDrawInput {
  /** The lot's active state, as the book holds it (splits are applied to it here) */
  state: StockSecurityState;
  /** The splits recorded on the lot's class epoch */
  epochSplits: readonly RecordedSplit[];
  /** The settlement ID: the hold's reference */
  settlementId: string;
  /** The lot's `REGISTER_SETTLEMENT` hold under the settlement */
  holdId: string;
  /** Shares to draw */
  quantity: string;
  /** Price per share, in the trade's currency */
  sharePrice: Monetary;
  /** The buyer's issuance's custom ID */
  customId: string;
  /** The lot's origin `TX_STOCK_ISSUANCE`: its contract and its OCF data */
  originIssuance: { contractId: string; data: OcfStockIssuance };
  /** The settlement's date, the ledger date it is submitted on (`YYYY-MM-DD`) */
  date: string;
  capTableId: string;
  /** A lot on vesting terms: the balance's remaining vesting as explicit tranches; omit for any other lot */
  balanceVestings?: readonly Vesting[];
}

/** The seller's balance a partial draw leaves. */
export interface PlannedBalance {
  quantity: string;
  cost_basis: Monetary | null;
  /** The balance issuance's tranches: computed by the ledger for a tranche lot, the caller's for a lot on terms */
  vestings: Vesting[];
}

/** A drawn lot's delivered terms before the settlement commits: all but the new states' contract IDs. */
export type ExpectedDeliveredDraw = Omit<DeliveredDraw, 'buyer_state' | 'balance_state'>;

/** One planned draw: the lot to settle and what the settlement will deliver for it. */
export interface PlannedDraw {
  /** The `SettleDraw` lot for `CapTable_Settle`, or the desk choice that calls it */
  lot: DrawLot;
  /** The delivered terms the settlement's result will carry for the lot */
  delivered: ExpectedDeliveredDraw;
  /** The seller's stakeholder and the class, which every draw of one settlement shares */
  seller_stakeholder_id: string;
  stock_class_id: string;
  /** The seller's balance when shares remain, else `null` */
  balance: PlannedBalance | null;
}

// ===== Book inputs and batch sizing =====
//
// What `register.resolveInputs` and `register.planBatches` compute for a write: the contracts it must pass, the IDs it
// claims and releases, and how much of each per-transaction cap it uses.

/**
 * A reference an OCF record makes to other records (`References.Requirement`). The ledger checks every requirement of
 * a write after its last operation, against the records, epochs and issuances the write was given or created.
 */
export type RegisterRequirement =
  /** A record with this object ID and one of these types exists */
  | { kind: 'object'; label: string; object_id: string; object_types: OcfObjectType[] }
  /** An issuance of one of these types carries this security ID */
  | { kind: 'security'; label: string; security_id: string; object_types: OcfObjectType[] }
  /** The stock plan exists and includes the stock class */
  | { kind: 'plan_includes_class'; label: string; stock_plan_id: string; stock_class_id: string }
  /** The stock class exists and has a ratio conversion right */
  | { kind: 'ratio_conversion_right'; label: string; stock_class_id: string }
  /** The security's vesting terms have this condition, with a start trigger (`start`) or an event trigger */
  | { kind: 'vesting_condition'; label: string; security_id: string; vesting_condition_id: string; start: boolean }
  /** The warrant or convertible issuance carrying the security has this trigger */
  | { kind: 'trigger'; label: string; security_id: string; trigger_id: string }
  /** The split exists, is of the class, is recorded on the class's epoch and is dated on or before `on_or_before` */
  | { kind: 'split_of_class'; label: string; split_id: string; stock_class_id: string; on_or_before: string };

/** A settlement's buyer named by an existing stakeholder's object ID, whose record's contract the index supplies. */
export interface SettleBuyerByStakeholder {
  kind: 'existingStakeholder';
  stakeholderId: string;
}

/**
 * One register write, by anchor choice: the arguments its builder takes other than the anchor, the transfer agent and
 * the inputs, which `register.resolveInputs` computes from a key index.
 */
export type BookWrite =
  | { kind: 'apply'; operations: readonly ApplyOperation[] }
  | { kind: 'restate'; operations: readonly RestateOperation[] }
  | {
      kind: 'placeHolds';
      holdType: HoldType;
      reference: string;
      /** The ledger date the command is submitted on (`YYYY-MM-DD`) */
      date: string;
      reasonText: string;
      /** A settlement lot may omit its origin issuance: the index supplies it */
      lots: readonly PlaceHoldLot[];
    }
  | { kind: 'cancelHolds'; date: string; holds: readonly CancelHold[] }
  | {
      kind: 'settle';
      settlementId: string;
      date: string;
      buyer: SettleBuyer | SettleBuyerByStakeholder;
      lots: readonly SettleLot[];
    };

/** A writer-chosen ID a write claims, or a restatement releases, in its namespace. */
export interface ClaimedId {
  namespace: IdNamespace;
  id: string;
}

/**
 * How much of each per-transaction cap one write uses, as the ledger counts it, and its estimated size. Counts include
 * what the write creates when it flushes (the final states, epochs and shards).
 */
export interface BookWriteUsage {
  /** Operations of a `CapTable_Apply` or `CapTable_Restate`, lots of a placement or settlement, holds of a cancellation */
  operations: number;
  /** Writer-chosen IDs claimed (at most 500) */
  claims: number;
  /** `OcfIdShard`s created, rewritten ones included (at most 4,096) */
  shardsCreated: number;
  /** Vesting tranches of the states and issuances read or written (at most 20,000) */
  tranches: number;
  /** Polymorphic references checked, an edit charged as `CapTable_Restate` charges it (at most 100) */
  polymorphicReferences: number;
  /** Register contracts archived or created, shards included (a restatement touches at most 500) */
  contractsTouched: number;
  /** JSON bytes of every input contract's payload, every created contract's payload and the choice argument */
  bytes: number;
  /** The ledger's refusal of each record over a per-record cap (stored references, plan classes, tranches) */
  recordCaps: string[];
}

/** What a write must pass and what it does to the book's IDs, computed from a key index. */
export interface ResolvedInputs {
  /** The contracts the write consumes or reads, in the order its operations first need them */
  inputs: BookInputs;
  /** The IDs the write claims, in the order the ledger claims them */
  claimed: ClaimedId[];
  /** The IDs a restatement releases */
  released: ClaimedId[];
  /** The origin issuance contract of every lot a settlement hold goes on or a draw takes from, by security ID */
  originIssuances: ReadonlyMap<string, string>;
  /** A settlement's buyer, an existing stakeholder named by its record's contract; `null` for any other write */
  buyer: SettleBuyer | null;
  usage: BookWriteUsage;
  /** Each limit the write exceeds, with the ledger's message (the SDK's for the byte budget); empty when it fits */
  exceeded: string[];
}

/** One transaction of a {@link BatchPlan}. */
export type PlannedBatch =
  | {
      kind: 'apply';
      operations: ApplyOperation[];
      /** The position in the planned list each operation comes from */
      sources: number[];
      usage: BookWriteUsage;
    }
  | {
      kind: 'restate';
      /** An extension of a financing or document created by an earlier batch */
      operations: RestateOperation[];
      sources: number[];
      usage: BookWriteUsage;
    };

/** An operation that fits in no transaction on its own. */
export interface OversizedOperation {
  /** Its position in the planned list */
  index: number;
  kind: ApplyOperation['kind'];
  /** The limits it exceeds alone */
  exceeded: string[];
}

/** Consecutive transactions that write a list of operations within every cap, in order. */
export interface BatchPlan {
  batches: PlannedBatch[];
  /** The first operation that cannot fit; the batches cover the operations before it. `null` when every one fits */
  oversized: OversizedOperation | null;
}

// ===== One writer per issuer =====
//
// The register's off-ledger checks hold only if no other write of the book changes what a check read before the
// checked command's outcome is known. `register.RegisterWriter` runs every write of a book through scoped locks held
// from the check until then (design, "What moves off the ledger").

/**
 * What a write's checks depend on, and so what it locks: the whole book (`issuer`), a stock class's outstanding shares
 * (`class:<stock class ID>`), a stock plan's pool (`plan:<stock plan ID>`) or one warrant, convertible or
 * equity-compensation instrument (`instrument:<security ID>`).
 */
export type LockScope = 'issuer' | `class:${string}` | `plan:${string}` | `instrument:${string}`;

/**
 * How a scope is held. Two holds of one scope conflict unless both are `shared`. Every write holds `issuer`: `shared`
 * when narrower scopes cover it, `exclusive` when it depends on the whole book.
 */
export type LockMode = 'exclusive' | 'shared';

/** One scope, held in one mode. */
export interface ScopedLock {
  scope: LockScope;
  mode: LockMode;
}

/** A scope to lock: a bare scope is held `exclusive`. */
export type LockRequest = LockScope | ScopedLock;

/** How long to wait for a lease. */
export interface AcquireLockOptions {
  /** Stop waiting when this signal aborts */
  signal?: AbortSignal;
  /** Stop waiting after this many milliseconds (default: wait until the signal aborts) */
  timeoutMs?: number;
}

/** Scopes a writer holds, from its check until its command's outcome is known. */
export interface LockLease {
  readonly issuerKey: string;
  /** The scopes held, in canonical order */
  readonly locks: readonly ScopedLock[];
  /** Release every scope; a second call does nothing */
  release(): Promise<void>;
}

/**
 * Where a book's writers take their scoped locks. Every process that writes a book must take them from one provider:
 * ta-service and the replication scripts run in different processes, so they need a provider backed by shared state
 * (for example PostgreSQL advisory locks in ta-service's database, a `pg_advisory_lock` or `pg_advisory_lock_shared` on
 * a hash of the issuer key and scope, taken in canonical order on one session held for the lease). The SDK ships only
 * this interface and an in-process provider (`register.InProcessLockProvider`), which serializes the writers of one
 * process.
 *
 * An implementation grants a lease only when every scope is held in its mode, acquires scopes in the canonical order
 * (`register.canonicalLocks`: `issuer` first, then by scope) so two leases never deadlock, and serves the waiters of a
 * scope in arrival order. A lease that dies with its process (an advisory lock with its session) may leave a command
 * whose outcome is unknown: the next writer brings its index current from the ledger before it checks, so a command
 * that committed is seen, but one still in flight is not; persist unresolved command IDs if that matters.
 */
export interface WriterLockProvider {
  /**
   * Hold every scope for one book. Resolves once all are held; rejects with an `OcpContractError` (`TIMEOUT`) when
   * the wait times out or the signal aborts, holding none.
   */
  acquire(issuerKey: string, scopes: readonly LockRequest[], options?: AcquireLockOptions): Promise<LockLease>;
}

/** The writer's clock: wall-clock milliseconds, and a wait between polls. */
export interface WriterClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/**
 * What the book shows once a command committed, for deciding its outcome from the key index when the ledger's
 * completions do not: every object it creates is present, every object it deletes is absent and every state or record
 * it consumes is archived. Shards are never markers, because writes of other scopes rewrite them.
 */
export interface CommandMarkers {
  /** Object IDs the command creates */
  createdObjects: string[];
  /** Object IDs the command deletes */
  deletedObjects: string[];
  /** Contract IDs of the stock states and records the command consumes */
  consumedContracts: string[];
}

/** A command the writer committed, and its decoded result. */
export interface RegisterCommitted<T> {
  commandId: string;
  updateId: string;
  /** The offset the command's transaction committed at */
  offset: number;
  result: T;
}

/** One transaction of a `RegisterWriter.apply` or `restate` call. */
export interface RegisterBatchCommitted extends RegisterCommitted<BookWriteResult> {
  kind: 'apply' | 'restate';
  /** The position in the call's operation list each of the batch's operations comes from */
  sources: number[];
}

/** What a `RegisterWriter.apply` or `restate` call committed, one entry per transaction, in order. */
export interface RegisterWriteSummary {
  batches: RegisterBatchCommitted[];
}

/**
 * The error a `RegisterWriter.apply` or `restate` call failed with, as its batch's submission threw it, carrying the
 * transactions of the call that committed before it (the book holds them) on `committed`.
 */
export type RegisterWriteError = Error & { readonly committed?: readonly RegisterBatchCommitted[] };

/** A command whose outcome the writer could not establish: its scopes stay locked until it is reconciled. */
export interface UnresolvedCommand {
  commandId: string;
  /** The anchor choice the command exercises */
  choice: string;
  /** The scopes it holds */
  locks: readonly ScopedLock[];
  /** The ledger end read before the submission: the command's completion, if any, comes after it */
  beginExclusive: number;
  /** When it was submitted, on the writer's clock */
  submittedAt: number;
  markers: CommandMarkers;
  /** Why its outcome is unknown */
  causeMessage: string;
}

/** How `RegisterWriter.reconcile` resolved a command. */
export interface ReconcileResult {
  commandId: string;
  /** `absent`: the command did not commit, by the book's markers (no completion was found) */
  outcome: 'committed' | 'rejected' | 'absent';
  /** What established the outcome: the command's completion, the key index's markers, or the caller */
  evidence: 'completion' | 'index' | 'assumed';
  /** The committed transaction's update ID, when a completion names it */
  updateId: string | null;
  /** A failed completion's status */
  status: { code: number; message: string } | null;
}

// ===== Off-ledger checks =====
//
// The checks the design moves off the ledger ("What moves off the ledger"): `register.RegisterWriter` runs them on every
// `CapTable_Apply` and `CapTable_Restate` transaction under the transaction's locks, and `register.recordSplit` runs a
// split's class check while the class is frozen.

/**
 * One of the writer's off-ledger checks:
 *
 * - `ceilings`: outstanding shares within each class's and the issuer's authorized shares, and each plan's grants and
 *   plan stock within its pool
 * - `references`: no edit or delete leaves a live record pointing at nothing, a stock class with stock, or a stakeholder
 *   with stock
 * - `instruments`: warrants, convertibles and equity compensation not exercised, converted or changed after they were
 *   retired, exercised on or before expiration, and never overdrawn
 * - `dates`: no stock security event, and no hold cancellation, dated after the ledger date
 */
export type RegisterCheck = 'ceilings' | 'references' | 'instruments' | 'dates';

/** Which checks run: each one is on unless it is set to `false`. */
export type RegisterCheckSelection = Partial<Record<RegisterCheck, boolean>>;

/** Options of `register.checkWrite` and `register.writeViolations`. */
export interface RegisterCheckOptions extends RegisterCheckSelection {
  /** The ledger date, `YYYY-MM-DD` in UTC (the writer's clock): the dates check refuses what is dated after it */
  today: string;
}

/**
 * The rule a write breaks:
 *
 * - `class_ceiling`, `issuer_ceiling`: outstanding shares over a class's or the issuer's authorized shares
 * - `plan_pool`: a plan's outstanding grants and plan stock over its pool
 * - `orphaned_reference`: a live record would point at nothing, or at a record that no longer satisfies it
 * - `class_has_stock`: a stock class deleted while a security of it is outstanding
 * - `stakeholder_holds`: a stakeholder deleted while it holds an outstanding stock security
 * - `after_retirement`: a record on a warrant, convertible or equity-compensation security after it was exercised,
 *   converted, canceled, transferred or retracted
 * - `after_expiration`: an exercise dated after the security's expiration date
 * - `exceeds_remaining`: an exercise, release, cancellation or transfer of more than remains of the security
 * - `future_dated`: a stock security event, or a hold cancellation, dated after the ledger date
 */
export type RegisterCheckRule =
  | 'class_ceiling'
  | 'issuer_ceiling'
  | 'plan_pool'
  | 'orphaned_reference'
  | 'class_has_stock'
  | 'stakeholder_holds'
  | 'after_retirement'
  | 'after_expiration'
  | 'exceeds_remaining'
  | 'future_dated';

/**
 * A rule the write would break. A check refuses only what the write itself breaks: a book already over a ceiling, or
 * already holding a dangling reference, still takes the writes that do not make it worse, such as the correction.
 */
export interface RegisterCheckViolation {
  check: RegisterCheck;
  rule: RegisterCheckRule;
  message: string;
  /** What the rule bounds: a stock class, stock plan, the issuer's ID, a security or a record */
  subject: string;
  /** The write's operation it is about, by position; `null` for the write as a whole */
  operation: number | null;
  /** The records involved, the write's own first */
  recordIds: string[];
}

/** The error a refused check throws: the first violation's message, with every violation on `violations`. */
export type RegisterCheckError = OcpValidationError & { readonly violations?: readonly RegisterCheckViolation[] };

/** A record in a split's class dated on or after the split, which the split cannot be recorded before. */
export interface SplitOffender {
  objectId: string;
  objectType: OcfObjectType;
  entityType: OcfEntityType;
  date: string;
}

/** Options of `register.recordSplit`. */
export interface RecordSplitOptions {
  /** Stop waiting for the locks when this signal aborts (a submitted command is never abandoned) */
  signal?: AbortSignal;
}

/**
 * What `register.recordSplit` committed. A step an earlier attempt already made (its epoch frozen, its split recorded,
 * its epoch unfrozen) is `null`.
 */
export interface RecordSplitResult {
  /** `CapTable_FreezeClass`, with the frozen epoch's contract ID */
  freeze: RegisterCommitted<string> | null;
  /** The `CapTable_Apply` that recorded the split */
  split: RegisterBatchCommitted | null;
  /** `CapTable_UnfreezeClass`, with the unfrozen epoch's contract ID */
  unfreeze: RegisterCommitted<string> | null;
}

/**
 * The error `register.recordSplit` throws when records in the class are dated on or after the split: the class was
 * unfrozen again (`unfreeze`, `null` when that failed too and the class stays frozen), and `offenders` lists them all.
 */
export type RecordSplitError = OcpValidationError & {
  readonly offenders?: readonly SplitOffender[];
  readonly unfreeze?: RegisterCommitted<string> | null;
};

// ===== Offline replay of OCF =====
//
// What `register.replayOcf` computes from a book's OCF: the v35 state machine run off the ledger, in the order a
// replication writes the records, with the operations that write them, every stock security's expected state, the
// warrants, convertibles and equity compensation it tracks, and the records the ledger would refuse.

/** Options for `register.replayOcf`. */
export interface ReplayOcfOptions {
  /**
   * The book's cap table ID. With it the replay knows this book's derived IDs: an ID the ledger derives for a record's
   * role is not claimed, a record whose ID has the book's derived form is replayed as the ledger wrote it, and a
   * claimed ID in that form (a definition's, a primary issuance's) is refused. Without it every ID is claimed.
   */
  capTableId?: string;
}

/**
 * The rule a record breaks in the replay, named after the ledger's rule (or the reason the replay cannot read it):
 *
 * - `malformed_record`: a field the replay reads is missing or invalid, or the object type is unknown
 * - `claimed_id`: an object ID used twice (across types), a security ID used twice (across instruments), an empty
 *   ID, or a claimed ID in the book's derived form
 * - `missing_state`: an event on a security with no active stock state (never issued, retired, or its issuance was
 *   refused)
 * - `missing_class`: a stock issuance, output or split in a class that does not exist
 * - `date_order`: an event dated before its security's last event (its issuance included)
 * - `held`: a terminal event on a security that carries an open hold
 * - `resulting_securities`: a bundled event's outputs are not its resulting securities in order, or a consolidation's
 *   securities are malformed (none, more than 50, repeated, or its resulting security not written)
 * - `balance`: the event's quantity exceeds the security, or its balance is not named, does not hold the remainder or
 *   leaves the stakeholder or class
 * - `conservation`: a transfer's, same-class reissuance's or consolidation's outputs do not hold its quantity
 * - `class`: an output leaves the source's class where it must not, or a consolidation's securities do not share one
 *   class and one stakeholder
 * - `output_date`: an output issuance is not dated on its event
 * - `tranche_cover`: a partial event, hold or draw on a security whose tranches cover less than its quantity
 * - `vesting`: an output vests ahead of its source or does not conserve its vesting, a balance's vesting, an
 *   acceleration out of bounds
 * - `snapshot`: the vested quantity a lot on vesting terms needs for an event breaks the snapshot rules
 * - `split`: a split not dated after the class's latest, beyond 64, with a non-positive ratio, or one that floors a
 *   state or every tranche to zero
 * - `split_reference`: a reissuance names a split that is missing, of another class, dated after it or not recorded
 * - `reference`: a vesting record with no stock state, or an instrument event, names a security no vesting
 *   instrument or no instrument of its type carries
 * - `hold`: a hold, hold cancellation or settlement draw the hold rules refuse
 * - `state_invariant`: a stock state the ledger's `ensure` refuses (a quantity that is not positive, tranches that are
 *   not positive, exceed the quantity or number more than 1,500)
 */
export type ReplayRule =
  | 'malformed_record'
  | 'claimed_id'
  | 'missing_state'
  | 'missing_class'
  | 'date_order'
  | 'held'
  | 'resulting_securities'
  | 'balance'
  | 'conservation'
  | 'class'
  | 'output_date'
  | 'tranche_cover'
  | 'vesting'
  | 'snapshot'
  | 'split'
  | 'split_reference'
  | 'reference'
  | 'hold'
  | 'state_invariant';

/** A record the replay refuses, with the rule it breaks. The refused record changes nothing; the replay goes on. */
export interface ReplayViolation {
  rule: ReplayRule;
  /** The ledger's message where the ledger refuses the write (decimals in Daml `show` form), else the replay's */
  message: string;
  /** The refused unit's records: the event first, then its output issuances */
  recordIds: string[];
  /** The stock securities the unit acts on */
  securityIds: string[];
  /** The date the unit replays on; `null` for an undated record */
  date: string | null;
  /** The number of steps written before the refusal: the book is valid up to `steps.slice(0, step)` */
  step: number;
}

/**
 * How a replay step is written:
 *
 * - `apply`: one `CapTable_Apply` operation (`operation`), a record or a bundled stock event
 * - `snapshot`: a vesting snapshot the TA must record before the next step: a lot on vesting terms whose event moves
 *   vested shares needs the ledger to know they vested (`impliedBy` names the event)
 * - `issuer`: the issuer record, written when the cap table is created
 * - `hold`, `holdCancellation`, `draw`: written by the register itself (`CapTable_PlaceHolds`, `CapTable_CancelHolds`
 *   and `CapTable_Settle`), read from an extended export; no operation writes them
 */
export type ReplayStepKind = 'apply' | 'snapshot' | 'issuer' | 'hold' | 'holdCancellation' | 'draw';

/** One write of the replay, in the order a replication writes it. */
export interface ReplayStep {
  kind: ReplayStepKind;
  /** The operation that writes the step through `CapTable_Apply`; `null` for the issuer and the register's own writes */
  operation: ApplyOperation | null;
  /** The date the step replays on; `null` for an undated record */
  date: string | null;
  /** Its records: the event first, then its output issuances (a stop's companion cancellation after the stop) */
  recordIds: string[];
  /** The stock securities whose state it consumes, changes or creates */
  securityIds: string[];
  /** Whether one of its record IDs has this book's derived form: the ledger wrote it, and a replication skips it */
  derivedForm: boolean;
  /** For a `snapshot` step, the event that needs it; otherwise `null` */
  impliedBy: string | null;
}

/**
 * A stock security's expected state after the replay: the ledger's `StockSecurity` without its context. Fields only
 * the ledger knows differ: the TA's snapshots (the replay's `snapshot` is the last one its own `snapshot` steps
 * record, and `accelerated_since_snapshot` counts the accelerations since), the `seq` bumps of snapshots and
 * restatements the OCF does not show, and holds and deliveries unless the export includes the hold pair.
 */
export type ReplayedStockState = Omit<StockSecurityState, 'context'>;

/** A stock security whose state an event ended. */
export interface RetiredStockSecurity {
  securityId: string;
  /** The record that ended it */
  recordId: string;
  date: string;
  /** Its state brought to the event's date, as the event consumed it */
  lastState: ReplayedStockState;
}

/** The instruments the register keeps no state for, whose lifecycle the SDK checks. */
export type InstrumentKind = 'warrant' | 'convertible' | 'equityCompensation';

/** One record on a warrant, convertible or equity-compensation security, as the replay tracked it. */
export interface InstrumentEvent {
  recordId: string;
  objectType: OcfObjectType;
  date: string;
  /** The quantity it names (an exercise, release, transfer, cancellation or acceleration), or `null` */
  quantity: string | null;
  /** The amount it names (a convertible's transfer or cancellation), or `null` */
  amount: Monetary | null;
  /**
   * `retire`: it ends the security (a transfer, cancellation, retraction, conversion or warrant exercise); `reduce`:
   * it uses part of the remaining quantity (an equity-compensation exercise or release); `none`: neither
   */
  effect: 'none' | 'reduce' | 'retire';
  /** It was recorded after an earlier record retired the security */
  afterRetirement: boolean;
  /** It is dated after the security's expiration date */
  afterExpiration: boolean;
  /** Its quantity or amount exceeds what remained of the security */
  exceedsRemaining: boolean;
  /** The securities it results in (resulting and balance securities) */
  resultingSecurityIds: string[];
}

/** A warrant, convertible or equity-compensation security's lifecycle, as the replay tracked it. */
export interface InstrumentState {
  kind: InstrumentKind;
  securityId: string;
  /** Its issuance's object ID */
  issuanceId: string;
  stakeholderId: string;
  issueDate: string;
  /** A warrant's `warrant_expiration_date` or equity compensation's `expiration_date` */
  expirationDate: string | null;
  /** Equity compensation's plan and class, for plan pools and reader-side split scaling */
  stockPlanId: string | null;
  stockClassId: string | null;
  /** The quantity issued: equity compensation's, a warrant's when it names one; `null` for a convertible */
  quantity: string | null;
  /**
   * What remains: the quantity issued less exercises and releases, `0` once retired; it goes below zero when the
   * records overdraw it. `null` where the quantity is.
   */
  remainingQuantity: string | null;
  /** A convertible's investment amount */
  amount: Monetary | null;
  /** A convertible's amount outstanding, `0` once retired */
  remainingAmount: string | null;
  /** Shares exercised or released (a warrant's whole quantity at its exercise, when it names one) */
  exercisedQuantity: string;
  /** The record that retired it, if any */
  retired: { recordId: string; objectType: OcfObjectType; date: string } | null;
  /** Every record on it, in replay order */
  events: InstrumentEvent[];
}

/** What `register.replayOcf` computes. */
export interface ReplayResult {
  /** The writes, in replay order */
  steps: ReplayStep[];
  /** The active stock securities' expected states, by security ID */
  states: Map<string, ReplayedStockState>;
  /** The stock securities an event ended, by security ID */
  retired: Map<string, RetiredStockSecurity>;
  /** Each stock class's recorded splits, in date order (its epoch's list) */
  splits: Map<string, RecordedSplit[]>;
  /** The warrants, convertibles and equity compensation, by security ID */
  instruments: Map<string, InstrumentState>;
  /** The records refused, in replay order */
  violations: ReplayViolation[];
}
