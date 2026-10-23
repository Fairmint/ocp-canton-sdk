/**
 * Generated DAML ↔ native conversion for the register's own contracts: the `Context`, the `CapTable` anchor's status,
 * `StockSecurity`, `StockClassEpoch` and `OcfIdShard`, plus decoding of every register template's create argument
 * through its generated codec.
 *
 * Internal: the generated types stay behind the package boundary, and these functions are not part of the `register`
 * namespace.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../errors';
import type { DamlDataTypeFor } from '../functions/OpenCapTable/capTable/batchTypes';
import { decodeDamlEntityData } from '../functions/OpenCapTable/capTable/decodeEntityData';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type { Vesting } from '../types/native';
import type {
  CapTableStatus,
  Delivery,
  OcfIdShardState,
  OpenHold,
  RecordedSplit,
  RegisterContext,
  StockClassEpochState,
  StockSecurityState,
  StockVesting,
  VestedSnapshot,
} from '../types/register';
import { ocfEnumValue } from '../utils/damlEnums';
import {
  generatedCodec as codecOf,
  decodeGeneratedDaml,
  extractGeneratedCreateArgumentData,
  requireGeneratedRecord,
} from '../utils/generatedDamlValidation';
import { damlDateToDateString } from '../utils/typeConversions';
import { canonicalDecimal } from './numeric';

type GeneratedContext = Fairmint.OpenCapTable.Types.Core.Context;
type GeneratedCapTable = Fairmint.OpenCapTable.CapTable.CapTable;
type GeneratedStockSecurity = Fairmint.OpenCapTable.State.StockSecurity;
type GeneratedStockClassEpoch = Fairmint.OpenCapTable.State.StockClassEpoch;
type GeneratedOcfIdShard = Fairmint.OpenCapTable.State.OcfIdShard;

/** A decoded OCF record payload: its `Context` and its generated `ocf_data`. */
export interface DecodedRecordPayload<EntityType extends OcfEntityType> {
  context: GeneratedContext;
  ocf_data: DamlDataTypeFor<EntityType>;
}

/**
 * Decode an OCF record template's create argument through the generated codecs: the exact `{ context, ocf_data }`
 * wrapper, the `Context` and the record's `<Name>OcfData`, each losslessly.
 */
export function decodeRecordPayload<EntityType extends OcfEntityType>(
  entityType: EntityType,
  createArgument: unknown,
  source: string
): DecodedRecordPayload<EntityType> {
  const data = extractGeneratedCreateArgumentData(createArgument, source, { dataField: 'ocf_data' });
  const argument = requireGeneratedRecord(createArgument, source);
  const context = decodeGeneratedDaml(
    argument.context,
    codecOf(Fairmint.OpenCapTable.Types.Core.Context),
    `${source}.context`
  );
  return { context, ocf_data: decodeDamlEntityData(entityType, data) };
}

/** Decode the anchor's create argument through the generated `CapTable` codec. */
export function decodeCapTablePayload(createArgument: unknown, source: string): GeneratedCapTable {
  return decodeGeneratedDaml(createArgument, codecOf(Fairmint.OpenCapTable.CapTable.CapTable), source);
}

/** Decode a `StockSecurity` create argument through its generated codec. */
export function decodeStockSecurityPayload(createArgument: unknown, source: string): GeneratedStockSecurity {
  return decodeGeneratedDaml(createArgument, codecOf(Fairmint.OpenCapTable.State.StockSecurity), source);
}

/** Decode a `StockClassEpoch` create argument through its generated codec. */
export function decodeStockClassEpochPayload(createArgument: unknown, source: string): GeneratedStockClassEpoch {
  return decodeGeneratedDaml(createArgument, codecOf(Fairmint.OpenCapTable.State.StockClassEpoch), source);
}

/** Decode an `OcfIdShard` create argument through its generated codec. */
export function decodeOcfIdShardPayload(createArgument: unknown, source: string): GeneratedOcfIdShard {
  return decodeGeneratedDaml(createArgument, codecOf(Fairmint.OpenCapTable.State.OcfIdShard), source);
}

/** Decode an `OcfObject` interface view through its generated codec. */
export function decodeOcfObjectView(
  viewValue: unknown,
  source: string
): Fairmint.OpenCapTableApi.OcfObject.OcfObjectView {
  return decodeGeneratedDaml(viewValue, codecOf(Fairmint.OpenCapTableApi.OcfObject.OcfObjectView), source);
}

/** Decode a `RegisterContract` interface view through its generated codec. */
export function decodeRegisterContractView(
  viewValue: unknown,
  source: string
): Fairmint.OpenCapTableApi.RegisterContract.RegisterContractView {
  return decodeGeneratedDaml(
    viewValue,
    codecOf(Fairmint.OpenCapTableApi.RegisterContract.RegisterContractView),
    source
  );
}

// ===== Generated → native =====

function damlIntToNumber(value: string, source: string): number {
  if (!/^(0|-?[1-9][0-9]*)$/.test(value)) {
    throw new OcpParseError(`Expected a Daml Int at ${source}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new OcpParseError(`Daml Int at ${source} is beyond a safe JavaScript integer`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }
  return parsed;
}

/** The native `Context`. */
export function contextToNative(context: GeneratedContext): RegisterContext {
  return {
    cap_table_id: context.cap_table_id,
    issuer: context.issuer,
    system_operator: context.system_operator,
    transfer_agent: context.transfer_agent,
  };
}

const CAP_TABLE_STATUSES: Readonly<Record<Fairmint.OpenCapTable.CapTable.CapTableStatus, CapTableStatus>> = {
  CapTableStatusActive: 'ACTIVE',
  CapTableStatusTearingDown: 'TEARING_DOWN',
  CapTableStatusClosed: 'CLOSED',
};

/** The anchor's native status. */
export function capTableStatusToNative(status: Fairmint.OpenCapTable.CapTable.CapTableStatus): CapTableStatus {
  return CAP_TABLE_STATUSES[status];
}

function vestingTranchesToNative(
  tranches: Fairmint.OpenCapTable.Types.Vesting.OcfVesting[],
  source: string
): Vesting[] {
  return tranches.map((tranche, index) => ({
    date: damlDateToDateString(tranche.date, `${source}[${index}].date`),
    amount: canonicalDecimal(tranche.amount, `${source}[${index}].amount`),
  }));
}

function stockVestingToNative(vesting: Fairmint.OpenCapTable.State.StockVesting, source: string): StockVesting {
  switch (vesting.tag) {
    case 'StockVestingNone':
      return { kind: 'none' };
    case 'StockVestingTranches':
      return { kind: 'tranches', tranches: vestingTranchesToNative(vesting.value, `${source}.tranches`) };
    case 'StockVestingOnTerms':
      return { kind: 'on_terms', vesting_terms_id: vesting.value };
  }
}

function openHoldToNative(hold: Fairmint.OpenCapTable.State.OpenHold, source: string): OpenHold {
  return {
    hold_id: hold.hold_id,
    hold_type: ocfEnumValue('OcfHoldType', hold.hold_type, `${source}.hold_type`),
    reference: hold.reference,
    split_epoch: damlIntToNumber(hold.split_epoch, `${source}.split_epoch`),
    quantity: hold.quantity === null ? null : canonicalDecimal(hold.quantity, `${source}.quantity`),
  };
}

function deliveryToNative(delivery: Fairmint.OpenCapTable.State.Delivery): Delivery {
  return {
    reference: delivery.reference,
    seller_stakeholder_id: delivery.seller_stakeholder_id,
    transfer_id: delivery.transfer_id,
  };
}

function snapshotToNative(snapshot: Fairmint.OpenCapTable.State.VestedSnapshot, source: string): VestedSnapshot {
  return {
    as_of: damlDateToDateString(snapshot.as_of, `${source}.as_of`),
    vested: canonicalDecimal(snapshot.vested, `${source}.vested`),
  };
}

/** A `StockSecurity` as the native {@link StockSecurityState}. */
export function stockSecurityToNative(state: GeneratedStockSecurity, source: string): StockSecurityState {
  return {
    context: contextToNative(state.context),
    security_id: state.security_id,
    issue_date: damlDateToDateString(state.issue_date, `${source}.issue_date`),
    last_event_date: damlDateToDateString(state.last_event_date, `${source}.last_event_date`),
    origin_transaction_id: state.origin_transaction_id,
    quantity: canonicalDecimal(state.quantity, `${source}.quantity`),
    seq: damlIntToNumber(state.seq, `${source}.seq`),
    split_epoch: damlIntToNumber(state.split_epoch, `${source}.split_epoch`),
    stakeholder_id: state.stakeholder_id,
    stock_class_id: state.stock_class_id,
    vesting: stockVestingToNative(state.vesting, `${source}.vesting`),
    holds: state.holds.map((hold, index) => openHoldToNative(hold, `${source}.holds[${index}]`)),
    delivery: state.delivery === null ? null : deliveryToNative(state.delivery),
    snapshot: state.snapshot === null ? null : snapshotToNative(state.snapshot, `${source}.snapshot`),
    accelerated_since_snapshot:
      state.accelerated_since_snapshot === null
        ? null
        : canonicalDecimal(state.accelerated_since_snapshot, `${source}.accelerated_since_snapshot`),
    derived_ids: state.derived_ids,
  };
}

function recordedSplitToNative(split: Fairmint.OpenCapTable.State.RecordedSplit, source: string): RecordedSplit {
  return {
    split_id: split.split_id,
    date: damlDateToDateString(split.date, `${source}.date`),
    ratio: {
      numerator: canonicalDecimal(split.ratio.numerator, `${source}.ratio.numerator`),
      denominator: canonicalDecimal(split.ratio.denominator, `${source}.ratio.denominator`),
    },
  };
}

/** A `StockClassEpoch` as the native {@link StockClassEpochState}. */
export function stockClassEpochToNative(epoch: GeneratedStockClassEpoch, source: string): StockClassEpochState {
  return {
    context: contextToNative(epoch.context),
    stock_class_id: epoch.stock_class_id,
    frozen: epoch.frozen,
    splits: epoch.splits.map((split, index) => recordedSplitToNative(split, `${source}.splits[${index}]`)),
  };
}

// The generated declarations of the bundled `DA.Set` do not resolve, so the decoded set is read defensively.
function damlTextSetToArray(set: unknown, source: string): string[] {
  const map: unknown = typeof set === 'object' && set !== null ? (set as { map?: unknown }).map : undefined;
  const entriesArray: unknown =
    typeof map === 'object' && map !== null ? (map as { entriesArray?: unknown }).entriesArray : undefined;
  if (typeof entriesArray !== 'function') {
    throw new OcpParseError(`Expected a decoded Daml Set at ${source}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const entries: unknown = entriesArray.call(map);
  if (!Array.isArray(entries)) {
    throw new OcpParseError(`Expected a decoded Daml Set at ${source}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  return entries.map((entry: unknown, index) => {
    const key: unknown = Array.isArray(entry) ? entry[0] : undefined;
    if (typeof key !== 'string') {
      throw new OcpParseError(`Expected Text in the Daml Set at ${source}[${index}]`, {
        source: `${source}[${index}]`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    }
    return key;
  });
}

/** An `OcfIdShard` as the native {@link OcfIdShardState}, its claimed hashes sorted. */
export function ocfIdShardToNative(shard: GeneratedOcfIdShard, source: string): OcfIdShardState {
  return {
    context: contextToNative(shard.context),
    prefix: shard.prefix,
    claimed: damlTextSetToArray(shard.claimed, `${source}.claimed`).sort(),
  };
}
