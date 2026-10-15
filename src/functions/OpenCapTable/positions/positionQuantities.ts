/**
 * Held and free quantities of position lots, computed exactly as OCP's `Fairmint.OpenCapTable.Positions` helpers do:
 *
 * - `lotIsStopped lot = any (\h -> h.purpose == HoldPurposeStopTransfer) lot.holds`
 * - `lotHeldQuantity lot = sum (mapOptional (.quantity) (filter isQuantityHold lot.holds))`
 * - `lotFreeQuantity lot = if lotIsStopped lot then 0.0 else lot.issuance.quantity - lotHeldQuantity lot`
 *
 * Decimals are summed as integer units of 10^-10 (DAML Numeric 10), never as floating point.
 *
 * @module positionQuantities
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { SecurityExemption } from '../../../types/native';
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

function units(value: string, source: string): bigint {
  const parsed = numeric10ToUnits(value);
  if (parsed === null) {
    throw new OcpParseError(`${source} is not a DAML Numeric(10) value: ${value}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_stock_position',
    });
  }
  return parsed;
}

/** OCP `isQuantityHold`: register-settlement and scrip-mint holds hold a quantity; a stop locks the whole lot. */
export function isQuantityHold(hold: LotHold): boolean {
  return hold.purpose !== 'HoldPurposeStopTransfer';
}

/** OCP `lotIsStopped`: the lot carries a stop, so it cannot be drawn and has no free quantity. */
export function lotIsStopped(lot: PositionLot): boolean {
  return lot.holds.some((hold) => hold.purpose === 'HoldPurposeStopTransfer');
}

function lotHeldUnits(lot: PositionLot): bigint {
  let held = 0n;
  for (const hold of lot.holds) {
    if (isQuantityHold(hold) && hold.quantity !== null) {
      held += units(hold.quantity, `lot ${lot.issuance.security_id} hold ${hold.reference}`);
    }
  }
  return held;
}

function lotUnits(lot: PositionLot): { total: bigint; held: bigint; free: bigint } {
  const total = units(lot.issuance.quantity, `lot ${lot.issuance.security_id} quantity`);
  const held = lotHeldUnits(lot);
  return { total, held, free: lotIsStopped(lot) ? 0n : total - held };
}

/** OCP `lotHeldQuantity`: the sum of the lot's quantity holds. */
export function lotHeldQuantity(lot: PositionLot): string {
  return unitsToNumeric10(lotHeldUnits(lot));
}

/** OCP `lotFreeQuantity`: nothing while the lot is stopped, else its quantity less its quantity holds. */
export function lotFreeQuantity(lot: PositionLot): string {
  return unitsToNumeric10(lotUnits(lot).free);
}

function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * The restriction bucket a lot falls in: its legend IDs and exemptions, each deduplicated and sorted, so two lots
 * share a bucket exactly when the lists are equal as sets.
 */
export function lotRestrictionBucket(lot: PositionLot): RestrictionBucket {
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

function quantities(sums: { total: bigint; held: bigint; free: bigint }): PositionQuantities {
  return {
    total: unitsToNumeric10(sums.total),
    held: unitsToNumeric10(sums.held),
    free: unitsToNumeric10(sums.free),
  };
}

/**
 * Derive per-lot, per-bucket and position totals for a decoded `StockPosition`.
 *
 * @param contractId - The position's contract ID
 * @param templateId - The template ID as the ledger returned it
 * @param position - The decoded payload
 */
export function summarizeStockPosition(
  contractId: string,
  templateId: string,
  position: StockPositionData
): StockPositionState {
  const lots: PositionLotQuantities[] = [];
  const totals = { total: 0n, held: 0n, free: 0n };
  const buckets = new Map<
    string,
    { bucket: RestrictionBucket; securityIds: string[]; sums: { total: bigint; held: bigint; free: bigint } }
  >();

  for (const [securityId, lot] of position.lots) {
    const lotSums = lotUnits(lot);
    lots.push({ securityId, stopped: lotIsStopped(lot), ...quantities(lotSums) });
    totals.total += lotSums.total;
    totals.held += lotSums.held;
    totals.free += lotSums.free;

    const bucket = lotRestrictionBucket(lot);
    const key = bucketKey(bucket);
    let entry = buckets.get(key);
    if (entry === undefined) {
      entry = { bucket, securityIds: [], sums: { total: 0n, held: 0n, free: 0n } };
      buckets.set(key, entry);
    }
    entry.securityIds.push(securityId);
    entry.sums.total += lotSums.total;
    entry.sums.held += lotSums.held;
    entry.sums.free += lotSums.free;
  }

  return {
    contractId,
    templateId,
    position,
    totals: quantities(totals),
    lots,
    buckets: [...buckets.values()].map((entry): RestrictionBucketQuantities => ({
      bucket: entry.bucket,
      securityIds: entry.securityIds,
      ...quantities(entry.sums),
    })),
  };
}
