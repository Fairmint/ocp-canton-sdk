/**
 * Query Canton for the current state of a CapTable contract.
 *
 * Provides a snapshot of all OCF entities currently on-chain for an issuer,
 * enabling stateless replication by comparing against a source of truth.
 *
 * @module getCapTableState
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

import { parseDamlMap } from '../../../utils/typeConversions';
import type { OcfEntityType } from './batchTypes';

/**
 * Type guard to check if a contract entry is a JsActiveContract with complete structure.
 * Based on the pattern from canton-node-sdk's get-amulets-for-transfer.ts.
 *
 * Validates that:
 * - contractEntry exists and is an object
 * - JsActiveContract property exists
 * - createdEvent exists with contractId (string) and createArgument (object)
 *
 * Note: We cast to unknown first to perform defensive runtime validation,
 * as API responses may not match expected types at runtime.
 */
function isJsActiveContractItem(item: JsGetActiveContractsResponseItem): item is JsGetActiveContractsResponseItem & {
  contractEntry: {
    JsActiveContract: {
      createdEvent: { contractId: string; createArgument: Record<string, unknown> };
    };
  };
} {
  // Cast to unknown for defensive runtime validation of API responses
  const { contractEntry } = item as unknown as { contractEntry?: unknown };

  // Check contractEntry exists and is an object
  if (!contractEntry || typeof contractEntry !== 'object') {
    return false;
  }

  // Check JsActiveContract exists in the union type
  if (!('JsActiveContract' in contractEntry)) {
    return false;
  }

  // Narrow to check nested structure safely
  const jsActiveContract = (contractEntry as { JsActiveContract?: unknown }).JsActiveContract;
  if (!jsActiveContract || typeof jsActiveContract !== 'object') {
    return false;
  }

  const { createdEvent } = jsActiveContract as { createdEvent?: unknown };
  if (!createdEvent || typeof createdEvent !== 'object') {
    return false;
  }

  const { contractId, createArgument } = createdEvent as {
    contractId?: unknown;
    createArgument?: unknown;
  };

  // Validate contractId is a string
  if (typeof contractId !== 'string') {
    return false;
  }

  // Validate createArgument exists and is an object
  if (!createArgument || typeof createArgument !== 'object') {
    return false;
  }

  return true;
}

/**
 * Mapping from CapTable contract field names (snake_case) to OcfEntityType (camelCase).
 *
 * Each field in the CapTable DAML contract is a Map from OCF ID (Text) to ContractId.
 * This mapping allows extraction of entity inventories from the contract payload.
 *
 * Note: planSecurity* types (7 total) are intentionally omitted from this mapping.
 * They are aliases for equityCompensation* types and are stored under equity_compensation_*
 * fields in Canton. The SDK normalizes planSecurity → equityCompensation during upload.
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
 * Note: In the standard deployment model, each issuer party has exactly one
 * active CapTable contract. If multiple CapTable contracts exist for the same
 * party (which would indicate a configuration issue), this function returns
 * the first one found. The system design ensures this is a 1:1 relationship.
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
  // Use the DAML-JS package's templateId for compatibility with deployed packages.
  const contracts = await client.getActiveContracts({
    parties: [issuerPartyId],
    templateIds: [Fairmint.OpenCapTable.CapTable.CapTable.templateId],
  });

  if (contracts.length === 0) {
    return null;
  }

  // Extract payload from the first matching contract
  const capTableContract = contracts[0];

  // Extract contract ID and payload using the SDK's response format
  let contractId: string;
  let payload: Record<string, unknown>;

  if (isJsActiveContractItem(capTableContract)) {
    // JSON API v2 format (preferred)
    const { createdEvent } = capTableContract.contractEntry.JsActiveContract;
    ({ contractId, createArgument: payload } = createdEvent);
  } else {
    // Legacy format fallback for backward compatibility
    const legacyData = capTableContract as unknown as {
      contractId?: string;
      contract_id?: string;
      payload?: Record<string, unknown>;
      contract?: { payload?: Record<string, unknown> };
    };
    contractId = legacyData.contractId ?? legacyData.contract_id ?? '';
    payload = legacyData.payload ?? legacyData.contract?.payload ?? {};
  }

  // Build entity maps from payload fields
  const entities = new Map<OcfEntityType, Set<string>>();
  const contractIds = new Map<OcfEntityType, Map<string, string>>();

  for (const [field, entityType] of Object.entries(FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData) {
      // DAML Map can be serialized as either:
      // - Array format (JSON API v2): [[key, value], [key, value], ...]
      // - Object format: {key: value, ...}
      // parseDamlMap handles both formats
      const entries = parseDamlMap<string, string>(fieldData);

      if (entries.length > 0) {
        const ocfIds = new Set(entries.map(([key]) => key));
        entities.set(entityType, ocfIds);
        contractIds.set(entityType, new Map(entries));
      }
    }
  }

  // Extract issuer contract ID from payload
  const issuerContractId = typeof payload.issuer === 'string' ? payload.issuer : '';

  // Fetch issuer contract to get OCF ID
  // (issuer is stored as a single contract reference, not a map like other entities)
  if (issuerContractId) {
    try {
      const eventsResponse = await client.getEventsByContractId({ contractId: issuerContractId });
      const createArgument = eventsResponse.created?.createdEvent.createArgument as Record<string, unknown> | undefined;
      const issuerData = createArgument?.issuer_data as Record<string, unknown> | undefined;
      const issuerOcfId = issuerData?.id;

      if (typeof issuerOcfId === 'string') {
        entities.set('issuer', new Set([issuerOcfId]));
        contractIds.set('issuer', new Map([[issuerOcfId, issuerContractId]]));
      }
    } catch (error) {
      // Issuer fetch failed - continue without adding to entities
      // The issuerContractId is still available for direct access
      // eslint-disable-next-line no-console -- Intentional warning for operational visibility
      console.warn('[getCapTableState] Failed to fetch issuer contract events', { issuerContractId }, error);
    }
  }

  return {
    capTableContractId: contractId,
    issuerContractId,
    entities,
    contractIds,
  };
}
