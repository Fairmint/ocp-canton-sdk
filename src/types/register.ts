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
