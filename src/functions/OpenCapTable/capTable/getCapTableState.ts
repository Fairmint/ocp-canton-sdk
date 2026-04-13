/**
 * Query Canton for the state of a CapTable on **this SDK’s pinned OpenCapTable package line** (`OCP_TEMPLATES.capTable`).
 *
 * Requests use the package-name symbolic template id (`#OpenCapTable-vN:…`). The ledger may echo
 * `createdEvent.templateId` using either that form or the package-id (`hash:…`) form for the same template.
 *
 * Validation therefore uses **structured fields** from the Canton JSON API: `createdEvent.packageName` must match
 * the pinned package name parsed from `OCP_TEMPLATES.capTable`, and the **module + entity** suffix of
 * `createdEvent.templateId` (everything after the first `:`) must match the pinned template. The SDK returns the
 * raw ledger `templateId` string unchanged for downstream commands.
 *
 * This is **not** a global “does this issuer have any CapTable on any package line?” API. Ledger filters use
 * the pinned template id; contracts on other OpenCapTable package versions are outside this query and are neither
 * loaded nor classified here.
 *
 * `classifyIssuerCapTables` / `getCapTableState` therefore answer only: “is there an active CapTable **on the
 * current package line** for this issuer?” A `none` / `null` result means the filtered query returned no matching row,
 * not that the issuer has zero CapTable-shaped contracts in Canton overall. Whether it is safe to create a new
 * CapTable is a separate DAML / operations concern.
 *
 * Rows that fail package-name or module-path checks throw `SCHEMA_MISMATCH`.
 *
 * @module getCapTableState
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

import { OcpContractError, OcpErrorCodes } from '../../../errors';
import {
  classifyContractReadFailure,
  contractReadFailureCode,
  createDiagnosedContractReadError,
} from '../../../utils/contractReadDiagnostics';
import { ledgerReadScope } from '../../../utils/readScope';
import { parseDamlMap } from '../../../utils/typeConversions';
import type { OcfEntityType } from './batchTypes';

/** CapTable template ID this SDK treats as current (package-name symbolic form; used for ledger queries). */
const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;

/**
 * Pinned package line + module path from {@link CURRENT_CAP_TABLE_TEMPLATE_ID} (`#PackageName:Module:Entity`).
 * Used to validate `getActiveContracts` rows without requiring `createdEvent.templateId` to match the full string.
 */
const PINNED_CAP_TABLE_PACKAGE_LINE = (() => {
  const full = CURRENT_CAP_TABLE_TEMPLATE_ID;
  if (!full.startsWith('#')) {
    throw new Error(`Invalid pinned CapTable template id (expected # prefix): ${full}`);
  }
  const withoutHash = full.slice(1);
  const firstColon = withoutHash.indexOf(':');
  if (firstColon < 0) {
    throw new Error(`Invalid pinned CapTable template id (expected :): ${full}`);
  }
  const packageName = withoutHash.slice(0, firstColon);
  const moduleEntityPath = withoutHash.slice(firstColon + 1);
  return { packageName, moduleEntityPath };
})();

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
 * CapTable presence **for the pinned package line only** (see module doc; query uses `OCP_TEMPLATES.capTable`).
 * `none` means the filtered ledger query found no row on that template, not “no CapTable exists on any package.”
 */
export type IssuerCapTableStatus = 'current' | 'none';

export interface IssuerCapTableClassification {
  status: IssuerCapTableStatus;
  /** Populated when `status` is `current` (exactly one CapTable on the pinned package line). */
  current: CapTableWithArchiveContext | null;
}

function requireObjectRecord(value: unknown, message: string, contractId: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpContractError(message, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
    });
  }
  return value as Record<string, unknown>;
}

function requireIssuerCanonicalObjectId(eventsResponse: unknown, issuerContractId: string): string {
  const response = requireObjectRecord(
    eventsResponse,
    'Issuer contract events response must be an object',
    issuerContractId
  );
  const created = requireObjectRecord(
    response.created,
    'Issuer contract events response missing created payload',
    issuerContractId
  );
  const createdEvent = requireObjectRecord(
    created.createdEvent,
    'Issuer contract events response missing created.createdEvent',
    issuerContractId
  );
  const createArgument = requireObjectRecord(
    createdEvent.createArgument,
    'Issuer contract events response missing created.createdEvent.createArgument',
    issuerContractId
  );
  const issuerData = requireObjectRecord(
    createArgument.issuer_data,
    'Issuer contract createArgument.issuer_data must be an object',
    issuerContractId
  );
  const issuerId = issuerData.id;

  if (typeof issuerId !== 'string' || issuerId.length === 0) {
    throw new OcpContractError('Issuer contract createArgument.issuer_data.id must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: issuerContractId,
    });
  }

  return issuerId;
}

async function buildCapTableStateFromCreatedEvent(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  },
  issuerPartyId?: string
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
      const eventsResponse = await client.getEventsByContractId({
        contractId: issuerContractId,
        ...ledgerReadScope({ readAs: issuerPartyId ? [issuerPartyId] : undefined }),
      });
      const issuerId = requireIssuerCanonicalObjectId(eventsResponse, issuerContractId);
      entities.set('issuer', new Set([issuerId]));
      contractIds.set('issuer', new Map([[issuerId, issuerContractId]]));
    } catch (error: unknown) {
      const classification = classifyContractReadFailure(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (classification !== 'not_found') {
        throw createDiagnosedContractReadError({
          message: `Failed to fetch issuer contract events (${classification})`,
          code: contractReadFailureCode(classification),
          contractId: issuerContractId,
          cause: error instanceof Error ? error : new Error(String(error)),
          diagnostics: {
            classification,
            operation: 'getEventsByContractId',
            entityType: 'issuer',
            contractId: issuerContractId,
            ...(issuerPartyId ? { issuerPartyId } : {}),
          },
        });
      }

      // eslint-disable-next-line no-console -- Intentional warning for operational visibility
      console.warn('[getCapTableState] Issuer contract unavailable; continuing without issuer entity', {
        issuerContractId,
        classification,
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

/** Module + entity path after the package reference (first `:`), for `#pkg:Mod:Ent` or `hash:Mod:Ent`. */
function damlTemplateModuleEntityPath(templateId: string, contractId: string): string {
  const i = templateId.indexOf(':');
  if (i < 0) {
    throw new OcpContractError('CapTable contract templateId is missing package or module path', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      templateId,
    });
  }
  const path = templateId.slice(i + 1);
  if (path.length === 0) {
    throw new OcpContractError('CapTable contract templateId is missing module path after package reference', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      templateId,
    });
  }
  return path;
}

function requireCapTablePackageNameString(
  packageName: unknown,
  contractId: string,
  templateIdForDiagnostics?: string
): string {
  if (typeof packageName !== 'string' || packageName.length === 0) {
    throw new OcpContractError('CapTable contract packageName must be a non-empty string', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
      ...(templateIdForDiagnostics ? { templateId: templateIdForDiagnostics } : {}),
    });
  }
  return packageName;
}

/**
 * Ensures the created event is the pinned CapTable template (same package line + module path as
 * `OCP_TEMPLATES.capTable`), regardless of whether `templateId` uses package-name or package-id form.
 * @returns Raw ledger `templateId` for downstream use.
 */
function requirePinnedCapTableCreatedEvent(createdEvent: {
  contractId: string;
  templateId?: unknown;
  packageName?: unknown;
}): string {
  const templateId = requireCapTableTemplateIdString(createdEvent.templateId, createdEvent.contractId);
  const packageName = requireCapTablePackageNameString(createdEvent.packageName, createdEvent.contractId, templateId);

  if (packageName !== PINNED_CAP_TABLE_PACKAGE_LINE.packageName) {
    throw new OcpContractError('CapTable contract packageName does not match pinned OpenCapTable package line', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: createdEvent.contractId,
      templateId,
    });
  }

  const moduleEntityPath = damlTemplateModuleEntityPath(templateId, createdEvent.contractId);
  if (moduleEntityPath !== PINNED_CAP_TABLE_PACKAGE_LINE.moduleEntityPath) {
    throw new OcpContractError('CapTable contract template module path does not match pinned CapTable template', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: createdEvent.contractId,
      templateId,
    });
  }

  return templateId;
}

async function capTableWithArchiveContext(
  client: LedgerJsonApiClient,
  createdEvent: {
    contractId: string;
    createArgument: Record<string, unknown>;
    templateId?: unknown;
  },
  templateId: string,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext> {
  const base = await buildCapTableStateFromCreatedEvent(client, createdEvent, issuerPartyId);
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

/** Active CapTable contracts for the issuer on the current pinned package line only. */
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
    const templateId = requirePinnedCapTableCreatedEvent(createdEvent);
    out.push(await capTableWithArchiveContext(client, createdEvent, templateId, issuerPartyId));
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
 * Classifies whether the issuer has an active CapTable **on the pinned package line** (see module doc).
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
 * Reads CapTable state **on the pinned package line only**, or `null` if the filtered query finds no such contract.
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
