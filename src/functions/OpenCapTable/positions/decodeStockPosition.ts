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
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { isRecord, parseDamlMap } from '../../../utils/typeConversions';
import { stockIssuanceDataToOcf } from '../stockIssuance/getStockIssuanceAsOcf';
import type { HoldPurpose, LotHold, PositionContext, PositionLot, StockPositionData } from './positionTypes';

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

/** `Optional a`: absent and `null` are `None`. */
function optionalText(value: unknown, source: string, contractId: string): string | null {
  return value === undefined || value === null ? null : requireText(value, source, contractId);
}

function requireDecimal(value: unknown, source: string, contractId: string): string {
  const text = typeof value === 'number' ? value.toString() : value;
  if (typeof text !== 'string') throw positionParseError(`${source} must be a Decimal string`, source, contractId);
  const canonical = canonicalizeNumeric10(text);
  if (!canonical.ok) throw positionParseError(`${source}: ${canonical.message}`, source, contractId);
  return canonical.value;
}

function textList(value: unknown, source: string, contractId: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw positionParseError(`${source} must be an array`, source, contractId);
  return value.map((item, index) => requireText(item, `${source}[${index}]`, contractId));
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
    date: requireText(hold.date, `${source}.date`, contractId),
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
    origin_security_id: requireText(lot.origin_security_id, `${source}.origin_security_id`, contractId),
    origin_date: requireText(lot.origin_date, `${source}.origin_date`, contractId),
    ancestry: textList(lot.ancestry, `${source}.ancestry`, contractId),
    holds: holds.map((hold, index) => decodeHold(hold, `${source}.holds[${index}]`, contractId)),
    fully_vested_on: optionalText(lot.fully_vested_on, `${source}.fully_vested_on`, contractId),
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
