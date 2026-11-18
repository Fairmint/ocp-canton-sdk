/**
 * The per-contract admission rules a reader applies before it trusts a register contract: any package can implement
 * the reader interfaces with a copied view, so a contract counts only if its template is OpenCapTable-v35's, its view
 * agrees with its payload and its signatories are exactly its `Context`'s issuer, `system_operator` and TA.
 *
 * These are the rules that need no record converter, so the single-contract read path can use them; `admission.ts`
 * composes them with decoding into `admitContract`.
 */

import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type {
  RegisterContext,
  RegisterReadWarning,
  RegisterRejectedContract,
  RegisterRejectionReason,
} from '../types/register';
import { isRecord } from '../utils/typeConversions';
import { decodeOcfObjectView, decodeRegisterContractView } from './codec';
import {
  BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID,
  moduleEntityOf,
  OCF_OBJECT_INTERFACE,
  OPEN_CAP_TABLE_PACKAGE_NAME,
  packageRefOf,
  REGISTER_CONTRACT_INTERFACE,
  REGISTER_TEMPLATES,
  type RegisterContractViewKind,
  type RegisterTemplate,
} from './templates';

/** An interface view as a created event carries it. */
export interface CreatedEventView {
  interfaceId: string;
  viewStatus: { code: number; message: string } | null;
  viewValue: unknown;
}

/** A created event whose envelope fields have been checked. */
export interface ParsedCreatedEvent {
  contractId: string;
  templateId: string;
  /** The event's package name, or the one a `#name:` template ID carries */
  packageName: string | null;
  createArgument: unknown;
  signatories: string[];
  offset: number;
  interfaceViews: CreatedEventView[];
}

/** A rule's outcome: the value, or why the contract is not admitted. */
export type RuleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: RegisterRejectionReason; readonly message: string };

function fail(
  reason: RegisterRejectionReason,
  message: string
): { ok: false; reason: RegisterRejectionReason; message: string } {
  return { ok: false, reason, message };
}

function stringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseView(value: unknown): CreatedEventView | null {
  if (!isRecord(value)) return null;
  const interfaceId = stringField(value, 'interfaceId');
  if (interfaceId === null) return null;
  const status = value.viewStatus;
  const viewStatus =
    isRecord(status) && typeof status.code === 'number'
      ? { code: status.code, message: typeof status.message === 'string' ? status.message : '' }
      : null;
  return { interfaceId, viewStatus, viewValue: value.viewValue };
}

/** Check a created event's envelope: contract and template IDs, signatories, offset and views. */
export function parseCreatedEvent(value: unknown): RuleResult<ParsedCreatedEvent> {
  if (!isRecord(value)) return fail('invalid_event', 'Created event must be an object');
  const contractId = stringField(value, 'contractId');
  if (contractId === null) return fail('invalid_event', 'Created event has no contractId');
  const templateId = stringField(value, 'templateId');
  if (templateId === null) return fail('invalid_event', 'Created event has no templateId');
  const { signatories, offset, interfaceViews } = value;
  if (!Array.isArray(signatories) || !signatories.every((party): party is string => typeof party === 'string')) {
    return fail('invalid_event', 'Created event has no signatories list');
  }
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    return fail('invalid_event', 'Created event has no valid offset');
  }
  const views: CreatedEventView[] = [];
  if (interfaceViews !== undefined && interfaceViews !== null) {
    if (!Array.isArray(interfaceViews)) return fail('invalid_event', 'Created event interfaceViews must be a list');
    for (const view of interfaceViews) {
      const parsed = parseView(view);
      if (parsed === null) return fail('invalid_event', 'Created event carries a malformed interface view');
      views.push(parsed);
    }
  }
  const declaredPackageName = stringField(value, 'packageName');
  const packageRef = packageRefOf(templateId);
  const packageName = declaredPackageName ?? (packageRef.startsWith('#') ? packageRef.slice(1) : null);
  return {
    ok: true,
    value: {
      contractId,
      templateId,
      packageName,
      createArgument: value.createArgument,
      signatories: [...signatories],
      offset,
      interfaceViews: views,
    },
  };
}

/**
 * Rule 1: the package name is `OpenCapTable-v35` and the template's module and entity are one of the register's 55
 * templates. A package ID other than the bundled one is a warning only: an upgrade keeps the name.
 */
export function identifyRegisterTemplate(
  event: Pick<ParsedCreatedEvent, 'contractId' | 'templateId' | 'packageName'>
): RuleResult<{ template: RegisterTemplate; warning: RegisterReadWarning | null }> {
  if (event.packageName !== OPEN_CAP_TABLE_PACKAGE_NAME) {
    return fail('wrong_package', `Package ${event.packageName ?? '(none)'} is not ${OPEN_CAP_TABLE_PACKAGE_NAME}`);
  }
  const moduleEntity = moduleEntityOf(event.templateId);
  const template = moduleEntity === null ? undefined : REGISTER_TEMPLATES.get(moduleEntity);
  if (template === undefined) {
    return fail(
      'unknown_template',
      `Template ${event.templateId} is not an ${OPEN_CAP_TABLE_PACKAGE_NAME} register template`
    );
  }
  const packageRef = packageRefOf(event.templateId);
  const warning: RegisterReadWarning | null =
    packageRef.startsWith('#') || packageRef === BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID
      ? null
      : {
          kind: 'package_id',
          contractId: event.contractId,
          templateId: event.templateId,
          message: `Contract of ${OPEN_CAP_TABLE_PACKAGE_NAME} package ${packageRef}, not the bundled ${BUNDLED_OPEN_CAP_TABLE_PACKAGE_ID}`,
        };
  return { ok: true, value: { template, warning } };
}

/** The parties of a create argument's `context`, when all four fields are readable strings. */
export function rawContextOf(createArgument: unknown): RegisterContext | null {
  if (!isRecord(createArgument) || !isRecord(createArgument.context)) return null;
  const { context } = createArgument;
  const capTableId = stringField(context, 'cap_table_id');
  const issuer = stringField(context, 'issuer');
  const systemOperator = stringField(context, 'system_operator');
  const transferAgent = stringField(context, 'transfer_agent');
  if (capTableId === null || issuer === null || systemOperator === null || transferAgent === null) return null;
  return { cap_table_id: capTableId, issuer, system_operator: systemOperator, transfer_agent: transferAgent };
}

/** Whether two contexts are the same book's: one cap table ID and the same three parties. */
export function sameContext(a: RegisterContext, b: RegisterContext): boolean {
  return (
    a.cap_table_id === b.cap_table_id &&
    a.issuer === b.issuer &&
    a.system_operator === b.system_operator &&
    a.transfer_agent === b.transfer_agent
  );
}

/** A stable key for a full `Context`. */
export function contextKey(context: RegisterContext): string {
  return JSON.stringify([context.cap_table_id, context.issuer, context.system_operator, context.transfer_agent]);
}

/**
 * Rule 4: the signatories are exactly the `Context`'s issuer, `system_operator` and TA, three distinct parties (every
 * register template signs with all three).
 */
export function checkRegisterSignatories(signatories: readonly string[], context: RegisterContext): RuleResult<null> {
  const expected = [context.issuer, context.system_operator, context.transfer_agent];
  if (new Set(expected).size !== 3) {
    return fail('wrong_signatories', 'Context does not name three distinct parties');
  }
  const actual = new Set(signatories);
  if (signatories.length !== 3 || actual.size !== 3 || !expected.every((party) => actual.has(party))) {
    return fail(
      'wrong_signatories',
      `Signatories [${signatories.join(', ')}] are not the context's issuer, system_operator and transfer_agent`
    );
  }
  return { ok: true, value: null };
}

/** The view of the interface with `Module:Entity` `interfaceModuleEntity`, if the event carries one. */
export function findInterfaceView(
  views: readonly CreatedEventView[],
  interfaceModuleEntity: string
): CreatedEventView | null {
  return views.find((view) => moduleEntityOf(view.interfaceId) === interfaceModuleEntity) ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function viewValueOf(view: CreatedEventView | null, interfaceName: string): RuleResult<unknown> {
  if (view === null) return fail('missing_view', `Created event carries no ${interfaceName} view`);
  if (view.viewStatus !== null && view.viewStatus.code !== 0) {
    return fail('invalid_view', `${interfaceName} view failed: ${view.viewStatus.message}`);
  }
  if (view.viewValue === undefined || view.viewValue === null) {
    return fail('invalid_view', `${interfaceName} view has no value`);
  }
  return { ok: true, value: view.viewValue };
}

/** What an OCF record's `OcfObject` view must say, from its decoded payload. */
export interface ExpectedOcfObjectView {
  capTableId: string;
  objectType: string;
  objectId: string;
  securityIds: readonly string[];
}

/**
 * Rules 2 and 6 for an OCF record: its `OcfObject` view decodes, names the payload's cap table, and names the record's
 * object ID, object type and security IDs. Returns the view's security IDs. With `requireView: false` an absent view
 * passes (the Ledger API returns views only for a read filtered by the interface).
 */
export function checkOcfObjectView(
  views: readonly CreatedEventView[],
  expected: ExpectedOcfObjectView,
  options: { requireView: boolean }
): RuleResult<readonly string[]> {
  const view = findInterfaceView(views, OCF_OBJECT_INTERFACE);
  if (view === null && !options.requireView) return { ok: true, value: expected.securityIds };
  const value = viewValueOf(view, 'OcfObject');
  if (!value.ok) return value;
  let decoded;
  try {
    decoded = decodeOcfObjectView(value.value, 'OcfObject view');
  } catch (error) {
    return fail('invalid_view', `OcfObject view does not decode: ${errorMessage(error)}`);
  }
  if (decoded.cap_table_id !== expected.capTableId) {
    return fail(
      'view_mismatch',
      `OcfObject view names cap table ${decoded.cap_table_id}, the payload ${expected.capTableId}`
    );
  }
  if (decoded.object_id !== expected.objectId) {
    return fail('record_mismatch', `OcfObject view names object ${decoded.object_id}, the record ${expected.objectId}`);
  }
  if (decoded.object_type !== expected.objectType) {
    return fail(
      'record_mismatch',
      `OcfObject view names object type ${decoded.object_type}, the template ${expected.objectType}`
    );
  }
  const viewIds = new Set(decoded.security_ids);
  const recordIds = new Set(expected.securityIds);
  if (
    viewIds.size !== decoded.security_ids.length ||
    viewIds.size !== recordIds.size ||
    !decoded.security_ids.every((id) => recordIds.has(id))
  ) {
    return fail(
      'record_mismatch',
      `OcfObject view names securities [${decoded.security_ids.join(', ')}], the record [${[...recordIds].join(', ')}]`
    );
  }
  return { ok: true, value: decoded.security_ids };
}

/**
 * Rule 2 for the anchor and the state templates: the `RegisterContract` view decodes and names the payload's cap
 * table, the template's kind and the contract's key.
 */
export function checkRegisterContractView(
  views: readonly CreatedEventView[],
  expected: { capTableId: string; kind: RegisterContractViewKind; key: string },
  options: { requireView: boolean }
): RuleResult<null> {
  const view = findInterfaceView(views, REGISTER_CONTRACT_INTERFACE);
  if (view === null && !options.requireView) return { ok: true, value: null };
  const value = viewValueOf(view, 'RegisterContract');
  if (!value.ok) return value;
  let decoded;
  try {
    decoded = decodeRegisterContractView(value.value, 'RegisterContract view');
  } catch (error) {
    return fail('invalid_view', `RegisterContract view does not decode: ${errorMessage(error)}`);
  }
  if (decoded.cap_table_id !== expected.capTableId) {
    return fail(
      'view_mismatch',
      `RegisterContract view names cap table ${decoded.cap_table_id}, the payload ${expected.capTableId}`
    );
  }
  if (decoded.kind !== expected.kind || decoded.key !== expected.key) {
    return fail(
      'view_mismatch',
      `RegisterContract view says ${decoded.kind} ${decoded.key}, the payload ${expected.kind} ${expected.key}`
    );
  }
  return { ok: true, value: null };
}

type SecurityIdShape =
  'none' | 'security' | 'security_balance' | 'security_resulting' | 'security_resulting_balance' | 'consolidation';

/** Which security IDs each record kind's `OcfObject` view lists, as its template computes them. */
const SECURITY_ID_SHAPES = {
  convertibleAcceptance: 'security',
  convertibleCancellation: 'security_balance',
  convertibleConversion: 'security_resulting_balance',
  convertibleIssuance: 'security',
  convertibleRetraction: 'security',
  convertibleTransfer: 'security_resulting_balance',
  document: 'none',
  equityCompensationAcceptance: 'security',
  equityCompensationCancellation: 'security_balance',
  equityCompensationExercise: 'security_resulting',
  equityCompensationIssuance: 'security',
  equityCompensationRelease: 'security_resulting',
  equityCompensationRepricing: 'security',
  equityCompensationRetraction: 'security',
  equityCompensationTransfer: 'security_resulting_balance',
  financing: 'none',
  issuer: 'none',
  issuerAuthorizedSharesAdjustment: 'none',
  stakeholder: 'none',
  stakeholderRelationshipChangeEvent: 'none',
  stakeholderStatusChangeEvent: 'none',
  stockAcceptance: 'security',
  stockCancellation: 'security_balance',
  stockClass: 'none',
  stockClassAuthorizedSharesAdjustment: 'none',
  stockClassConversionRatioAdjustment: 'none',
  stockClassSplit: 'none',
  stockConsolidation: 'consolidation',
  stockConversion: 'security_resulting_balance',
  stockHold: 'security',
  stockHoldCancellation: 'security',
  stockIssuance: 'security',
  stockLegendTemplate: 'none',
  stockPlan: 'none',
  stockPlanPoolAdjustment: 'none',
  stockPlanReturnToPool: 'security',
  stockReissuance: 'security_resulting',
  stockRepurchase: 'security_balance',
  stockRetraction: 'security',
  stockTransfer: 'security_resulting_balance',
  valuation: 'none',
  vestingAcceleration: 'security',
  vestingEvent: 'security',
  vestingStart: 'security',
  vestingTerms: 'none',
  warrantAcceptance: 'security',
  warrantCancellation: 'security_balance',
  warrantExercise: 'security_resulting',
  warrantIssuance: 'security',
  warrantRetraction: 'security',
  warrantTransfer: 'security_resulting_balance',
} as const satisfies Record<OcfEntityType, SecurityIdShape>;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function optionalString(value: unknown): string[] {
  return typeof value === 'string' ? [value] : [];
}

/**
 * The security IDs an OCF record names, deduplicated in the order its `OcfObject` view lists them (OpenCapTable-v35's
 * `security_ids = dedup (...)`): the security, then the resulting securities, then the balance; a consolidation's
 * sources, then its result.
 */
export function recordSecurityIds(entityType: OcfEntityType, ocfData: unknown): string[] {
  const data = isRecord(ocfData) ? ocfData : {};
  const security = optionalString(data.security_id);
  const resulting = stringList(data.resulting_security_ids);
  const balance = optionalString(data.balance_security_id);
  let ids: string[];
  switch (SECURITY_ID_SHAPES[entityType]) {
    case 'none':
      ids = [];
      break;
    case 'security':
      ids = security;
      break;
    case 'security_balance':
      ids = [...security, ...balance];
      break;
    case 'security_resulting':
      ids = [...security, ...resulting];
      break;
    case 'security_resulting_balance':
      ids = [...security, ...resulting, ...balance];
      break;
    case 'consolidation':
      ids = [...stringList(data.security_ids), ...optionalString(data.resulting_security_id)];
      break;
  }
  return [...new Set(ids)];
}

/** A rejection report for a contract. */
export function rejectedContract(
  event: { contractId: string; templateId: string | null; packageName: string | null },
  reason: RegisterRejectionReason,
  message: string,
  capTableId: string | null
): RegisterRejectedContract {
  return {
    contractId: event.contractId,
    templateId: event.templateId,
    packageName: event.packageName,
    capTableId,
    reason,
    message,
  };
}
