/**
 * Extract full OCF data from Canton for verification and comparison.
 *
 * Provides utilities to fetch all OCF objects from Canton and transform them
 * into a manifest format for cap table processing.
 *
 * The returned manifest structure is compatible with external OCF processing tools
 * like buildCaptableInput/processCapTable from the fairmint/api repository.
 *
 * @module cantonOcfExtractor
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/batchTypes';
import type { SupportedOcfReadType } from '../functions/OpenCapTable/capTable/damlToOcf';
import { getEntityAsOcf } from '../functions/OpenCapTable/capTable/damlToOcf';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import { getConvertibleIssuanceAsOcf } from '../functions/OpenCapTable/convertibleIssuance';
import { getDocumentAsOcf } from '../functions/OpenCapTable/document';
import { getEquityCompensationExerciseAsOcf } from '../functions/OpenCapTable/equityCompensationExercise';
import { getEquityCompensationIssuanceAsOcf } from '../functions/OpenCapTable/equityCompensationIssuance';
import { getIssuerAsOcf } from '../functions/OpenCapTable/issuer';
import { getIssuerAuthorizedSharesAdjustmentAsOcf } from '../functions/OpenCapTable/issuerAuthorizedSharesAdjustment';
import { getStakeholderAsOcf } from '../functions/OpenCapTable/stakeholder';
import { getStockClassAsOcf } from '../functions/OpenCapTable/stockClass';
import { getStockClassAuthorizedSharesAdjustmentAsOcf } from '../functions/OpenCapTable/stockClassAuthorizedSharesAdjustment';
import { getStockIssuanceAsOcf } from '../functions/OpenCapTable/stockIssuance';
import { getStockLegendTemplateAsOcf } from '../functions/OpenCapTable/stockLegendTemplate';
import { getStockPlanAsOcf } from '../functions/OpenCapTable/stockPlan';
import { getStockPlanPoolAdjustmentAsOcf } from '../functions/OpenCapTable/stockPlanPoolAdjustment';
import { getValuationAsOcf } from '../functions/OpenCapTable/valuation';
import { getVestingTermsAsOcf } from '../functions/OpenCapTable/vestingTerms';
import { getWarrantIssuanceAsOcf } from '../functions/OpenCapTable/warrantIssuance';

// ===== Transaction Sorting =====
// These utilities ensure Canton transactions are sorted consistently with DB data.
// The cap table engine processes transactions in array order, so sorting is critical.

/**
 * Safe timestamp helper - returns milliseconds or defaultValue.
 * Handles Invalid Date by returning defaultValue.
 */
function getTimestamp(input: unknown, defaultValue: number): number {
  if (input == null) return defaultValue;
  const ms = typeof input === 'number' ? input : new Date(input as string).getTime();
  return Number.isNaN(ms) ? defaultValue : ms;
}

/**
 * Safe timestamp helper that can return null.
 * Used when we need to distinguish "missing" from "zero".
 */
function getTimestampOrNull(input: unknown): number | null {
  if (input == null) return null;
  const ms = typeof input === 'number' ? input : new Date(input as string).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Compute intra-day ordering weight for a transaction.
 *
 * Lower weights are processed first within the same day.
 * This ensures domain-correct ordering: issuances before exercises,
 * acceptances before splits, transfers before conversions, etc.
 */
function txWeight(tx: Record<string, unknown>): number {
  switch (tx.object_type) {
    case 'TX_VESTING_START':
      return 12;
    case 'TX_VESTING_EVENT':
      return 13;
    case 'TX_VESTING_ACCELERATION':
      return 14;
    case 'TX_STOCK_REISSUANCE':
      return 9;
    case 'TX_STOCK_ISSUANCE':
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
    case 'TX_WARRANT_ISSUANCE':
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 10; // creations first
    case 'TX_STOCK_ACCEPTANCE':
    case 'TX_WARRANT_ACCEPTANCE':
    case 'TX_EQUITY_COMPENSATION_ACCEPTANCE':
    case 'TX_PLAN_SECURITY_ACCEPTANCE':
      return 11;
    case 'TX_STOCK_CLASS_SPLIT':
      return 15;
    case 'TX_STOCK_RETRACTION':
      return 16;
    case 'TX_STOCK_CONSOLIDATION':
      return 17;
    case 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT':
      return 18;
    case 'TX_EQUITY_COMPENSATION_REPRICING':
      return 19;
    case 'TX_STOCK_TRANSFER':
    case 'TX_WARRANT_TRANSFER':
    case 'TX_CONVERTIBLE_TRANSFER':
    case 'TX_EQUITY_COMPENSATION_TRANSFER':
    case 'TX_PLAN_SECURITY_TRANSFER':
      return 20;
    case 'TX_CONVERTIBLE_ACCEPTANCE':
      return 22;
    case 'TX_EQUITY_COMPENSATION_EXERCISE':
    case 'TX_WARRANT_EXERCISE':
      return 30;
    case 'TX_CONVERTIBLE_CONVERSION':
      return 35;
    case 'TX_STOCK_REPURCHASE':
    case 'TX_STOCK_CANCELLATION':
    case 'TX_EQUITY_COMPENSATION_CANCELLATION':
    case 'TX_WARRANT_CANCELLATION':
    case 'TX_CONVERTIBLE_CANCELLATION':
      return 40;
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
      return 5;
    default:
      return 50;
  }
}

/**
 * Build a composite sort key for deterministic same-day ordering.
 *
 * Key structure: day|weight|group|created|id
 * This ensures:
 * - Same-day transactions are ordered by domain weight
 * - Within same weight, grouped by security_id for locality
 * - Within same group, ordered by created timestamp
 * - Final tiebreaker by transaction id for determinism
 */
function buildTransactionSortKey(tx: Record<string, unknown>): string {
  const dateMs = getTimestamp(tx.date, 0);
  const day = new Date(dateMs).toISOString().slice(0, 10);
  const weight = String(txWeight(tx)).padStart(3, '0');
  const group = typeof tx.security_id === 'string' ? tx.security_id : '_no_security_';

  const createdMs = getTimestampOrNull(tx.createdAt ?? tx.created_at);
  const created = createdMs !== null ? new Date(createdMs).toISOString() : '9999-12-31T23:59:59.999Z';

  // Safe string conversion for transaction ID
  const id = typeof tx.id === 'string' ? tx.id : '';

  return `${day}|${weight}|${group}|${created}|${id}`;
}

/**
 * Sort transactions with domain-aware same-day ordering.
 *
 * This ensures Canton transactions are sorted consistently with DB data.
 * The cap table engine processes transactions in array order, so this
 * sorting is critical for producing identical outputs.
 */
function sortTransactions(transactions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...transactions].sort((a, b) => {
    const ka = buildTransactionSortKey(a);
    const kb = buildTransactionSortKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
}

/**
 * Core OCF entity types that have dedicated `get*AsOcf` functions.
 * These are not included in SupportedOcfReadType but need special handling.
 */
export const CORE_ENTITY_TYPES: Set<OcfEntityType> = new Set([
  'stakeholder',
  'stockClass',
  'stockPlan',
  'vestingTerms',
]);

/**
 * Entity types that are classified as transactions for buildCaptableInput.
 * All entity types except core objects and a few non-transaction types.
 */
export const TRANSACTION_ENTITY_TYPES: Set<OcfEntityType> = new Set([
  // Stock Transactions
  'stockIssuance',
  'stockTransfer',
  'stockCancellation',
  'stockRetraction',
  'stockRepurchase',
  'stockAcceptance',
  'stockReissuance',
  'stockConversion',
  'stockConsolidation',
  // Stock Class Adjustments
  'stockClassAuthorizedSharesAdjustment',
  'stockClassConversionRatioAdjustment',
  'stockClassSplit',
  'issuerAuthorizedSharesAdjustment',
  // Stock Plan Events
  'stockPlanPoolAdjustment',
  'stockPlanReturnToPool',
  // Convertible Transactions
  'convertibleIssuance',
  'convertibleTransfer',
  'convertibleCancellation',
  'convertibleRetraction',
  'convertibleAcceptance',
  'convertibleConversion',
  // Warrant Transactions
  'warrantIssuance',
  'warrantTransfer',
  'warrantCancellation',
  'warrantAcceptance',
  'warrantExercise',
  'warrantRetraction',
  // Equity Compensation Transactions
  'equityCompensationIssuance',
  'equityCompensationTransfer',
  'equityCompensationCancellation',
  'equityCompensationRetraction',
  'equityCompensationAcceptance',
  'equityCompensationRelease',
  'equityCompensationExercise',
  'equityCompensationRepricing',
  // Stakeholder Events
  'stakeholderRelationshipChangeEvent',
  'stakeholderStatusChangeEvent',
  // Vesting Events
  'vestingAcceleration',
  'vestingEvent',
  'vestingStart',
]);

/**
 * Entity types supported by getEntityAsOcf dispatcher.
 * This matches the SupportedOcfReadType from damlToOcf.ts.
 */
export const SUPPORTED_READ_TYPES: Set<SupportedOcfReadType> = new Set<SupportedOcfReadType>([
  // Acceptance types
  'stockAcceptance',
  'convertibleAcceptance',
  'equityCompensationAcceptance',
  'warrantAcceptance',
  // Stock class adjustments
  'stockClassConversionRatioAdjustment',
  'stockClassSplit',
  'stockConsolidation',
  // Valuation and vesting
  'valuation',
  'vestingAcceleration',
  'vestingEvent',
  'vestingStart',
  // Other stock operations
  'stockRetraction',
  'stockConversion',
  'stockPlanReturnToPool',
  'stockReissuance',
  'stockRepurchase',
  // Warrant operations
  'warrantExercise',
  'warrantRetraction',
  'warrantTransfer',
  'warrantCancellation',
  // Convertible operations
  'convertibleConversion',
  'convertibleRetraction',
  'convertibleTransfer',
  'convertibleCancellation',
  // Equity compensation
  'equityCompensationRelease',
  'equityCompensationRepricing',
  'equityCompensationRetraction',
  'equityCompensationTransfer',
  'equityCompensationCancellation',
  // Transfer/cancellation
  'stockTransfer',
  'stockCancellation',
  // Stakeholder events
  'stakeholderRelationshipChangeEvent',
  'stakeholderStatusChangeEvent',
]);

/**
 * OCF manifest structure compatible with processCapTable / buildCaptableInput.
 */
export interface OcfManifest {
  issuer: Record<string, unknown> | null;
  stockClasses: Array<Record<string, unknown>>;
  stockPlans: Array<Record<string, unknown>>;
  stakeholders: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  vestingTerms: Array<Record<string, unknown>>;
  valuations: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  stockLegendTemplates: Array<Record<string, unknown>>;
}

/**
 * Options for extracting OCF data from Canton.
 */
export interface ExtractCantonOcfOptions {
  /** Log progress to console. Default: false */
  verbose?: boolean;
  /** Callback for logging (defaults to console.log when verbose) */
  logger?: (message: string) => void;
}

/**
 * Extract all OCF objects from Canton and return them in manifest format.
 *
 * This function fetches all entities from a CapTable contract and transforms
 * them into an OCF manifest structure suitable for cap table processing.
 *
 * @param client - LedgerJsonApiClient instance
 * @param cantonState - CapTableState from getCapTableState
 * @param options - Extraction options
 * @returns OCF manifest with all objects grouped by category
 *
 * @example
 * ```typescript
 * import { getCapTableState, extractCantonOcfManifest } from '@open-captable-protocol/canton';
 *
 * const cantonState = await getCapTableState(client, issuerPartyId);
 * if (cantonState) {
 *   const manifest = await extractCantonOcfManifest(client, cantonState);
 *   // manifest.stakeholders, manifest.stockClasses, manifest.transactions, etc.
 * }
 * ```
 */
export async function extractCantonOcfManifest(
  client: LedgerJsonApiClient,
  cantonState: CapTableState,
  options: ExtractCantonOcfOptions = {}
): Promise<OcfManifest> {
  const { verbose = false } = options;
  // eslint-disable-next-line no-console
  const log = options.logger ?? (verbose ? (msg: string) => console.log(msg) : () => {});

  const result: OcfManifest = {
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    stockLegendTemplates: [],
  };

  // Fetch issuer
  if (cantonState.issuerContractId) {
    try {
      const { issuer } = await getIssuerAsOcf(client, { contractId: cantonState.issuerContractId });
      result.issuer = issuer as unknown as Record<string, unknown>;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`  ⚠️ Failed to fetch issuer: ${msg}`);
    }
  }

  // Process each entity type from the cap table
  for (const [entityType, ocfIdToContractId] of cantonState.contractIds) {
    for (const [ocfId, contractId] of ocfIdToContractId) {
      try {
        // Handle core objects with their specific functions
        if (entityType === 'stakeholder') {
          const { stakeholder } = await getStakeholderAsOcf(client, { contractId });
          result.stakeholders.push(stakeholder as unknown as Record<string, unknown>);
        } else if (entityType === 'stockClass') {
          const { stockClass } = await getStockClassAsOcf(client, { contractId });
          result.stockClasses.push(stockClass as unknown as Record<string, unknown>);
        } else if (entityType === 'stockPlan') {
          const { stockPlan } = await getStockPlanAsOcf(client, { contractId });
          result.stockPlans.push(stockPlan as unknown as Record<string, unknown>);
        } else if (entityType === 'vestingTerms') {
          const { vestingTerms } = await getVestingTermsAsOcf(client, { contractId });
          result.vestingTerms.push(vestingTerms as unknown as Record<string, unknown>);
        } else if (entityType === 'stockIssuance') {
          const { stockIssuance } = await getStockIssuanceAsOcf(client, { contractId });
          result.transactions.push(stockIssuance as unknown as Record<string, unknown>);
        } else if (entityType === 'convertibleIssuance') {
          const { event } = await getConvertibleIssuanceAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'warrantIssuance') {
          const { warrantIssuance } = await getWarrantIssuanceAsOcf(client, { contractId });
          result.transactions.push(warrantIssuance as unknown as Record<string, unknown>);
        } else if (entityType === 'equityCompensationIssuance') {
          const { event } = await getEquityCompensationIssuanceAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'equityCompensationExercise') {
          const { event } = await getEquityCompensationExerciseAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'stockClassAuthorizedSharesAdjustment') {
          const { event } = await getStockClassAuthorizedSharesAdjustmentAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'issuerAuthorizedSharesAdjustment') {
          const { event } = await getIssuerAuthorizedSharesAdjustmentAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'stockPlanPoolAdjustment') {
          const { event } = await getStockPlanPoolAdjustmentAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'valuation') {
          const { valuation } = await getValuationAsOcf(client, { contractId });
          result.valuations.push(valuation as unknown as Record<string, unknown>);
        } else if (entityType === 'document') {
          const { document } = await getDocumentAsOcf(client, { contractId });
          result.documents.push(document as unknown as Record<string, unknown>);
        } else if (entityType === 'stockLegendTemplate') {
          const { stockLegendTemplate } = await getStockLegendTemplateAsOcf(client, { contractId });
          result.stockLegendTemplates.push(stockLegendTemplate as unknown as Record<string, unknown>);
        } else if (
          SUPPORTED_READ_TYPES.has(entityType as SupportedOcfReadType) &&
          TRANSACTION_ENTITY_TYPES.has(entityType)
        ) {
          // Handle remaining transaction types with the generic dispatcher
          const supportedType = entityType as SupportedOcfReadType;
          const { data } = await getEntityAsOcf(client, supportedType, contractId);
          result.transactions.push(data as unknown as Record<string, unknown>);
        }
        // Unsupported types are silently skipped
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`  ⚠️ Failed to fetch ${entityType}/${ocfId}: ${msg}`);
      }
    }
  }

  // Sort transactions by date with domain-aware same-day ordering
  // This matches the DB loader behavior (buildCaptableInput uses sortTransactions)
  // and is critical for consistent cap table processing results
  result.transactions = sortTransactions(result.transactions);

  return result;
}

/**
 * Count the total number of OCF objects in a manifest.
 */
export function countManifestObjects(manifest: OcfManifest): number {
  let count = manifest.issuer ? 1 : 0;
  count += manifest.stakeholders.length;
  count += manifest.stockClasses.length;
  count += manifest.stockPlans.length;
  count += manifest.vestingTerms.length;
  count += manifest.transactions.length;
  count += manifest.valuations.length;
  count += manifest.documents.length;
  count += manifest.stockLegendTemplates.length;
  return count;
}
