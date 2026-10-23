/**
 * Manifests for the replay tests, built as the Daml Script scenarios in OCP's `Test/daml/OpenCapTable/` build their
 * books (`Harness.daml`'s `standardBook`, `StockHelpers.daml`, `EquityFixtures.daml`).
 */

import { deriveId } from '../../src/register/ids';
import { replayOcf } from '../../src/register/replay/replay';
import type { DerivedRole, ReplayResult, ReplayRule, ReplayStep } from '../../src/types/register';
import type { OcfManifest } from '../../src/utils/cantonOcfExtractor';

/** One manifest object. */
export type OcfJson = Record<string, unknown>;

export const CAP_TABLE_ID = 'test-1';
export const D2024 = '2024-01-01';
/** `TestStockEvents.daml`'s `eventDay` */
export const EVENT_DAY = '2024-03-01';
/** `TestSplits.daml`'s `splitDay` */
export const SPLIT_DAY = '2025-01-10';

const usd = (amount: string): OcfJson => ({ amount, currency: 'USD' });

export function issuer(): OcfJson {
  return {
    object_type: 'ISSUER',
    id: 'ISSUER-1',
    legal_name: 'Test Issuer Inc.',
    formation_date: '2020-01-15',
    country_of_formation: 'US',
  };
}

export function stakeholder(id: string): OcfJson {
  return {
    object_type: 'STAKEHOLDER',
    id,
    name: { legal_name: `Holder ${id}` },
    stakeholder_type: 'INDIVIDUAL',
  };
}

export function stockClass(id: string, extra: OcfJson = {}): OcfJson {
  return {
    object_type: 'STOCK_CLASS',
    id,
    class_type: 'COMMON',
    default_id_prefix: 'CS-',
    initial_shares_authorized: '10000000',
    name: `Common ${id}`,
    seniority: '1',
    votes_per_share: '1',
    ...extra,
  };
}

export function vestingTerms(id: string): OcfJson {
  return {
    object_type: 'VESTING_TERMS',
    id,
    name: `Terms ${id}`,
    description: 'All at once',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: [{ id: 'start', trigger: { type: 'VESTING_START_DATE' }, next_condition_ids: [] }],
  };
}

/** `Harness.daml`'s `issuance`: `quantity` shares at 1.00 USD, fully vested, with a cost basis of `quantity` USD. */
export function issuance(
  securityId: string,
  stakeholderId: string,
  stockClassId: string,
  quantity: string,
  date: string,
  extra: OcfJson = {}
): OcfJson {
  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id: `ISS-${securityId}`,
    custom_id: `C-${securityId}`,
    date,
    quantity,
    security_id: securityId,
    share_price: usd('1'),
    stakeholder_id: stakeholderId,
    stock_class_id: stockClassId,
    security_law_exemptions: [],
    stock_legend_ids: [],
    cost_basis: usd(quantity),
    ...extra,
  };
}

/** An output issuance for SH-`holder`'s `securityId` in CLS-A dated on `date`. */
export function out(securityId: string, stakeholderId: string, quantity: string, date = EVENT_DAY): OcfJson {
  return issuance(securityId, stakeholderId, 'CLS-A', quantity, date);
}

export function transfer(
  id: string,
  securityId: string,
  quantity: string,
  resulting: string[],
  balance: string | null,
  date = EVENT_DAY
): OcfJson {
  return {
    object_type: 'TX_STOCK_TRANSFER',
    id,
    date,
    quantity,
    security_id: securityId,
    resulting_security_ids: resulting,
    ...(balance === null ? {} : { balance_security_id: balance }),
  };
}

export function cancellation(
  id: string,
  securityId: string,
  quantity: string,
  balance: string | null,
  date = EVENT_DAY
): OcfJson {
  return {
    object_type: 'TX_STOCK_CANCELLATION',
    id,
    date,
    quantity,
    security_id: securityId,
    reason_text: 'Forfeited',
    ...(balance === null ? {} : { balance_security_id: balance }),
  };
}

export function repurchase(
  id: string,
  securityId: string,
  quantity: string,
  balance: string | null,
  date = EVENT_DAY
): OcfJson {
  return {
    object_type: 'TX_STOCK_REPURCHASE',
    id,
    date,
    price: usd('1'),
    quantity,
    security_id: securityId,
    ...(balance === null ? {} : { balance_security_id: balance }),
  };
}

export function conversion(
  id: string,
  securityId: string,
  quantity: string,
  resulting: string[],
  balance: string | null = null,
  date = EVENT_DAY
): OcfJson {
  return {
    object_type: 'TX_STOCK_CONVERSION',
    id,
    date,
    quantity_converted: quantity,
    security_id: securityId,
    resulting_security_ids: resulting,
    ...(balance === null ? {} : { balance_security_id: balance }),
  };
}

export function reissuance(
  id: string,
  securityId: string,
  resulting: string[],
  date = EVENT_DAY,
  splitId: string | null = null
): OcfJson {
  return {
    object_type: 'TX_STOCK_REISSUANCE',
    id,
    date,
    security_id: securityId,
    resulting_security_ids: resulting,
    ...(splitId === null ? {} : { split_transaction_id: splitId }),
  };
}

export function consolidation(id: string, securityIds: string[], resulting: string, date = EVENT_DAY): OcfJson {
  return {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id,
    date,
    security_ids: securityIds,
    resulting_security_id: resulting,
  };
}

export function acceptance(id: string, securityId: string, date: string): OcfJson {
  return { object_type: 'TX_STOCK_ACCEPTANCE', id, date, security_id: securityId };
}

export function retraction(id: string, securityId: string, date: string): OcfJson {
  return { object_type: 'TX_STOCK_RETRACTION', id, date, security_id: securityId, reason_text: 'Issued in error' };
}

export function vestingStart(id: string, securityId: string, date = D2024): OcfJson {
  return { object_type: 'TX_VESTING_START', id, date, security_id: securityId, vesting_condition_id: 'start' };
}

/** `EquityFixtures.daml`'s `acceleration`, dated 2025-01-01 unless given. */
export function acceleration(id: string, securityId: string, quantity: string, date = '2025-01-01'): OcfJson {
  return {
    object_type: 'TX_VESTING_ACCELERATION',
    id,
    date,
    quantity,
    security_id: securityId,
    reason_text: 'Accelerated by board resolution',
  };
}

export function split(id: string, stockClassId: string, numerator: string, denominator: string, date: string): OcfJson {
  return {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id,
    date,
    stock_class_id: stockClassId,
    split_ratio: { numerator, denominator },
  };
}

export function tranche(amount: string, date: string): OcfJson {
  return { amount, date };
}

/** A manifest holding these records, each in its category, in this order. */
export function manifestOf(records: readonly OcfJson[]): OcfManifest {
  const manifest: OcfManifest = {
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    financings: [],
    stockLegendTemplates: [],
  };
  const category: Record<string, keyof Omit<OcfManifest, 'issuer'>> = {
    STAKEHOLDER: 'stakeholders',
    STOCK_CLASS: 'stockClasses',
    STOCK_PLAN: 'stockPlans',
    VESTING_TERMS: 'vestingTerms',
    VALUATION: 'valuations',
    DOCUMENT: 'documents',
    FINANCING: 'financings',
    STOCK_LEGEND_TEMPLATE: 'stockLegendTemplates',
  };
  for (const record of records) {
    const objectType = String(record['object_type']);
    if (objectType === 'ISSUER') manifest.issuer = record;
    else manifest[category[objectType] ?? 'transactions'].push(record);
  }
  return manifest;
}

/**
 * `Harness.daml`'s `standardBook`: stakeholders SH-A and SH-B, class CLS-A, and Alice's lots S-A1 (600) and S-A2
 * (400), issued on 2024-01-01; then these records.
 */
export function standardBook(...records: OcfJson[]): OcfManifest {
  return manifestOf([
    issuer(),
    stakeholder('SH-A'),
    stakeholder('SH-B'),
    stockClass('CLS-A'),
    issuance('S-A1', 'SH-A', 'CLS-A', '600', D2024),
    issuance('S-A2', 'SH-A', 'CLS-A', '400', D2024),
    ...records,
  ]);
}

/** Replays the standard book plus these records, with the test cap table ID. */
export function replayBook(...records: OcfJson[]): ReplayResult {
  return replayOcf(standardBook(...records), { capTableId: CAP_TABLE_ID });
}

/** The rules of a replay's violations, in order. */
export function rulesOf(result: ReplayResult): ReplayRule[] {
  return result.violations.map((violation) => violation.rule);
}

/** The ID the ledger derives for an event on a state of the test cap table. */
export function derived(securityId: string, seq: number, role: DerivedRole, index = 0): string {
  return deriveId({ capTableId: CAP_TABLE_ID, securityId, seq, role, index });
}

/** A state's quantity in a replay, or `undefined` when it has none. */
export function quantityOf(result: ReplayResult, securityId: string): string | undefined {
  return result.states.get(securityId)?.quantity;
}

/** A replay's last step. */
export function lastStep(result: ReplayResult): ReplayStep | undefined {
  return result.steps[result.steps.length - 1];
}
