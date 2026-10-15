/**
 * Position register types (OpenCapTable-v34 0.0.4, module `Fairmint.OpenCapTable.Positions`).
 *
 * The SDK builds against the published OpenCapTable-v34 0.0.3 bindings, which predate the position register. These
 * narrow types mirror the Daml declarations field for field, with OCP's snake_case names, as the JSON Ledger API v2
 * encodes them: Party, ContractId and Time as strings, Decimal as a canonical decimal string, `Optional a` as the
 * value or `null`, `Map Text a` as a `ReadonlyMap` in ledger (key) order. A lot's `issuance` (OCP's
 * `StockIssuanceOcfData`) is returned as the OCF stock issuance, like every other SDK read.
 *
 * Quantities derived by the SDK (totals, held and free quantities, restriction buckets) use camelCase names so they
 * cannot be mistaken for contract fields.
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
  /** `Time`: when the hold was placed. */
  readonly date: string;
}

/** `Fairmint.OpenCapTable.Positions.PositionLot`. */
export interface PositionLot {
  /** The lot's own stock issuance (OCP `StockIssuanceOcfData`) as an OCF stock issuance. */
  readonly issuance: OcfStockIssuance;
  readonly origin_security_id: string;
  /** `Time`: the origin's stock issuance date. */
  readonly origin_date: string;
  /** Security IDs from the origin to the direct parent; empty when the lot is its own origin. */
  readonly ancestry: readonly string[];
  readonly holds: readonly LotHold[];
  /** `Optional Time`: full vesting recorded by `Registry_RecordFullyVested`, or `null`. */
  readonly fully_vested_on: string | null;
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

/** Quantities as canonical decimal strings, computed exactly (Numeric 10). */
export interface PositionQuantities {
  /** Sum of the lots' quantities. */
  readonly total: string;
  /** Sum of the quantity holds (`HoldPurposeRegisterSettlement`, `HoldPurposeScripMint`); stops hold no quantity. */
  readonly held: string;
  /** What a transfer without a hold reference, or a new quantity hold, may take: `0` for a stopped lot. */
  readonly free: string;
}

/** Quantities of one lot, as OCP's `lotIsStopped`, `lotHeldQuantity` and `lotFreeQuantity` compute them. */
export interface PositionLotQuantities extends PositionQuantities {
  readonly securityId: string;
  /** The lot carries at least one `HoldPurposeStopTransfer` hold, so nothing of it is free. */
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
   * Whether any of the three fields is non-empty: the condition under which the ledger's root guard
   * (`validatePositionManagedWrites`) checks root writes.
   */
  readonly enabled: boolean;
  /** `position_registries`: stock_class_id → PositionRegistry contract ID, for every position-managed class. */
  readonly registries: ReadonlyMap<string, string>;
  /** `position_migrated_security_ids`: security_id → stakeholder_id of every root issuance migrated into a position. */
  readonly migratedSecurityIds: ReadonlyMap<string, string>;
  /**
   * `position_ancestor_security_ids`: security_id → the first migrated security_id whose lot has it as origin or
   * ancestor. Root records naming one are frozen like the migrated security's own.
   */
  readonly ancestorSecurityIds: ReadonlyMap<string, string>;
}

/** Entity types of the create-only OCF records that `PositionRegistry` choices write. */
export type PositionRegistryRecordType = 'stockIssuance' | 'stockTransfer';

/** An active OCF record of the issuer that neither the root maps nor a position registry account for. */
export interface UnattributedPositionRecord {
  readonly entityType: PositionRegistryRecordType;
  readonly id: string;
  readonly contractId: string;
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
  /** Active `StockPosition` contracts of the cap table, with derived quantities. */
  readonly positions: readonly StockPositionState[];
  /**
   * Root stock issuances superseded by positions: OCF object ID → migrated security_id. They stay in the root maps as
   * frozen history; the security's balance lives in its position from migration on.
   */
  readonly supersededStockIssuances: ReadonlyMap<string, string>;
  /**
   * Create-only records the registries wrote (transfers and issuances), which the root maps do not list:
   * entity type → (OCF object ID → contract ID). `getCapTableState` also lists them in `entities` and `contractIds`.
   */
  readonly registryRecords: ReadonlyMap<PositionRegistryRecordType, ReadonlyMap<string, string>>;
  /** stock_class_id of every stock security with an active issuance record, root or registry-written. */
  readonly stockClassBySecurityId: ReadonlyMap<string, string>;
  /** Stakeholders that a position, a migrated issuance or a registry-written issuance references. */
  readonly referencedStakeholderIds: ReadonlySet<string>;
  /** Active stock issuances and transfers of the cap table's context that nothing accounts for (reported, not used). */
  readonly unattributedRecords: readonly UnattributedPositionRecord[];
}

/** Positions of one issuer's CapTable, as returned by `getPositions`. */
export interface IssuerPositions extends CapTablePositionFields {
  readonly capTableContractId: string;
  /** Ledger offset at which the root and the positions were read together. */
  readonly offset: number;
  /** Active `StockPosition` contracts, in ledger order. Empty when positions are not enabled. */
  readonly positions: readonly StockPositionState[];
}
