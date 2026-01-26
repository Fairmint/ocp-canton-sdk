/**
 * Query Canton for the current state of a CapTable contract.
 *
 * Provides a snapshot of all OCF entities currently on-chain for an issuer,
 * enabling stateless replication by comparing against database state.
 *
 * @module getCapTableState
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

import type { OcfEntityType } from './batchTypes';

/**
 * Mapping from CapTable contract field names (snake_case) to OcfEntityType (camelCase).
 *
 * Each field in the CapTable DAML contract is a Map from OCF ID (Text) to ContractId.
 * This mapping allows extraction of entity inventories from the contract payload.
 */
export const FIELD_TO_ENTITY_TYPE: Record<string, OcfEntityType> = {
  // Core Objects (7 types)
  stakeholders: 'stakeholder',
  stock_classes: 'stockClass',
  stock_plans: 'stockPlan',
  vesting_terms: 'vestingTerms',
  stock_legend_templates: 'stockLegendTemplate',
  documents: 'document',
  valuations: 'valuation',

  // Stock Class Adjustments (4 types)
  stock_class_authorized_shares_adjustments: 'stockClassAuthorizedSharesAdjustment',
  stock_class_conversion_ratio_adjustments: 'stockClassConversionRatioAdjustment',
  stock_class_splits: 'stockClassSplit',
  issuer_authorized_shares_adjustments: 'issuerAuthorizedSharesAdjustment',

  // Stock Transactions (9 types)
  stock_issuances: 'stockIssuance',
  stock_cancellations: 'stockCancellation',
  stock_transfers: 'stockTransfer',
  stock_acceptances: 'stockAcceptance',
  stock_conversions: 'stockConversion',
  stock_repurchases: 'stockRepurchase',
  stock_reissuances: 'stockReissuance',
  stock_retractions: 'stockRetraction',
  stock_consolidations: 'stockConsolidation',

  // Equity Compensation (8 types)
  equity_compensation_issuances: 'equityCompensationIssuance',
  equity_compensation_cancellations: 'equityCompensationCancellation',
  equity_compensation_transfers: 'equityCompensationTransfer',
  equity_compensation_acceptances: 'equityCompensationAcceptance',
  equity_compensation_exercises: 'equityCompensationExercise',
  equity_compensation_releases: 'equityCompensationRelease',
  equity_compensation_repricings: 'equityCompensationRepricing',
  equity_compensation_retractions: 'equityCompensationRetraction',

  // Convertibles (6 types)
  convertible_issuances: 'convertibleIssuance',
  convertible_cancellations: 'convertibleCancellation',
  convertible_transfers: 'convertibleTransfer',
  convertible_acceptances: 'convertibleAcceptance',
  convertible_conversions: 'convertibleConversion',
  convertible_retractions: 'convertibleRetraction',

  // Warrants (6 types)
  warrant_issuances: 'warrantIssuance',
  warrant_cancellations: 'warrantCancellation',
  warrant_transfers: 'warrantTransfer',
  warrant_acceptances: 'warrantAcceptance',
  warrant_exercises: 'warrantExercise',
  warrant_retractions: 'warrantRetraction',

  // Stock Plan Events (2 types)
  stock_plan_pool_adjustments: 'stockPlanPoolAdjustment',
  stock_plan_return_to_pools: 'stockPlanReturnToPool',

  // Vesting Events (3 types)
  vesting_accelerations: 'vestingAcceleration',
  vesting_events: 'vestingEvent',
  vesting_starts: 'vestingStart',

  // Stakeholder Events (2 types)
  stakeholder_relationship_change_events: 'stakeholderRelationshipChangeEvent',
  stakeholder_status_change_events: 'stakeholderStatusChangeEvent',
};

/**
 * Current state of a CapTable on Canton, with all OCF IDs grouped by entity type.
 */
export interface CapTableState {
  /** Contract ID of the CapTable contract. */
  capTableContractId: string;

  /** Contract ID of the Issuer contract (referenced by the CapTable). */
  issuerContractId: string;

  /**
   * Map of entity type to OCF IDs currently on-chain.
   * Each entry contains all OCF object IDs of that type in the CapTable.
   */
  entities: Map<OcfEntityType, Set<string>>;

  /**
   * Map of entity type to (OCF ID → Contract ID) for fetching individual contracts.
   * Useful for deep verification where contract data needs to be compared.
   */
  contractIds: Map<OcfEntityType, Map<string, string>>;
}

/**
 * Query Canton for the current state of a CapTable.
 *
 * Uses getActiveContracts filtered by party to efficiently retrieve only
 * the CapTable contract for the specified issuer.
 *
 * @param client - LedgerJsonApiClient instance
 * @param issuerPartyId - Party ID of the issuer
 * @returns CapTableState with all OCF IDs on-chain, or null if no CapTable exists
 *
 * @example
 * ```typescript
 * const state = await getCapTableState(client, 'issuer::party123');
 * if (state) {
 *   const stakeholderIds = state.entities.get('stakeholder') ?? new Set();
 *   console.log(`${stakeholderIds.size} stakeholders on-chain`);
 * }
 * ```
 */
export async function getCapTableState(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableState | null> {
  // Query for CapTable contract by party
  // The CapTable template ID follows the pattern: PackageId:Module:Template
  const contracts = await client.getActiveContracts({
    parties: [issuerPartyId],
    // Filter to CapTable template - will match the deployed OpenCapTable package
    templateIds: ['#open-captable:Fairmint.OpenCapTable.CapTable:CapTable'],
  });

  if (contracts.length === 0) {
    return null;
  }

  // Extract payload from the first matching contract
  const capTableContract = contracts[0];

  // Handle both old and new JSON API response formats
  interface ContractPayload {
    contractId?: string;
    contract_id?: string;
    payload?: Record<string, unknown>;
    contract?: { payload?: Record<string, unknown> };
  }

  const contractData = capTableContract as unknown as ContractPayload;
  const contractId = contractData.contractId ?? contractData.contract_id ?? '';
  const payload = contractData.payload ?? contractData.contract?.payload ?? {};

  // Build entity maps from payload fields
  const entities = new Map<OcfEntityType, Set<string>>();
  const contractIds = new Map<OcfEntityType, Map<string, string>>();

  for (const [field, entityType] of Object.entries(FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData && typeof fieldData === 'object') {
      // DAML Map is serialized as an object with OCF IDs as keys
      const ocfIdToContractId = fieldData as Record<string, string>;
      const ocfIds = new Set(Object.keys(ocfIdToContractId));

      if (ocfIds.size > 0) {
        entities.set(entityType, ocfIds);
        contractIds.set(entityType, new Map(Object.entries(ocfIdToContractId)));
      }
    }
  }

  // Extract issuer contract ID from payload
  const issuerContractId = typeof payload.issuer === 'string' ? payload.issuer : '';

  return {
    capTableContractId: contractId,
    issuerContractId,
    entities,
    contractIds,
  };
}
