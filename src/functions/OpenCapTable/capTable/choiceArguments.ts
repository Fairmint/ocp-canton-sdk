/**
 * Native → generated Daml encoders for the arguments of the `CapTable` anchor's choices: book inputs, `Apply` and
 * `Restate` operations, hold lots, settlement lots and purge targets.
 *
 * Internal: the generated types stay behind the package boundary. Every encoder validates the native value it reads and
 * refuses, with the ledger's own message, what the ledger refuses for the argument alone.
 */

import type { ContractId } from '@daml/types';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { MAX_LOTS_PER_OPERATION } from '../../../register/caps';
import type { HoldType, Monetary, OcfStockIssuance, Vesting } from '../../../types/native';
import type {
  ApplyOperation,
  BookInputs,
  CancelHold,
  DrawLot,
  PlaceHoldLot,
  PurgeTarget,
  RegisterRecordRef,
  RestateOperation,
  SettleBuyer,
  SettleLot,
  StateRestatement,
  StockVesting,
  VestedSnapshot,
} from '../../../types/register';
import { damlEnumConstructor } from '../../../utils/damlEnums';
import { requireChoiceDate, requireDecimal, requireDistinct, requireText } from './anchorCommand';
import { ENTITY_REGISTRY } from './batchTypes';
import { isOcfEditableEntityType, isOcfEntityType } from './entityTypes';
import { convertToDaml, convertToDamlData } from './ocfToDaml';

type DamlBookInputs = Fairmint.OpenCapTable.Book.BookInputs;
type DamlOcfRecordCid = Fairmint.OpenCapTable.OcfRecords.OcfRecordCid;
type DamlApplyOperation = Fairmint.OpenCapTable.Apply.ApplyOperation;
type DamlRestateOperation = Fairmint.OpenCapTable.Restate.RestateOperation;
type DamlStateRestatement = Fairmint.OpenCapTable.Restate.StateRestatement;
type DamlStockVesting = Fairmint.OpenCapTable.State.StockVesting;
type DamlVestedSnapshot = Fairmint.OpenCapTable.State.VestedSnapshot;
type DamlOcfVesting = Fairmint.OpenCapTable.Types.Vesting.OcfVesting;
type DamlOcfMonetary = Fairmint.OpenCapTable.Types.Monetary.OcfMonetary;
type DamlPlaceHoldLot = Fairmint.OpenCapTable.Holds.PlaceHoldLot;
type DamlCancelHold = Fairmint.OpenCapTable.Holds.CancelHold;
type DamlDrawLot = Fairmint.OpenCapTable.Holds.DrawLot;
type DamlSettleLot = Fairmint.OpenCapTable.Holds.SettleLot;
type DamlSettleBuyer = Fairmint.OpenCapTable.Holds.SettleBuyer;
type DamlPurgeTarget = Fairmint.OpenCapTable.CapTable.PurgeTarget;
type DamlStockIssuanceOcfData = Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;

/** A contract ID argument: a non-empty string, typed for the template the choice fetches it as. */
export function contractIdArgument<Template>(value: unknown, fieldPath: string): ContractId<Template> {
  // A contract ID is an opaque string on the wire; the brand only types it for the template.
  return requireText(value, fieldPath) as ContractId<Template>;
}

function requireArray<Item>(value: readonly Item[], fieldPath: string): readonly Item[] {
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, 'Expected an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: value,
    });
  }
  return value;
}

function requireRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, 'Expected an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return value as Record<string, unknown>;
}

function requireSeq(value: unknown, fieldPath: string): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new OcpValidationError(fieldPath, "a state's seq is not negative", {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-negative safe integer',
      receivedValue: value,
    });
  }
  return String(value);
}

function contractIds<Template>(values: readonly string[], fieldPath: string): Array<ContractId<Template>> {
  return requireArray(values, fieldPath).map((value, index) =>
    contractIdArgument<Template>(value, `${fieldPath}[${index}]`)
  );
}

// ===== Inputs =====

/** An OCF record contract as the `OcfRecordCid` variant of its entity kind. */
export function recordCidToDaml(ref: RegisterRecordRef, fieldPath: string): DamlOcfRecordCid {
  const { entityType } = requireRecord(ref, fieldPath);
  if (typeof entityType !== 'string' || !isOcfEntityType(entityType)) {
    throw new OcpValidationError(`${fieldPath}.entityType`, 'Unknown OCF entity type', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      receivedValue: entityType,
    });
  }
  // The tag and the contract ID come from the same entity kind; the union of variants cannot be correlated by type.
  return {
    tag: ENTITY_REGISTRY[entityType].cidTag,
    value: requireText(ref.contractId, `${fieldPath}.contractId`),
  } as DamlOcfRecordCid;
}

/** The existing contracts a write reads or changes. */
export function bookInputsToDaml(inputs: BookInputs, fieldPath = 'inputs'): DamlBookInputs {
  requireRecord(inputs, fieldPath);
  return {
    states: contractIds(inputs.states, `${fieldPath}.states`),
    epochs: contractIds(inputs.epochs, `${fieldPath}.epochs`),
    shards: contractIds(inputs.shards, `${fieldPath}.shards`),
    records: requireArray(inputs.records, `${fieldPath}.records`).map((ref, index) =>
      recordCidToDaml(ref, `${fieldPath}.records[${index}]`)
    ),
  };
}

// ===== Shared records =====

function monetaryToDaml(value: Monetary, fieldPath: string): DamlOcfMonetary {
  requireRecord(value, fieldPath);
  return {
    amount: requireDecimal(value.amount, `${fieldPath}.amount`),
    currency: requireText(value.currency, `${fieldPath}.currency`),
  };
}

function vestingsToDaml(vestings: readonly Vesting[], fieldPath: string): DamlOcfVesting[] {
  return requireArray(vestings, fieldPath).map((tranche, index) => {
    requireRecord(tranche, `${fieldPath}[${index}]`);
    return {
      amount: requireDecimal(tranche.amount, `${fieldPath}[${index}].amount`),
      date: requireChoiceDate(tranche.date, `${fieldPath}[${index}].date`),
    };
  });
}

function stockVestingToDaml(vesting: StockVesting, fieldPath: string): DamlStockVesting {
  const record = requireRecord(vesting, fieldPath);
  const { kind } = record;
  switch (vesting.kind) {
    case 'none':
      return { tag: 'StockVestingNone', value: {} };
    case 'tranches':
      return { tag: 'StockVestingTranches', value: vestingsToDaml(vesting.tranches, `${fieldPath}.tranches`) };
    case 'on_terms':
      return {
        tag: 'StockVestingOnTerms',
        value: requireText(vesting.vesting_terms_id, `${fieldPath}.vesting_terms_id`),
      };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown stock vesting kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: "'none' | 'tranches' | 'on_terms'",
        receivedValue: kind,
      });
  }
}

function snapshotToDaml(snapshot: VestedSnapshot, fieldPath: string): DamlVestedSnapshot {
  requireRecord(snapshot, fieldPath);
  return {
    as_of: requireChoiceDate(snapshot.as_of, `${fieldPath}.as_of`),
    vested: requireDecimal(snapshot.vested, `${fieldPath}.vested`),
  };
}

// ===== CapTable_Apply =====

const BUNDLED_EVENT_CHOICES: Readonly<Record<string, string>> = {
  stockTransfer: 'write a stock transfer with ApplyStockTransfer (CapTableApply.stockTransfer)',
  stockCancellation: 'write a stock cancellation with ApplyStockCancellation (CapTableApply.stockCancellation)',
  stockRepurchase: 'write a stock repurchase with ApplyStockRepurchase (CapTableApply.stockRepurchase)',
  stockConversion: 'write a stock conversion with ApplyStockConversion (CapTableApply.stockConversion)',
  stockReissuance: 'write a stock reissuance with ApplyStockReissuance (CapTableApply.stockReissuance)',
  stockConsolidation: 'write a stock consolidation with ApplyStockConsolidation (CapTableApply.stockConsolidation)',
};

const REFUSED_APPLY_RECORDS: Readonly<Record<string, string>> = {
  issuer: 'the issuer record is written when the cap table is created and edited by CapTable_Restate',
  stockHold: 'holds are placed by CapTable_PlaceHolds',
  stockHoldCancellation: 'holds are canceled by CapTable_CancelHolds or CapTable_Settle',
  ...BUNDLED_EVENT_CHOICES,
};

function issuanceToDaml(issuance: OcfStockIssuance, fieldPath: string): DamlStockIssuanceOcfData {
  requireRecord(issuance, fieldPath);
  return convertToDamlData('stockIssuance', issuance);
}

function optionalIssuanceToDaml(
  issuance: OcfStockIssuance | null | undefined,
  fieldPath: string
): DamlStockIssuanceOcfData | null {
  return issuance === undefined || issuance === null ? null : issuanceToDaml(issuance, fieldPath);
}

function issuancesToDaml(issuances: readonly OcfStockIssuance[], fieldPath: string): DamlStockIssuanceOcfData[] {
  return requireArray(issuances, fieldPath).map((issuance, index) =>
    issuanceToDaml(issuance, `${fieldPath}[${index}]`)
  );
}

function preSplitPrefix(value: unknown, fieldPath: string): string {
  const prefix = requireText(value, fieldPath);
  if (!/^[01]{8,256}$/.test(prefix)) {
    throw new OcpValidationError(fieldPath, 'A shard prefix is 8 to 256 bits, as "0" and "1"', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: prefix,
    });
  }
  return prefix;
}

/**
 * One `CapTable_Apply` operation. A plain record that the ledger writes only another way (the issuer, the hold pair, a
 * bundled stock event) is refused with the ledger's message; a consolidation's securities are checked as the ledger
 * checks them before it reads any state.
 */
export function applyOperationToDaml(operation: ApplyOperation, fieldPath: string): DamlApplyOperation {
  const record = requireRecord(operation, fieldPath);
  const { kind } = record;
  switch (operation.kind) {
    case 'record': {
      const { type } = record;
      if (typeof type === 'string' && Object.prototype.hasOwnProperty.call(REFUSED_APPLY_RECORDS, type)) {
        throw new OcpValidationError(`${fieldPath}.type`, REFUSED_APPLY_RECORDS[type] ?? type, {
          code: OcpErrorCodes.INVALID_TYPE,
          receivedValue: type,
        });
      }
      if (typeof type !== 'string' || !isOcfEditableEntityType(type)) {
        throw new OcpValidationError(`${fieldPath}.type`, 'Unknown OCF entity type', {
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          receivedValue: type,
        });
      }
      requireRecord(operation.data, `${fieldPath}.data`);
      return { tag: 'ApplyRecord', value: convertToDaml(operation.type, operation.data) };
    }
    case 'stockTransfer':
      requireRecord(operation.transfer, `${fieldPath}.transfer`);
      return {
        tag: 'ApplyStockTransfer',
        value: {
          transfer: convertToDamlData('stockTransfer', operation.transfer),
          resulting: issuancesToDaml(operation.resulting, `${fieldPath}.resulting`),
          balance: optionalIssuanceToDaml(operation.balance, `${fieldPath}.balance`),
        },
      };
    case 'stockCancellation':
      requireRecord(operation.cancellation, `${fieldPath}.cancellation`);
      return {
        tag: 'ApplyStockCancellation',
        value: {
          cancellation: convertToDamlData('stockCancellation', operation.cancellation),
          balance: optionalIssuanceToDaml(operation.balance, `${fieldPath}.balance`),
        },
      };
    case 'stockRepurchase':
      requireRecord(operation.repurchase, `${fieldPath}.repurchase`);
      return {
        tag: 'ApplyStockRepurchase',
        value: {
          repurchase: convertToDamlData('stockRepurchase', operation.repurchase),
          balance: optionalIssuanceToDaml(operation.balance, `${fieldPath}.balance`),
        },
      };
    case 'stockConversion':
      requireRecord(operation.conversion, `${fieldPath}.conversion`);
      return {
        tag: 'ApplyStockConversion',
        value: {
          conversion: convertToDamlData('stockConversion', operation.conversion),
          resulting: issuancesToDaml(operation.resulting, `${fieldPath}.resulting`),
          balance: optionalIssuanceToDaml(operation.balance, `${fieldPath}.balance`),
        },
      };
    case 'stockReissuance':
      requireRecord(operation.reissuance, `${fieldPath}.reissuance`);
      return {
        tag: 'ApplyStockReissuance',
        value: {
          reissuance: convertToDamlData('stockReissuance', operation.reissuance),
          resulting: issuancesToDaml(operation.resulting, `${fieldPath}.resulting`),
        },
      };
    case 'stockConsolidation': {
      requireRecord(operation.consolidation, `${fieldPath}.consolidation`);
      // Checked as the ledger checks them, before the OCF schema's own uniqueness rule reports them otherwise.
      const securities: unknown = operation.consolidation.security_ids;
      const securitiesPath = `${fieldPath}.consolidation.security_ids`;
      if (Array.isArray(securities)) {
        if (securities.length === 0) {
          throw new OcpValidationError(securitiesPath, 'a consolidation needs at least one security', {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          });
        }
        if (securities.length > MAX_LOTS_PER_OPERATION) {
          throw new OcpValidationError(
            securitiesPath,
            `a consolidation takes at most ${MAX_LOTS_PER_OPERATION} securities`,
            { code: OcpErrorCodes.OUT_OF_RANGE, receivedValue: securities.length }
          );
        }
        requireDistinct(
          securities.map((security) => String(security)),
          securitiesPath,
          'a consolidation names each security once'
        );
      }
      return {
        tag: 'ApplyStockConsolidation',
        value: {
          consolidation: convertToDamlData('stockConsolidation', operation.consolidation),
          resulting_issuance: issuanceToDaml(operation.resultingIssuance, `${fieldPath}.resultingIssuance`),
        },
      };
    }
    case 'vestingSnapshot':
      return {
        tag: 'ApplyVestingSnapshot',
        value: {
          security_id: requireText(operation.securityId, `${fieldPath}.securityId`),
          as_of: requireChoiceDate(operation.asOf, `${fieldPath}.asOf`),
          vested: requireDecimal(operation.vested, `${fieldPath}.vested`),
        },
      };
    case 'preSplitShard':
      return { tag: 'ApplyPreSplitShard', value: { prefix: preSplitPrefix(operation.prefix, `${fieldPath}.prefix`) } };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown CapTable_Apply operation kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        receivedValue: kind,
      });
  }
}

// ===== CapTable_Restate =====

/**
 * A restated stock state. `accelerated_since_snapshot` must be stated (`null` for none), as the snapshot it adds to is;
 * `seq` is given only to recreate a state.
 */
export function stateRestatementToDaml(state: StateRestatement, fieldPath: string): DamlStateRestatement {
  const record = requireRecord(state, fieldPath);
  if (!Object.prototype.hasOwnProperty.call(record, 'accelerated_since_snapshot')) {
    throw new OcpValidationError(
      `${fieldPath}.accelerated_since_snapshot`,
      'A restated state states the shares accelerated since its snapshot (null for none)',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const seq = state.seq === undefined || state.seq === null ? null : requireSeq(state.seq, `${fieldPath}.seq`);
  return {
    security_id: requireText(state.security_id, `${fieldPath}.security_id`),
    issue_date: requireChoiceDate(state.issue_date, `${fieldPath}.issue_date`),
    last_event_date: requireChoiceDate(state.last_event_date, `${fieldPath}.last_event_date`),
    origin_transaction_id: requireText(state.origin_transaction_id, `${fieldPath}.origin_transaction_id`),
    quantity: requireDecimal(state.quantity, `${fieldPath}.quantity`),
    stakeholder_id: requireText(state.stakeholder_id, `${fieldPath}.stakeholder_id`),
    stock_class_id: requireText(state.stock_class_id, `${fieldPath}.stock_class_id`),
    vesting: stockVestingToDaml(state.vesting, `${fieldPath}.vesting`),
    snapshot: state.snapshot === null ? null : snapshotToDaml(state.snapshot, `${fieldPath}.snapshot`),
    accelerated_since_snapshot:
      state.accelerated_since_snapshot === null
        ? null
        : requireDecimal(state.accelerated_since_snapshot, `${fieldPath}.accelerated_since_snapshot`),
    seq,
  };
}

/** One `CapTable_Restate` operation. */
export function restateOperationToDaml(operation: RestateOperation, fieldPath: string): DamlRestateOperation {
  const record = requireRecord(operation, fieldPath);
  const { kind } = record;
  switch (operation.kind) {
    case 'edit': {
      const { type } = record;
      if (typeof type !== 'string' || !isOcfEditableEntityType(type)) {
        throw new OcpValidationError(
          `${fieldPath}.type`,
          typeof type === 'string' && (type === 'stockHold' || type === 'stockHoldCancellation')
            ? 'hold records are never restated'
            : 'Unknown OCF entity type',
          { code: OcpErrorCodes.INVALID_TYPE, receivedValue: type }
        );
      }
      requireRecord(operation.data, `${fieldPath}.data`);
      return { tag: 'RestateEdit', value: convertToDaml(operation.type, operation.data) };
    }
    case 'delete':
      return { tag: 'RestateDelete', value: requireText(operation.objectId, `${fieldPath}.objectId`) };
    case 'setState':
      return { tag: 'RestateSetState', value: stateRestatementToDaml(operation.state, `${fieldPath}.state`) };
    case 'endState':
      return { tag: 'RestateEndState', value: requireText(operation.securityId, `${fieldPath}.securityId`) };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown CapTable_Restate operation kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        receivedValue: kind,
      });
  }
}

// ===== Holds and settlement =====

/** A lot of a hold placement, checked against the hold type as the ledger checks it before it reads the lot's state. */
export function placeHoldLotToDaml(lot: PlaceHoldLot, holdType: HoldType, fieldPath: string): DamlPlaceHoldLot {
  requireRecord(lot, fieldPath);
  const securityId = requireText(lot.security_id, `${fieldPath}.security_id`);
  const quantity = lot.quantity ?? null;
  const origin = lot.origin_issuance ?? null;
  if (holdType === 'REGISTER_SETTLEMENT') {
    if (quantity === null) {
      throw new OcpValidationError(`${fieldPath}.quantity`, 'a settlement hold needs a quantity', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    if (origin === null) {
      throw new OcpValidationError(
        `${fieldPath}.origin_issuance`,
        "a settlement hold needs the security's origin issuance",
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        }
      );
    }
  } else if (quantity !== null) {
    throw new OcpValidationError(`${fieldPath}.quantity`, 'a stop holds the whole security and takes no quantity', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: quantity,
    });
  }
  return {
    security_id: securityId,
    quantity: quantity === null ? null : requireDecimal(quantity, `${fieldPath}.quantity`),
    origin_issuance: origin === null ? null : contractIdArgument(origin, `${fieldPath}.origin_issuance`),
  };
}

/** A hold to cancel; the ledger refuses a cancellation without a reason. */
export function cancelHoldToDaml(hold: CancelHold, fieldPath: string): DamlCancelHold {
  requireRecord(hold, fieldPath);
  const reasonText: unknown = hold.reason_text;
  if (typeof reasonText !== 'string' || reasonText === '') {
    throw new OcpValidationError(`${fieldPath}.reason_text`, 'a hold cancellation needs a reason', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: reasonText,
    });
  }
  return {
    security_id: requireText(hold.security_id, `${fieldPath}.security_id`),
    hold_id: requireText(hold.hold_id, `${fieldPath}.hold_id`),
    reason_text: reasonText,
  };
}

/** A draw lot. */
export function drawLotToDaml(lot: DrawLot, fieldPath: string): DamlDrawLot {
  requireRecord(lot, fieldPath);
  return {
    security_id: requireText(lot.security_id, `${fieldPath}.security_id`),
    hold_id: requireText(lot.hold_id, `${fieldPath}.hold_id`),
    quantity: requireDecimal(lot.quantity, `${fieldPath}.quantity`),
    custom_id: requireText(lot.custom_id, `${fieldPath}.custom_id`),
    share_price: monetaryToDaml(lot.share_price, `${fieldPath}.share_price`),
    buyer_cost_basis: monetaryToDaml(lot.buyer_cost_basis, `${fieldPath}.buyer_cost_basis`),
    balance_cost_basis:
      lot.balance_cost_basis === null
        ? null
        : monetaryToDaml(lot.balance_cost_basis, `${fieldPath}.balance_cost_basis`),
    balance_vestings: vestingsToDaml(lot.balance_vestings, `${fieldPath}.balance_vestings`),
    origin_issuance: contractIdArgument(lot.origin_issuance, `${fieldPath}.origin_issuance`),
  };
}

/** A settlement lot: a draw or a cancellation. */
export function settleLotToDaml(lot: SettleLot, fieldPath: string): DamlSettleLot {
  const record = requireRecord(lot, fieldPath);
  const { kind } = record;
  switch (lot.kind) {
    case 'draw':
      return { tag: 'SettleDraw', value: drawLotToDaml(lot.lot, `${fieldPath}.lot`) };
    case 'cancel':
      return { tag: 'SettleCancel', value: cancelHoldToDaml(lot.hold, `${fieldPath}.hold`) };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown settlement lot kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: "'draw' | 'cancel'",
        receivedValue: kind,
      });
  }
}

/** The buyer's stakeholder: an existing record's contract, or a new stakeholder the settlement creates. */
export function settleBuyerToDaml(buyer: SettleBuyer, fieldPath: string): DamlSettleBuyer {
  const record = requireRecord(buyer, fieldPath);
  const { kind } = record;
  switch (buyer.kind) {
    case 'existing':
      return { tag: 'SettleBuyerExisting', value: contractIdArgument(buyer.contractId, `${fieldPath}.contractId`) };
    case 'new':
      requireRecord(buyer.stakeholder, `${fieldPath}.stakeholder`);
      return { tag: 'SettleBuyerNew', value: convertToDamlData('stakeholder', buyer.stakeholder) };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown settlement buyer kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: "'existing' | 'new'",
        receivedValue: kind,
      });
  }
}

/** The Daml `OcfHoldType` of a native hold type. */
export function holdTypeToDaml(holdType: HoldType, fieldPath: string): Fairmint.OpenCapTable.Types.Stock.OcfHoldType {
  return damlEnumConstructor('OcfHoldType', holdType, fieldPath);
}

// ===== Teardown =====

/** A contract `CapTable_Purge` archives. */
export function purgeTargetToDaml(target: PurgeTarget, fieldPath: string): DamlPurgeTarget {
  const record = requireRecord(target, fieldPath);
  const { kind } = record;
  switch (target.kind) {
    case 'record':
      return {
        tag: 'PurgeRecord',
        value: recordCidToDaml({ entityType: target.entityType, contractId: target.contractId }, fieldPath),
      };
    case 'state':
      return { tag: 'PurgeState', value: contractIdArgument(target.contractId, `${fieldPath}.contractId`) };
    case 'epoch':
      return { tag: 'PurgeEpoch', value: contractIdArgument(target.contractId, `${fieldPath}.contractId`) };
    case 'shard':
      return { tag: 'PurgeShard', value: contractIdArgument(target.contractId, `${fieldPath}.contractId`) };
    default:
      throw new OcpValidationError(`${fieldPath}.kind`, 'Unknown purge target kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: "'record' | 'state' | 'epoch' | 'shard'",
        receivedValue: kind,
      });
  }
}
