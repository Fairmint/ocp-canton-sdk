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
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import {
  classifyContractReadFailure,
  contractReadFailureCode,
  createDiagnosedContractReadError,
} from '../../../utils/contractReadDiagnostics';
import {
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { ledgerReadScope } from '../../../utils/readScope';
import { parseDamlMap } from '../../../utils/typeConversions';
import { FIELD_TO_ENTITY_TYPE, SECURITY_ID_FIELD_TO_ENTITY_TYPE } from './batchTypes';
import type { OcfEntityType } from './entityTypes';

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

const CAP_TABLE_MAP_ENTRY_SCHEMA = {
  key: {
    expectedType: 'non-empty string identifier',
    is: (value: unknown): value is string => typeof value === 'string' && value.length > 0,
  },
  value: {
    expectedType: 'non-empty string contract ID',
    is: (value: unknown): value is string => typeof value === 'string' && value.length > 0,
  },
};

const CAP_TABLE_MAP_FIELDS = [
  ...Object.keys(FIELD_TO_ENTITY_TYPE),
  ...Object.keys(SECURITY_ID_FIELD_TO_ENTITY_TYPE),
] as const;

const CAP_TABLE_CREATE_ARGUMENT_FIELDS = ['context', 'issuer', ...CAP_TABLE_MAP_FIELDS] as const;

const ACTIVE_CONTRACT_ITEM_FIELDS = ['workflowId', 'contractEntry'] as const;
const ACTIVE_CONTRACT_ENTRY_FIELDS = ['JsActiveContract'] as const;
const ACTIVE_CONTRACT_FIELDS = ['createdEvent', 'synchronizerId', 'reassignmentCounter'] as const;
const CREATED_EVENT_FIELDS = [
  'offset',
  'nodeId',
  'contractId',
  'templateId',
  'contractKey',
  'createArgument',
  'createdEventBlob',
  'interfaceViews',
  'witnessParties',
  'signatories',
  'observers',
  'createdAt',
  'packageName',
  'implementedInterfaces',
] as const;

function parseRequiredContractIdMap(payload: Record<string, unknown>, field: string): Array<[string, string]> {
  const source = `CapTable.createArgument.${field}`;
  const hasField = Object.prototype.hasOwnProperty.call(payload, field);
  const fieldData = hasField ? payload[field] : undefined;

  if (!hasField || fieldData === undefined || fieldData === null) {
    const receivedType = !hasField ? 'missing' : fieldData === null ? 'null' : 'undefined';
    throw new OcpParseError(`CapTable createArgument requires map field '${field}'; received ${receivedType}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        field,
        expectedType: 'array of [identifier, contract ID] tuples',
        receivedType,
      },
    });
  }

  return parseDamlMap(fieldData, {
    ...CAP_TABLE_MAP_ENTRY_SCHEMA,
    source,
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function ownField(record: Record<string, unknown>, field: string): unknown {
  return hasOwnField(record, field) ? record[field] : undefined;
}

function invalidCapTableCreateArgument(source: string, message: string, context?: Record<string, unknown>): never {
  throw new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_cap_table_create_argument',
    ...(context !== undefined ? { context } : {}),
  });
}

function requireNonEmptyGeneratedString(value: unknown, source: string, description: string): string {
  const parsed = requireGeneratedString(value, source);
  if (parsed.length === 0) {
    return invalidCapTableCreateArgument(source, `${description} must be a non-empty string`, {
      expectedType: 'non-empty string',
      receivedValue: parsed,
    });
  }
  return parsed;
}

interface ValidatedCapTableCreateArgument {
  readonly issuerContractId: string;
  readonly systemOperatorPartyId: string;
  readonly entriesByField: ReadonlyMap<string, Array<[string, string]>>;
}

/**
 * Validate the complete generated CapTable value without sacrificing the
 * field/index-specific diagnostics produced by the SDK's strict DAML-map parser.
 */
function validateCapTableCreateArgument(
  payload: Record<string, unknown>,
  issuerPartyId: string,
  contractId: string
): ValidatedCapTableCreateArgument {
  const source = 'CapTable.createArgument';
  assertSafeGeneratedDamlJson(payload, source);
  rejectUnknownGeneratedFields(payload, source, CAP_TABLE_CREATE_ARGUMENT_FIELDS);

  const contextSource = `${source}.context`;
  const context = requireGeneratedRecord(ownField(payload, 'context'), contextSource);
  rejectUnknownGeneratedFields(context, contextSource, ['issuer', 'system_operator']);

  const contextIssuerPartyId = requireNonEmptyGeneratedString(
    ownField(context, 'issuer'),
    `${contextSource}.issuer`,
    'CapTable context issuer'
  );
  if (contextIssuerPartyId !== issuerPartyId) {
    return invalidCapTableCreateArgument(
      `${contextSource}.issuer`,
      'CapTable context issuer does not match the requested issuer party',
      {
        contractId,
        expectedIssuerPartyId: issuerPartyId,
        receivedIssuerPartyId: contextIssuerPartyId,
      }
    );
  }

  requireNonEmptyGeneratedString(
    ownField(context, 'system_operator'),
    `${contextSource}.system_operator`,
    'CapTable context system operator'
  );
  requireNonEmptyGeneratedString(ownField(payload, 'issuer'), `${source}.issuer`, 'CapTable issuer contract ID');

  // Keep the SDK's precise tuple/index diagnostics ahead of the generated
  // decoder, whose map errors are necessarily less specific.
  const entriesByField = new Map<string, Array<[string, string]>>();
  for (const field of CAP_TABLE_MAP_FIELDS) {
    entriesByField.set(field, parseRequiredContractIdMap(payload, field));
  }

  const decoded = decodeGeneratedDaml(
    payload,
    {
      decode: (value) => Fairmint.OpenCapTable.CapTable.CapTable.decoder.runWithException(value),
      encode: (value) => Fairmint.OpenCapTable.CapTable.CapTable.encode(value),
    },
    source,
    { context: { contractId, issuerPartyId } }
  );

  return {
    issuerContractId: decoded.issuer,
    systemOperatorPartyId: decoded.context.system_operator,
    entriesByField,
  };
}

/**
 * Type guard to check if a contract entry is a JsActiveContract with complete structure.
 * Based on the pattern from canton-node-sdk's get-amulets-for-transfer.ts.
 *
 * Validates that:
 * - contractEntry exists and is an object
 * - JsActiveContract property exists
 * - createdEvent exists with contractId (string) and createArgument (object)
 *
 * The checks operate on unknown data because API responses may not match their
 * generated TypeScript declarations at runtime.
 */
function isJsActiveContractItem(item: unknown): item is JsGetActiveContractsResponseItem & {
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
  const rawItem: unknown = item;
  if (!isObjectRecord(rawItem)) {
    return false;
  }
  const contractEntry = ownField(rawItem, 'contractEntry');

  // Check contractEntry exists and is an object
  if (!isObjectRecord(contractEntry)) {
    return false;
  }

  // Narrow to check nested structure safely
  const jsActiveContract = ownField(contractEntry, 'JsActiveContract');
  if (!isObjectRecord(jsActiveContract)) {
    return false;
  }

  const createdEvent = ownField(jsActiveContract, 'createdEvent');
  if (!isObjectRecord(createdEvent)) {
    return false;
  }

  if (!hasOwnField(createdEvent, 'contractId') || !hasOwnField(createdEvent, 'createArgument')) {
    return false;
  }
  const { contractId, createArgument } = createdEvent;

  // Validate contractId is a string
  if (typeof contractId !== 'string') {
    return false;
  }

  // Validate createArgument exists and is an object
  if (!isObjectRecord(createArgument)) {
    return false;
  }

  return true;
}

function requireStrictActiveContractItem(
  item: unknown,
  source: string
): JsGetActiveContractsResponseItem & {
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
  if (!isJsActiveContractItem(item)) {
    throw new OcpContractError('Invalid CapTable contract response: expected JsActiveContract entry', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }

  const response = item as unknown as Record<string, unknown>;
  rejectUnknownGeneratedFields(response, source, ACTIVE_CONTRACT_ITEM_FIELDS);
  const contractEntry = requireGeneratedRecord(response.contractEntry, `${source}.contractEntry`);
  rejectUnknownGeneratedFields(contractEntry, `${source}.contractEntry`, ACTIVE_CONTRACT_ENTRY_FIELDS);
  const activeContract = requireGeneratedRecord(
    contractEntry.JsActiveContract,
    `${source}.contractEntry.JsActiveContract`
  );
  rejectUnknownGeneratedFields(activeContract, `${source}.contractEntry.JsActiveContract`, ACTIVE_CONTRACT_FIELDS);
  const createdEvent = requireGeneratedRecord(
    activeContract.createdEvent,
    `${source}.contractEntry.JsActiveContract.createdEvent`
  );
  rejectUnknownGeneratedFields(
    createdEvent,
    `${source}.contractEntry.JsActiveContract.createdEvent`,
    CREATED_EVENT_FIELDS
  );
  return item;
}

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
  if (!isObjectRecord(value)) {
    throw new OcpContractError(message, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId,
    });
  }
  return value;
}

function requireIssuerCanonicalObjectId(eventsResponse: unknown, issuerContractId: string): string {
  assertSafeGeneratedDamlJson(eventsResponse, 'Issuer.eventsResponse');
  const response = requireObjectRecord(
    eventsResponse,
    'Issuer contract events response must be an object',
    issuerContractId
  );
  const created = requireObjectRecord(
    ownField(response, 'created'),
    'Issuer contract events response missing created payload',
    issuerContractId
  );
  const createdEvent = requireObjectRecord(
    ownField(created, 'createdEvent'),
    'Issuer contract events response missing created.createdEvent',
    issuerContractId
  );
  const createArgument = requireObjectRecord(
    ownField(createdEvent, 'createArgument'),
    'Issuer contract events response missing created.createdEvent.createArgument',
    issuerContractId
  );
  const issuerData = requireObjectRecord(
    ownField(createArgument, 'issuer_data'),
    'Issuer contract createArgument.issuer_data must be an object',
    issuerContractId
  );
  const issuerId = ownField(issuerData, 'id');

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
  issuerPartyId: string
): Promise<{ readonly state: CapTableState; readonly systemOperatorPartyId: string }> {
  const { contractId, createArgument: payload } = createdEvent;
  const validated = validateCapTableCreateArgument(payload, issuerPartyId, contractId);

  // Build entity maps from payload fields
  const entities = new Map<OcfEntityType, Set<string>>();
  const contractIds = new Map<OcfEntityType, Map<string, string>>();

  for (const [field, entityType] of Object.entries(FIELD_TO_ENTITY_TYPE)) {
    const entries = validated.entriesByField.get(field) ?? [];

    // DAML Map is serialized as array of tuples: [[key, value], [key, value], ...]
    if (entries.length > 0) {
      const objectIds = new Set(entries.map(([key]) => key));
      entities.set(entityType, objectIds);
      contractIds.set(entityType, new Map(entries));
    }
  }

  // Build security_id maps from *_by_security_id payload fields
  // These track security_id uniqueness for issuance types
  const securityIds = new Map<OcfEntityType, Set<string>>();

  for (const [field, entityType] of Object.entries(SECURITY_ID_FIELD_TO_ENTITY_TYPE)) {
    const entries = validated.entriesByField.get(field) ?? [];

    if (entries.length > 0) {
      securityIds.set(entityType, new Set(entries.map(([key]) => key)));
    }
  }

  // Extract issuer contract ID from payload
  const { issuerContractId } = validated;

  // Fetch issuer contract to get the canonical object ID
  // (issuer is stored as a single contract reference, not a map like other entities)
  if (issuerContractId) {
    try {
      const eventsResponse = await client.getEventsByContractId({
        contractId: issuerContractId,
        ...ledgerReadScope({ readAs: [issuerPartyId] }),
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
            issuerPartyId,
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
    state: {
      capTableContractId: contractId,
      issuerContractId,
      entities,
      contractIds,
      securityIds,
    },
    systemOperatorPartyId: validated.systemOperatorPartyId,
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
  const templateId = requireCapTableTemplateIdString(
    hasOwnField(createdEvent, 'templateId') ? createdEvent.templateId : undefined,
    createdEvent.contractId
  );
  const packageName = requireCapTablePackageNameString(
    hasOwnField(createdEvent, 'packageName') ? createdEvent.packageName : undefined,
    createdEvent.contractId,
    templateId
  );

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
  const { state, systemOperatorPartyId } = await buildCapTableStateFromCreatedEvent(
    client,
    createdEvent,
    issuerPartyId
  );
  return { ...state, templateId, systemOperatorPartyId };
}

/** Active CapTable contracts for the issuer on the current pinned package line only. */
async function loadCurrentCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<CapTableWithArchiveContext[]> {
  const contracts: unknown = await client.getActiveContracts({
    parties: [issuerPartyId],
    templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
  });
  assertSafeGeneratedDamlJson(contracts, 'CapTable.activeContracts');
  if (!Array.isArray(contracts)) {
    throw new OcpContractError('Invalid CapTable contract response: expected active-contract array', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }
  const out: CapTableWithArchiveContext[] = [];
  for (const [index, rawContract] of contracts.entries()) {
    const contract = requireStrictActiveContractItem(rawContract, `CapTable.activeContracts[${index}]`);
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
 * Classifies whether the issuer has an active CapTable on **the pinned OpenCapTable package line** (see module doc).
 *
 * @param client - Ledger JSON API client
 * @param issuerPartyId - Issuer party id to query (template-filtered active contracts)
 * @returns `'current'` with context when exactly one matching CapTable exists; `'none'` otherwise
 * @throws OcpContractError — e.g. multiple active CapTables, `SCHEMA_MISMATCH` when a row is not the pinned template
 */
export async function classifyIssuerCapTables(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<IssuerCapTableClassification> {
  const currentRows = await loadCurrentCapTables(client, issuerPartyId);
  if (currentRows.length === 0) {
    return { status: 'none', current: null };
  }
  const [current] = currentRows;
  if (current === undefined) {
    throw new OcpContractError('CapTable query returned an inconsistent non-empty result', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }
  return { status: 'current', current };
}

/**
 * Reads CapTable state **on the pinned package line only**, or `null` if the filtered query finds no such contract.
 * This does not imply the issuer has no CapTable on other templates.
 *
 * @param client - Ledger JSON API client
 * @param issuerPartyId - Issuer party id
 * @returns {@link CapTableState} for the current package-line CapTable, or `null` if {@link classifyIssuerCapTables} is `none`
 * @throws OcpContractError — same failure modes as {@link classifyIssuerCapTables} when loading the CapTable row
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
