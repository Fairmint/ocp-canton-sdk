/**
 * Decode `Fairmint.OpenCapTable.Positions.StockPosition` payloads (OpenCapTable-v34 0.0.4) from the JSON Ledger API.
 *
 * The published 0.0.3 bindings have no codec for this template, so the decoder below follows the Daml declarations
 * field for field and fails with a parse error on any mismatch.
 *
 * @module decodeStockPosition
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { damlTimeToMicros } from '../../../utils/damlTime';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { isRecord, parseDamlMap } from '../../../utils/typeConversions';
import { stockIssuanceDataToOcf } from '../stockIssuance/getStockIssuanceAsOcf';
import type {
  HoldPurpose,
  LedgerVesting,
  LotHold,
  PositionContext,
  PositionLot,
  StockPositionData,
  VestingSnapshot,
} from './positionTypes';

const HOLD_PURPOSES: ReadonlySet<string> = new Set<HoldPurpose>([
  'HoldPurposeRegisterSettlement',
  'HoldPurposeStopTransfer',
  'HoldPurposeScripMint',
]);

function positionParseError(message: string, source: string, contractId: string, cause?: unknown): OcpParseError {
  return new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_stock_position',
    context: { contractId },
    ...(cause instanceof Error ? { cause } : {}),
  });
}

function requireRecord(value: unknown, source: string, contractId: string): Record<string, unknown> {
  if (!isRecord(value)) throw positionParseError(`${source} must be an object`, source, contractId);
  return value;
}

function requireText(value: unknown, source: string, contractId: string, nonEmpty = true): string {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) {
    throw positionParseError(`${source} must be a ${nonEmpty ? 'non-empty ' : ''}string`, source, contractId);
  }
  return value;
}

/** A DAML `Time`, kept as the ledger wrote it once it is known to be one. */
function requireTime(value: unknown, source: string, contractId: string): string {
  const text = requireText(value, source, contractId);
  if (damlTimeToMicros(text) === null) {
    throw positionParseError(`${source} must be a DAML Time (RFC 3339 with an offset)`, source, contractId);
  }
  return text;
}

function requireDecimal(value: unknown, source: string, contractId: string): string {
  const text = typeof value === 'number' ? value.toString() : value;
  if (typeof text !== 'string') throw positionParseError(`${source} must be a Decimal string`, source, contractId);
  const canonical = canonicalizeNumeric10(text);
  if (!canonical.ok) throw positionParseError(`${source}: ${canonical.message}`, source, contractId);
  return canonical.value;
}

function decodeContext(value: unknown, contractId: string): PositionContext {
  const context = requireRecord(value, 'StockPosition.context', contractId);
  return {
    issuer: requireText(context.issuer, 'StockPosition.context.issuer', contractId),
    system_operator: requireText(context.system_operator, 'StockPosition.context.system_operator', contractId),
  };
}

function decodeHold(value: unknown, source: string, contractId: string): LotHold {
  const hold = requireRecord(value, source, contractId);
  const purpose = requireText(hold.purpose, `${source}.purpose`, contractId);
  if (!HOLD_PURPOSES.has(purpose)) {
    throw new OcpParseError(`Unknown hold purpose ${purpose}`, {
      source: `${source}.purpose`,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      classification: 'invalid_stock_position',
      context: { contractId },
    });
  }
  return {
    purpose: purpose as HoldPurpose,
    reference: requireText(hold.reference, `${source}.reference`, contractId, false),
    quantity:
      hold.quantity === undefined || hold.quantity === null
        ? null
        : requireDecimal(hold.quantity, `${source}.quantity`, contractId),
  };
}

function decodeLedgerVestings(value: unknown, source: string, contractId: string): LedgerVesting[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw positionParseError(`${source} must be an array`, source, contractId);
  return value.map((item, index) => {
    const vesting = requireRecord(item, `${source}[${index}]`, contractId);
    return {
      date: requireTime(vesting.date, `${source}[${index}].date`, contractId),
      amount: requireDecimal(vesting.amount, `${source}[${index}].amount`, contractId),
    };
  });
}

function decodeVestingSnapshot(value: unknown, source: string, contractId: string): VestingSnapshot | null {
  if (value === undefined || value === null) return null;
  const snapshot = requireRecord(value, source, contractId);
  return {
    vested_quantity: requireDecimal(snapshot.vested_quantity, `${source}.vested_quantity`, contractId),
    as_of: requireTime(snapshot.as_of, `${source}.as_of`, contractId),
  };
}

function decodeLot(securityId: string, value: unknown, contractId: string): PositionLot {
  const source = `StockPosition.lots[${securityId}]`;
  const lot = requireRecord(value, source, contractId);
  const issuanceData = requireRecord(lot.issuance, `${source}.issuance`, contractId);
  let issuance;
  try {
    issuance = stockIssuanceDataToOcf(
      issuanceData as unknown as Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData
    );
  } catch (error) {
    throw positionParseError(
      `${source}.issuance is not a valid stock issuance: ${error instanceof Error ? error.message : String(error)}`,
      `${source}.issuance`,
      contractId,
      error
    );
  }
  // positionOk: a lot is keyed by its own security_id.
  if (issuance.security_id !== securityId) {
    throw positionParseError(
      `${source} is keyed by ${securityId} but its issuance is for ${issuance.security_id}`,
      `${source}.issuance.security_id`,
      contractId
    );
  }
  const holds = lot.holds === undefined ? [] : lot.holds;
  if (!Array.isArray(holds))
    throw positionParseError(`${source}.holds must be an array`, `${source}.holds`, contractId);
  return {
    issuance,
    ledgerVestings: decodeLedgerVestings(issuanceData.vestings, `${source}.issuance.vestings`, contractId),
    holds: holds.map((hold, index) => decodeHold(hold, `${source}.holds[${index}]`, contractId)),
    vesting_snapshot: decodeVestingSnapshot(lot.vesting_snapshot, `${source}.vesting_snapshot`, contractId),
  };
}

/**
 * Decode a `StockPosition` create argument.
 *
 * @param createArgument - The contract's create argument, as the JSON Ledger API v2 returns it
 * @param contractId - The contract ID, for diagnostics
 * @throws OcpParseError when the payload does not match the Daml template
 */
export function decodeStockPosition(createArgument: unknown, contractId: string): StockPositionData {
  const payload = requireRecord(createArgument, 'StockPosition', contractId);
  if (payload.lots === undefined || payload.lots === null) {
    throw positionParseError('StockPosition.lots is missing', 'StockPosition.lots', contractId);
  }
  let lotEntries: Array<[string, unknown]>;
  try {
    lotEntries = parseDamlMap<string, unknown>(payload.lots);
  } catch (error) {
    throw positionParseError('StockPosition.lots is not a DAML Map', 'StockPosition.lots', contractId, error);
  }
  return {
    context: decodeContext(payload.context, contractId),
    stock_class_id: requireText(payload.stock_class_id, 'StockPosition.stock_class_id', contractId),
    stakeholder_id: requireText(payload.stakeholder_id, 'StockPosition.stakeholder_id', contractId),
    holder: requireText(payload.holder, 'StockPosition.holder', contractId),
    lots: new Map(lotEntries.map(([securityId, lot]) => [securityId, decodeLot(securityId, lot, contractId)])),
  };
}
