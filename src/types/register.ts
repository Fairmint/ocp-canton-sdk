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

import type { HoldType, Vesting } from './native';

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
