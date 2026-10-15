/**
 * Position register types (OpenCapTable-v34 0.0.4, module `Fairmint.OpenCapTable.Positions`).
 *
 * The SDK builds against the published OpenCapTable-v34 0.0.3 bindings, which predate the position register. These
 * narrow types mirror the Daml declarations field for field, with OCP's snake_case names, as the JSON Ledger API v2
 * encodes them: Party, ContractId and Time as strings, Decimal as a canonical decimal string, `Optional a` as the
 * value or `null`, `Map Text a` as a `ReadonlyMap` in ledger (key) order. A lot's `issuance` (OCP's
 * `StockIssuanceOcfData`) is returned as the OCF stock issuance, like every other SDK read.
 *
 * What the SDK derives (a lot's exact vesting tranches; totals, held, vested and drawable quantities; restriction
 * buckets) uses camelCase names so it cannot be mistaken for contract fields.
 *
 * @module positionTypes
 */

import type { OcfStockIssuance, SecurityExemption } from '../../../types/native';

/** `Fairmint.OpenCapTable.Positions.HoldPurpose`: why a hold sits on a lot. */
export type HoldPurpose = 'HoldPurposeRegisterSettlement' | 'HoldPurposeStopTransfer' | 'HoldPurposeScripMint';

/** `Fairmint.OpenCapTable.Positions.LotHold`. */
export interface LotHold {
  readonly purpose: HoldPurpose;
  readonly reference: string;
  /** `Optional Decimal`: the held quantity for a quantity hold, `null` for a stop (which locks the whole lot). */
  readonly quantity: string | null;
}

/**
 * `Fairmint.OpenCapTable.Positions.VestingSnapshot`: the vested quantity of a lot on vesting terms as of a date, as the
 * issuer computed it off-ledger and recorded it with `Registry_RecordVesting`.
 */
export interface VestingSnapshot {
  /** `Decimal`: from 0 to the lot's quantity. */
  readonly vested_quantity: string;
  /** `Time`. */
  readonly as_of: string;
}

/** One tranche of a lot issuance's `vestings` (OCP `OcfVesting`) as the ledger holds it. */
export interface LedgerVesting {
  /** `Time`, exactly as on the ledger. */
  readonly date: string;
  /** `Decimal`, canonical. */
  readonly amount: string;
}

/** `Fairmint.OpenCapTable.Positions.PositionLot`. */
export interface PositionLot {
  /** The lot's own stock issuance (OCP `StockIssuanceOcfData`) as an OCF stock issuance. */
  readonly issuance: OcfStockIssuance;
  /**
   * The issuance's `vestings` in ledger order, each with its exact `Time`: the OCF issuance keeps only the calendar
   * date of a tranche, and OCP compares the whole `Time` with the date a vested quantity is computed for.
   */
  readonly ledgerVestings: readonly LedgerVesting[];
  readonly holds: readonly LotHold[];
  /**
   * `Optional VestingSnapshot`: only on a lot on vesting terms (`issuance.vesting_terms_id`), its latest vesting as
   * recorded with `Registry_RecordVesting`, or `null`. Without one, such a lot counts as unvested.
   */
  readonly vesting_snapshot: VestingSnapshot | null;
}

/** `Fairmint.OpenCapTable.Types.Core.Context`. */
export interface PositionContext {
  readonly issuer: string;
  readonly system_operator: string;
}

/** The payload of a `Fairmint.OpenCapTable.Positions.StockPosition` contract. */
export interface StockPositionData {
  readonly context: PositionContext;
  readonly stock_class_id: string;
  readonly stakeholder_id: string;
  readonly holder: string;
  /** `Map Text PositionLot`, keyed by the lot's security_id, in ledger order. */
  readonly lots: ReadonlyMap<string, PositionLot>;
}

/**
 * Quantities as canonical decimal strings, computed exactly (Numeric 10). Vested and drawable quantities are as of
 * one instant ({@link StockPositionState.asOf}); for a bucket or a position they are sums over its lots.
 */
export interface PositionQuantities {
  /** Sum of the lots' quantities. */
  readonly total: string;
  /** Sum of the quantity holds (`HoldPurposeRegisterSettlement`, `HoldPurposeScripMint`); stops hold no quantity. */
  readonly held: string;
  /**
   * OCP `vestedQuantity`: the lesser of the tranches dated on or before the instant (capped at the lot's quantity;
   * the whole lot when it has none) and, for a lot on vesting terms, its snapshot's vested quantity if the snapshot is
   * dated on or before the instant (else `0`).
   */
  readonly vested: string;
  /**
   * OCP `drawableQuantity`: what a transfer without a hold reference, or a new quantity hold, may take at the
   * instant: `0` for a stopped lot, else the vested quantity less the held quantity, and never below `0`.
   */
  readonly drawable: string;
}

/** Quantities of one lot, as OCP's `lotIsStopped`, `heldQuantity`, `vestedQuantity` and `drawableQuantity` compute them. */
export interface PositionLotQuantities extends PositionQuantities {
  readonly securityId: string;
  /** The lot carries at least one `HoldPurposeStopTransfer` hold, so nothing of it is drawable. */
  readonly stopped: boolean;
}

/**
 * A restriction bucket: lots whose `stock_legend_ids` and `security_law_exemptions` are equal as sets. Both lists
 * are deduplicated and sorted (legend IDs by code unit, exemptions by jurisdiction then description), the way
 * TradeSettlement compares a lot with the bucket a seller signed.
 */
export interface RestrictionBucket {
  readonly stockLegendIds: readonly string[];
  readonly securityLawExemptions: readonly SecurityExemption[];
}

/** Quantities of the lots of one position that fall in one restriction bucket. */
export interface RestrictionBucketQuantities extends PositionQuantities {
  readonly bucket: RestrictionBucket;
  /** Security IDs of the bucket's lots, in ledger order. */
  readonly securityIds: readonly string[];
}

/** One active `StockPosition` contract with its derived quantities. */
export interface StockPositionState {
  readonly contractId: string;
  /** Template ID as the ledger returned it (package-name or package-id form). */
  readonly templateId: string;
  /** The contract payload, field for field. */
  readonly position: StockPositionData;
  /** The instant the vested and drawable quantities are computed for, as canonical DAML `Time` text (UTC, microseconds). */
  readonly asOf: string;
  /** Quantities over all lots of the position. */
  readonly totals: PositionQuantities;
  /** Quantities per lot, in ledger order. */
  readonly lots: readonly PositionLotQuantities[];
  /** Quantities per restriction bucket, in order of each bucket's first lot. */
  readonly buckets: readonly RestrictionBucketQuantities[];
}

/**
 * The CapTable root's position fields (OpenCapTable-v34 0.0.4 appended Optional fields). A 0.0.3 CapTable has none
 * of them, which reads as "no positions".
 */
export interface CapTablePositionFields {
  /**
   * Whether `position_registries` is non-empty: the condition under which the ledger's root guard
   * (`validatePositionManagedWrites`) checks root writes. Securities migrate only into a registry's class, and a
   * registry is never removed, so a root without registries has no migrated securities either.
   */
  readonly enabled: boolean;
  /** `position_registries`: stock_class_id → PositionRegistry contract ID, for every position-managed class. */
  readonly registries: ReadonlyMap<string, string>;
  /**
   * `position_migrated_security_ids`: security_id → stakeholder_id of every root issuance migrated into a position.
   * The root guard does not read it: a migrated issuance is in a position-managed class, which the guard covers.
   */
  readonly migratedSecurityIds: ReadonlyMap<string, string>;
}

/**
 * Entity types of the OCF vesting records `Registry_RecordVesting` writes, create-only, for lots of a position: the
 * vesting transactions behind a lot's vesting snapshot.
 */
export type PositionVestingRecordType = 'vestingStart' | 'vestingEvent' | 'vestingAcceleration';

/**
 * Entity types of the create-only OCF records that `PositionRegistry` choices write: stock issuances and transfers
 * (`Registry_Issue`, `Registry_Transfer`) and vesting records (`Registry_RecordVesting`).
 */
export type PositionRegistryRecordType = 'stockIssuance' | 'stockTransfer' | PositionVestingRecordType;

/** Entity types of the objects a position lot or a registry-written issuance can reference besides stakeholders. */
export type PositionReferencedObjectType = 'stockLegendTemplate' | 'stockPlan' | 'vestingTerms';

/** An active OCF record of the issuer that neither the root maps nor a position registry account for. */
export interface UnattributedPositionRecord {
  readonly entityType: PositionRegistryRecordType;
  readonly id: string;
  readonly contractId: string;
}

/**
 * An OCF ID, or a stock issuance's security ID, that more than one active record of the cap table carries, at least
 * one of them written by a position registry. `Registry_Issue`, `Registry_Transfer` and `Registry_RecordVesting` take
 * caller-chosen IDs: the ledger checks no OCF ID for uniqueness, and a security ID only against the lots of the
 * position it writes into, so a registry can issue a security ID that a root issuance or another position already
 * has. The state keeps the root record (or else the first registry record) under the ID and lists the collision here;
 * the OCF export and the replication diff refuse a book with one, since neither can tell which record the ID means.
 */
export interface ConflictingPositionRecord {
  readonly entityType: PositionRegistryRecordType;
  /** What the records share: their OCF object ID, or (stock issuances) their `security_id`. */
  readonly field: 'id' | 'security_id';
  /** The shared OCF ID or security ID. */
  readonly value: string;
  /** Contract ID of the root record that carries the value, or `null` when only registry-written records do. */
  readonly rootContractId: string | null;
  /** Contract IDs of the registry-written records that carry the value, in ledger order. */
  readonly registryContractIds: readonly string[];
}

/**
 * Position-managed state of a CapTable, read from the root, its positions and the create-only records at one ledger
 * offset. `getCapTableState` attaches it to a CapTable that has position registries; root writers (replication and
 * `CapTableBatch`) use it to refuse what the ledger's root guard would reject.
 */
export interface CapTablePositionState extends CapTablePositionFields {
  /** Contract ID of the CapTable the state was read from. */
  readonly capTableContractId: string;
  /** Ledger offset at which the root, the positions and the records were read together. */
  readonly offset: number;
  /** Active `StockPosition` contracts of the cap table, with derived quantities (vested and drawable as of the read). */
  readonly positions: readonly StockPositionState[];
  /**
   * Root stock issuances superseded by positions: OCF object ID → migrated security_id. They stay in the root maps as
   * frozen history; the security's balance lives in its position from migration on.
   */
  readonly supersededStockIssuances: ReadonlyMap<string, string>;
  /**
   * Create-only records the registries wrote (issuances, transfers and vesting records), which the root maps do not list:
   * entity type → (OCF object ID → contract ID). `getCapTableState` also lists them in `entities` and `contractIds`.
   */
  readonly registryRecords: ReadonlyMap<PositionRegistryRecordType, ReadonlyMap<string, string>>;
  /**
   * stock_class_id of every stock security with an active issuance record, root or registry-written; for a security
   * ID several records carry, the root record's (as the ledger guard reads it), else the first registry record's.
   */
  readonly stockClassBySecurityId: ReadonlyMap<string, string>;
  /** Stakeholders that a position, a migrated issuance or a registry-written issuance references. */
  readonly referencedStakeholderIds: ReadonlySet<string>;
  /**
   * Stock legend templates, stock plans and vesting terms that a position lot or a registry-written issuance
   * references. The root validates references of root records only, so it cannot protect these.
   */
  readonly referencedObjectIds: ReadonlyMap<PositionReferencedObjectType, ReadonlySet<string>>;
  /**
   * Active stock issuances, transfers and vesting records of the cap table's context that nothing accounts for
   * (reported, not used).
   */
  readonly unattributedRecords: readonly UnattributedPositionRecord[];
  /**
   * Registry-written records whose OCF ID or security ID another record of the cap table also carries. Readers report
   * them; the OCF export and the replication diff refuse to run while there are any.
   */
  readonly conflictingRecords: readonly ConflictingPositionRecord[];
}

/** Positions of one issuer's CapTable, as returned by `getPositions`. */
export interface IssuerPositions extends CapTablePositionFields {
  readonly capTableContractId: string;
  /** Ledger offset at which the root and the positions were read together. */
  readonly offset: number;
  /** Active `StockPosition` contracts, in ledger order. Empty when positions are not enabled. */
  readonly positions: readonly StockPositionState[];
}
