/**
 * Query Canton for the state of a CapTable on **this SDK’s pinned template** (`OCP_TEMPLATES.capTable`).
 *
 * This is **not** a global “does this issuer have any CapTable on any package line?” API. Ledger filters use
 * that template id; contracts on other OpenCapTable package versions are outside this query and are neither
 * loaded nor classified here.
 *
 * `classifyIssuerCapTables` / `getCapTableState` therefore answer only: “is there an active CapTable **on the
 * current template** for this issuer?” A `none` / `null` result means the filtered query returned no matching row,
 * not that the issuer has zero CapTable-shaped contracts in Canton overall. Whether it is safe to create a new
 * CapTable is a separate DAML / operations concern.
 *
 * Any row returned for the filtered query must carry a non-empty `createdEvent.templateId` that **exactly**
 * matches `OCP_TEMPLATES.capTable`; otherwise the SDK throws `SCHEMA_MISMATCH` (including when the participant
 * returns an unexpected template id for the same filter).
 *
 * @module getCapTableState
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { parseDamlMap } from '../../../utils/typeConversions';
import type { OcfEntityType } from './batchTypes';

/** CapTable template ID this SDK treats as current. */
const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;

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
      createdEvent: {
        contractId: string;
        createArgument: Record<string, unknown>;
        templateId?: string;
        packageName?: string;
      };
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
 * Each field in the CapTable DAML contract is a Map from canonical object ID (Text) to ContractId.
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
 * Mapping from CapTable `*_by_security_id` fields to OcfEntityType.
 *
 * These maps track security_id uniqueness for issuance types. The keys are
 * security_id values (not canonical object IDs), and the values are ContractIds.
 *
 * Used by the replication diff to detect duplicate security_id conflicts
 * before submitting to DAML (which would fail with "security_id already exists").
 */
export const SECURITY_ID_FIELD_TO_ENTITY_TYPE: Record<string, OcfEntityType> = {
  stock_issuances_by_security_id: 'stockIssuance',
  convertible_issuances_by_security_id: 'convertibleIssuance',
  equity_compensation_issuances_by_security_id: 'equityCompensationIssuance',
  warrant_issuances_by_security_id: 'warrantIssuance',
};

/**
 * Current state of a CapTable on Canton, with all canonical object IDs grouped by entity type.
 */
export interface CapTableState {
  /** Contract ID of the CapTable contract. */
  capTableContractId: string;

  /** Contract ID of the Issuer contract (referenced by the CapTable). */
  issuerContractId: string;

  /**
   * Map of entity type to canonical object IDs currently on-chain.
   * Each entry contains all object IDs of that type in the CapTable.
   */
  entities: Map<OcfEntityType, Set<string>>;

  /**
   * Map of entity type to (canonical object ID → Contract ID) for fetching individual contracts.
   * Useful for deep verification where contract data needs to be compared.
   */
  contractIds: Map<OcfEntityType, Map<string, string>>;

  /**
   * Map of issuance entity type to security_ids currently on-chain.
   *
   * Only populated for issuance types that enforce security_id uniqueness:
   * stockIssuance, convertibleIssuance, equityCompensationIssuance, warrantIssuance.
   *
   * Used by computeReplicationDiff to detect duplicate security_id conflicts before
   * submitting batch commands (avoiding DAML "security_id already exists" errors).
   */
  securityIds: Map<OcfEntityType, Set<string>>;
}

/** CapTable state plus fields needed for ArchiveCapTable / batch commands. */
export interface CapTableWithArchiveContext extends CapTableState {
  templateId: string;
  systemOperatorPartyId: string;
}

/**
 * CapTable presence **for the pinned template only** (`OCP_TEMPLATES.capTable`).
 * `none` means the filtered ledger query found no row on that template, not “no CapTable exists on any package.”
 */
export type IssuerCapTableStatus = 'current' | 'none';

export interface IssuerCapTableClassification {
  status: IssuerCapTableStatus;
  /** Populated when `status` is `current` (exactly one CapTable on the pinned template). */
  current: CapTableWithArchiveContext | null;
}

async function buildCapTableStateFromCreatedEvent(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  }
): Promise<CapTableState> {
  const { contractId, createArgument: payload } = createdEvent;

  // Build entity maps from payload fields
  const entities = new Map<OcfEntityType, Set<string>>();
  const contractIds = new Map<OcfEntityType, Map<string, string>>();

  for (const [field, entityType] of Object.entries(FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData) {
      // DAML Map is serialized as array of tuples: [[key, value], [key, value], ...]
      const entries = parseDamlMap<string, string>(fieldData);

      if (entries.length > 0) {
        const objectIds = new Set(entries.map(([key]) => key));
        entities.set(entityType, objectIds);
        contractIds.set(entityType, new Map(entries));
      }
    }
  }

  // Build security_id maps from *_by_security_id payload fields
  // These track security_id uniqueness for issuance types
  const securityIds = new Map<OcfEntityType, Set<string>>();

  for (const [field, entityType] of Object.entries(SECURITY_ID_FIELD_TO_ENTITY_TYPE)) {
    const fieldData = payload[field];

    if (fieldData) {
      const entries = parseDamlMap<string, string>(fieldData);

      if (entries.length > 0) {
        securityIds.set(entityType, new Set(entries.map(([key]) => key)));
      }
    }
  }

  // Extract issuer contract ID from payload
  const issuerContractId = typeof payload.issuer === 'string' ? payload.issuer : '';

  // Fetch issuer contract to get the canonical object ID
  // (issuer is stored as a single contract reference, not a map like other entities)
  if (issuerContractId) {
    try {
      const eventsResponse = await client.getEventsByContractId({ contractId: issuerContractId });
      // Use optional chaining for defensive runtime validation of API response structure
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime defensive access
      const createArgument = eventsResponse.created?.createdEvent?.createArgument as
        | Record<string, unknown>
        | undefined;
      const issuerData = createArgument?.issuer_data as Record<string, unknown> | undefined;
      const issuerId = issuerData?.id;

      // Only add issuer if we got a valid non-empty canonical object ID
      if (typeof issuerId === 'string' && issuerId.length > 0) {
        entities.set('issuer', new Set([issuerId]));
        contractIds.set('issuer', new Map([[issuerId, issuerContractId]]));
      }
    } catch (error: unknown) {
      // Differentiate between expected and unexpected failures for better debugging
      // - Contract archived/not found: graceful degradation (expected in some workflows)
      // - Network/permission errors: transient, may retry
      // - Schema mismatch: indicates a bug, should be investigated
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNotFoundError =
        errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('archived');

      const issuerWarnTitle = isNotFoundError
        ? 'Issuer contract not found (may be archived)'
        : 'Failed to fetch issuer contract events';
      // eslint-disable-next-line no-console -- Intentional warning for operational visibility
      console.warn(`[getCapTableState] ${issuerWarnTitle}`, {
        issuerContractId,
        errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Continue without adding issuer to entities - issuerContractId is still available
    }
  }

  return {
    capTableContractId: contractId,
    issuerContractId,
    entities,
    contractIds,
    securityIds,
  };
}

function requireCapTableTemplateIdString(templateId: unknown, contractId: string): string {
  if (typeof templateId !== 'string' || templateId.length === 0) {
    throw new OcpContractError('CapTable contract templateId must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
    });
  }
  return templateId;
}

function requireCurrentCapTableTemplateId(templateId: unknown, contractId: string): string {
  const currentTemplateId = requireCapTableTemplateIdString(templateId, contractId);
  if (currentTemplateId !== CURRENT_CAP_TABLE_TEMPLATE_ID) {
    throw new OcpContractError('CapTable contract templateId did not match requested template scope', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      templateId: currentTemplateId,
    });
  }
  return currentTemplateId;
}

async function capTableWithArchiveContext(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  },
  templateId: string
): Promise<CapTableWithArchiveContext> {
  const base = await buildCapTableStateFromCreatedEvent(client, createdEvent);
  const ctx = createdEvent.createArgument.context as Record<string, unknown> | undefined;
  const systemOperatorPartyId = typeof ctx?.system_operator === 'string' ? ctx.system_operator : '';
  if (!systemOperatorPartyId) {
    throw new OcpContractError('CapTable contract missing context.system_operator', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: base.capTableContractId,
      templateId,
    });
  }
  return { ...base, templateId, systemOperatorPartyId };
}

/** Active CapTable contracts for the issuer on the current template only. */
async function loadCurrentCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext[]> {
  const contracts = await client.getActiveContracts({
    parties: [issuerPartyId],
    templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
  });
  const out: CapTableWithArchiveContext[] = [];
  for (const contract of contracts) {
    if (!isJsActiveContractItem(contract)) {
      throw new OcpContractError('Invalid CapTable contract response: expected JsActiveContract entry', {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'unknown',
      });
    }
    const { createdEvent } = contract.contractEntry.JsActiveContract;
    const templateId = requireCurrentCapTableTemplateId(createdEvent.templateId, createdEvent.contractId);
    out.push(await capTableWithArchiveContext(client, createdEvent, templateId));
  }
  if (out.length > 1) {
    throw new OcpContractError('Multiple active CapTable contracts for issuer', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: out.map((m) => m.capTableContractId).join(','),
    });
  }
  return out;
}

/**
 * Classifies whether the issuer has an active CapTable **on the pinned template** (see module doc).
 * Other package lines are out of scope and do not affect `status`.
 */
export async function classifyIssuerCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<IssuerCapTableClassification> {
  const currentRows = await loadCurrentCapTables(client, issuerPartyId);
  if (currentRows.length === 0) {
    return { status: 'none', current: null };
  }
  return { status: 'current', current: currentRows[0] };
}

/**
 * Reads CapTable state **on the pinned template only**, or `null` if the filtered query finds no such contract.
 * This does not imply the issuer has no CapTable on other templates.
 */
export async function getCapTableState(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableState | null> {
  const c = await classifyIssuerCapTables(client, issuerPartyId);
  if (c.status !== 'current' || !c.current) {
    return null;
  }
  const { templateId: _tid, systemOperatorPartyId: _op, ...state } = c.current;
  return state;
}
