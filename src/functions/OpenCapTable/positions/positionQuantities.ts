/**
 * Held, vested and drawable quantities of position lots, computed exactly as OCP's `Fairmint.OpenCapTable.Positions`
 * helpers do (OpenCapTable-v34 0.0.4):
 *
 * ```haskell
 * vestedQuantity asOf lot = min byTranches bySchedule
 *   where
 *     whole = lot.issuance.quantity
 *     byTranches = if null lot.issuance.vestings then whole
 *       else min whole (sum [v.amount | v <- lot.issuance.vestings, v.date <= asOf])
 *     bySchedule = case (lot.issuance.vesting_terms_id, lot.vesting_snapshot) of
 *       (None, _) -> whole
 *       (Some _, Some s) | s.as_of <= asOf -> s.vested_quantity
 *       _ -> 0.0
 * lotIsStopped lot = any (\h -> h.purpose == HoldPurposeStopTransfer) lot.holds
 * heldQuantity lot = sum (mapOptional (.quantity) (filter isQuantityHold lot.holds))
 * drawableQuantity asOf lot =
 *   if lotIsStopped lot then 0.0 else max 0.0 (vestedQuantity asOf lot - heldQuantity lot)
 * ```
 *
 * Decimals are summed as integer units of 10^-10 (DAML Numeric 10), never as floating point, and `Time` values are
 * compared as integer microseconds, the precision of a DAML `Time`.
 *
 * @module positionQuantities
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { SecurityExemption } from '../../../types/native';
import { damlTimeToMicros, dateToMicros, microsToDamlTime } from '../../../utils/damlTime';
import { numeric10ToUnits, unitsToNumeric10 } from '../../../utils/numeric10';
import type {
  LotHold,
  PositionLot,
  PositionLotQuantities,
  PositionQuantities,
  RestrictionBucket,
  RestrictionBucketQuantities,
  StockPositionData,
  StockPositionState,
} from './positionTypes';

function invalidPosition(source: string, message: string): OcpParseError {
  return new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_stock_position',
  });
}

function units(value: string, source: string): bigint {
  const parsed = numeric10ToUnits(value);
  if (parsed === null) throw invalidPosition(source, `${source} is not a DAML Numeric(10) value: ${value}`);
  return parsed;
}

function micros(value: string, source: string): bigint {
  const parsed = damlTimeToMicros(value);
  if (parsed === null) throw invalidPosition(source, `${source} is not a DAML Time: ${value}`);
  return parsed;
}

/**
 * The instant to compute vested and drawable quantities for, as microseconds since the epoch.
 *
 * @param asOf - A `Date`, or a DAML `Time` (RFC 3339 with an offset)
 * @throws OcpValidationError when `asOf` is neither
 */
export function asOfMicros(asOf: Date | string): bigint {
  const parsed = asOf instanceof Date ? dateToMicros(asOf) : typeof asOf === 'string' ? damlTimeToMicros(asOf) : null;
  if (parsed === null) {
    throw new OcpValidationError('asOf', 'Expected a valid Date or a DAML Time (RFC 3339 with an offset)', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'Date | RFC 3339 date-time with Z or numeric offset',
      receivedValue: asOf,
    });
  }
  return parsed;
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** OCP `isQuantityHold`: register-settlement and scrip-mint holds hold a quantity; a stop locks the whole lot. */
function isQuantityHold(hold: LotHold): boolean {
  return hold.purpose !== 'HoldPurposeStopTransfer';
}

/** OCP `lotIsStopped`: the lot carries a stop, so it cannot be drawn and has nothing drawable. */
export function lotIsStopped(lot: PositionLot): boolean {
  return lot.holds.some((hold) => hold.purpose === 'HoldPurposeStopTransfer');
}

function heldUnits(lot: PositionLot): bigint {
  let held = 0n;
  for (const hold of lot.holds) {
    if (isQuantityHold(hold) && hold.quantity !== null) {
      held += units(hold.quantity, `lot ${lot.issuance.security_id} hold ${hold.reference}`);
    }
  }
  return held;
}

function vestedUnits(asOf: bigint, lot: PositionLot): bigint {
  const securityId = lot.issuance.security_id;
  const whole = units(lot.issuance.quantity, `lot ${securityId} quantity`);
  let byTranches = whole;
  if (lot.ledgerVestings.length > 0) {
    let vested = 0n;
    lot.ledgerVestings.forEach((vesting, index) => {
      const vestsAt = micros(vesting.date, `lot ${securityId} vestings[${index}].date`);
      if (vestsAt <= asOf) vested += units(vesting.amount, `lot ${securityId} vestings[${index}].amount`);
    });
    byTranches = min(whole, vested);
  }
  const snapshot = lot.vesting_snapshot;
  // OCP `Optional Text`: an issuance on the ledger never carries `Some ""`, which StockIssuance validation rejects.
  const bySchedule =
    lot.issuance.vesting_terms_id === undefined
      ? whole
      : snapshot !== null && micros(snapshot.as_of, `lot ${securityId} vesting_snapshot.as_of`) <= asOf
        ? units(snapshot.vested_quantity, `lot ${securityId} vesting_snapshot.vested_quantity`)
        : 0n;
  return min(byTranches, bySchedule);
}

interface Units {
  total: bigint;
  held: bigint;
  vested: bigint;
  drawable: bigint;
}

function lotUnits(asOf: bigint, lot: PositionLot): Units {
  const total = units(lot.issuance.quantity, `lot ${lot.issuance.security_id} quantity`);
  const held = heldUnits(lot);
  const vested = vestedUnits(asOf, lot);
  const unheld = vested - held;
  return { total, held, vested, drawable: lotIsStopped(lot) || unheld < 0n ? 0n : unheld };
}

/** OCP `heldQuantity`: the sum of the lot's quantity holds. */
export function heldQuantity(lot: PositionLot): string {
  return unitsToNumeric10(heldUnits(lot));
}

/** OCP `vestedQuantity` as of `asOf` (a `Date`, or a DAML `Time`). */
export function vestedQuantity(asOf: Date | string, lot: PositionLot): string {
  return unitsToNumeric10(vestedUnits(asOfMicros(asOf), lot));
}

/**
 * OCP `drawableQuantity` as of `asOf` (a `Date`, or a DAML `Time`): nothing while the lot is stopped, else its vested
 * quantity less its quantity holds, never below zero.
 */
export function drawableQuantity(asOf: Date | string, lot: PositionLot): string {
  return unitsToNumeric10(lotUnits(asOfMicros(asOf), lot).drawable);
}

/** Order strings by UTF-16 code units, as Daml compares Text. */
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * The restriction bucket a lot falls in: its legend IDs and exemptions, each deduplicated and sorted, so two lots
 * share a bucket exactly when the lists are equal as sets.
 */
function lotRestrictionBucket(lot: PositionLot): RestrictionBucket {
  const stockLegendIds = [...new Set(lot.issuance.stock_legend_ids)].sort(compareCodeUnits);
  const exemptions = new Map<string, SecurityExemption>();
  for (const exemption of lot.issuance.security_law_exemptions) {
    const { jurisdiction, description } = exemption;
    exemptions.set(JSON.stringify([jurisdiction, description]), { jurisdiction, description });
  }
  const securityLawExemptions = [...exemptions.values()].sort(
    (a, b) => compareCodeUnits(a.jurisdiction, b.jurisdiction) || compareCodeUnits(a.description, b.description)
  );
  return { stockLegendIds, securityLawExemptions };
}

function bucketKey(bucket: RestrictionBucket): string {
  return JSON.stringify([
    bucket.stockLegendIds,
    bucket.securityLawExemptions.map((exemption) => [exemption.jurisdiction, exemption.description]),
  ]);
}

function zeroUnits(): Units {
  return { total: 0n, held: 0n, vested: 0n, drawable: 0n };
}

function addUnits(into: Units, from: Units): void {
  into.total += from.total;
  into.held += from.held;
  into.vested += from.vested;
  into.drawable += from.drawable;
}

function quantities(sums: Units): PositionQuantities {
  return {
    total: unitsToNumeric10(sums.total),
    held: unitsToNumeric10(sums.held),
    vested: unitsToNumeric10(sums.vested),
    drawable: unitsToNumeric10(sums.drawable),
  };
}

/**
 * Derive per-lot, per-bucket and position totals for a decoded `StockPosition`, with vested and drawable quantities as
 * of one instant.
 *
 * @param contractId - The position's contract ID
 * @param templateId - The template ID as the ledger returned it
 * @param position - The decoded payload
 * @param asOf - The instant vested and drawable quantities are computed for: a `Date`, or a DAML `Time`
 * @throws OcpValidationError when `asOf` is neither
 */
export function summarizeStockPosition(
  contractId: string,
  templateId: string,
  position: StockPositionData,
  asOf: Date | string
): StockPositionState {
  const instant = asOfMicros(asOf);
  const lots: PositionLotQuantities[] = [];
  const totals = zeroUnits();
  const buckets = new Map<string, { bucket: RestrictionBucket; securityIds: string[]; sums: Units }>();

  for (const [securityId, lot] of position.lots) {
    const lotSums = lotUnits(instant, lot);
    lots.push({ securityId, stopped: lotIsStopped(lot), ...quantities(lotSums) });
    addUnits(totals, lotSums);

    const bucket = lotRestrictionBucket(lot);
    const key = bucketKey(bucket);
    let entry = buckets.get(key);
    if (entry === undefined) {
      entry = { bucket, securityIds: [], sums: zeroUnits() };
      buckets.set(key, entry);
    }
    entry.securityIds.push(securityId);
    addUnits(entry.sums, lotSums);
  }

  return {
    contractId,
    templateId,
    position,
    asOf: microsToDamlTime(instant),
    totals: quantities(totals),
    lots,
    buckets: [...buckets.values()].map((entry): RestrictionBucketQuantities => ({
      bucket: entry.bucket,
      securityIds: entry.securityIds,
      ...quantities(entry.sums),
    })),
  };
}
