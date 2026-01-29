/**
 * Extract full OCF data from Canton for verification and comparison.
 *
 * Provides utilities to fetch all OCF objects from Canton and transform them
 * into a format compatible with buildCaptableInput for processing.
 *
 * @module cantonOcfExtractor
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/batchTypes';
import type { SupportedOcfReadType } from '../functions/OpenCapTable/capTable/damlToOcf';
import { getEntityAsOcf } from '../functions/OpenCapTable/capTable/damlToOcf';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import { getConvertibleIssuanceAsOcf } from '../functions/OpenCapTable/convertibleIssuance';
import { getEquityCompensationExerciseAsOcf } from '../functions/OpenCapTable/equityCompensationExercise';
import { getEquityCompensationIssuanceAsOcf } from '../functions/OpenCapTable/equityCompensationIssuance';
import { getIssuerAsOcf } from '../functions/OpenCapTable/issuer';
import { getIssuerAuthorizedSharesAdjustmentAsOcf } from '../functions/OpenCapTable/issuerAuthorizedSharesAdjustment';
import { getStakeholderAsOcf } from '../functions/OpenCapTable/stakeholder';
import { getStockClassAsOcf } from '../functions/OpenCapTable/stockClass';
import { getStockClassAuthorizedSharesAdjustmentAsOcf } from '../functions/OpenCapTable/stockClassAuthorizedSharesAdjustment';
import { getStockIssuanceAsOcf } from '../functions/OpenCapTable/stockIssuance';
import { getStockPlanAsOcf } from '../functions/OpenCapTable/stockPlan';
import { getStockPlanPoolAdjustmentAsOcf } from '../functions/OpenCapTable/stockPlanPoolAdjustment';
import { getVestingTermsAsOcf } from '../functions/OpenCapTable/vestingTerms';
import { getWarrantIssuanceAsOcf } from '../functions/OpenCapTable/warrantIssuance';

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
  // Plan Security Transactions (aliases)
  'planSecurityIssuance',
  'planSecurityTransfer',
  'planSecurityCancellation',
  'planSecurityRetraction',
  'planSecurityAcceptance',
  'planSecurityRelease',
  'planSecurityExercise',
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
  // PlanSecurity aliases
  'planSecurityAcceptance',
  'planSecurityCancellation',
  'planSecurityRelease',
  'planSecurityRetraction',
  'planSecurityTransfer',
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
 * them into a format compatible with buildCaptableInput / processCapTable.
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
          const { event } = await getWarrantIssuanceAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'equityCompensationIssuance' || entityType === 'planSecurityIssuance') {
          const { event } = await getEquityCompensationIssuanceAsOcf(client, { contractId });
          result.transactions.push(event as unknown as Record<string, unknown>);
        } else if (entityType === 'equityCompensationExercise' || entityType === 'planSecurityExercise') {
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
        } else if (SUPPORTED_READ_TYPES.has(entityType as SupportedOcfReadType)) {
          // Handle transaction types with the generic dispatcher
          const supportedType = entityType as SupportedOcfReadType;
          const { data } = await getEntityAsOcf(client, supportedType, contractId);
          if (TRANSACTION_ENTITY_TYPES.has(entityType)) {
            result.transactions.push(data as unknown as Record<string, unknown>);
          }
          // Other supported types (valuation, etc.) not needed for processCapTable
        }
        // Unsupported types are silently skipped
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`  ⚠️ Failed to fetch ${entityType}/${ocfId}: ${msg}`);
      }
    }
  }

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
  return count;
}
