import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';

import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import {
  checkOcfObjectView,
  checkRegisterContractView,
  checkRegisterSignatories,
  identifyRegisterTemplate,
  parseCreatedEvent,
  rawContextOf,
  recordSecurityIds,
  type RuleResult,
} from '../../../register/admissionRules';
import { moduleEntityOf, REGISTER_TEMPLATES, type RegisterTemplate } from '../../../register/templates';
import type { GetByContractIdParams } from '../../../types/common';
import type { RegisterContext } from '../../../types/register';
import { ledgerReadScope } from '../../../utils/readScope';
import { findUnsafeJsonIssue } from '../../../utils/safeJson';
import { assertTemplateIdentity, type ParsedTemplateIdentity } from '../../../utils/templateIdentity';

export interface LedgerCreatedEvent {
  contractId?: string;
  templateId?: unknown;
  packageName?: unknown;
  createArgument?: unknown;
  signatories?: unknown;
  offset?: unknown;
  interfaceViews?: unknown;
}

export interface ContractEventsResponse {
  created?: {
    createdEvent?: LedgerCreatedEvent | null;
  } | null;
}

export interface SingleContractReadOptions {
  operation: string;
  /**
   * The template the contract must be. When it is an OpenCapTable-v35 register template, the read also applies the
   * register's admission rules (see {@link readSingleContract}).
   */
  expectedTemplateId?: string;
  missingDataError?: 'contract' | 'parse';
}

export interface SingleContractReadResult {
  contractId: string;
  createArgument: Record<string, unknown>;
  createdEvent: LedgerCreatedEvent;
  templateId?: string;
  packageName?: string;
  templateIdentity?: ParsedTemplateIdentity;
}

function assertSafeLedgerResponse(
  value: unknown,
  contractId: string,
  operation?: string
): asserts value is ContractEventsResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpParseError('Contract events response must be an object', {
      source: `contract ${contractId}.eventsResponse`,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'invalid_ledger_json',
      context: {
        contractId,
        operation,
        receivedValue: value,
      },
    });
  }

  const source = `contract ${contractId}.eventsResponse`;
  const issue = findUnsafeJsonIssue(value, source);
  if (issue === undefined) return;
  const createArgumentPath = `${source}.created.createdEvent.createArgument`;
  const isCreateArgumentIssue =
    issue.path === createArgumentPath ||
    issue.path.startsWith(`${createArgumentPath}.`) ||
    issue.path.startsWith(`${createArgumentPath}[`);

  throw new OcpParseError(`Invalid contract events response: ${issue.message}`, {
    source: issue.path,
    code: isCreateArgumentIssue ? OcpErrorCodes.SCHEMA_MISMATCH : OcpErrorCodes.INVALID_RESPONSE,
    classification: isCreateArgumentIssue ? 'invalid_create_argument_json' : 'invalid_ledger_json',
    context: {
      contractId,
      operation,
      issueKind: issue.kind,
      receivedValue: issue.receivedValue,
    },
  });
}

export function extractCreateArgument(
  eventsResponse: ContractEventsResponse,
  contractId: string,
  diagnostics: { operation?: string } = {}
): unknown {
  assertSafeLedgerResponse(eventsResponse, contractId, diagnostics.operation);
  if (!eventsResponse.created?.createdEvent) {
    throw new OcpParseError('Invalid contract events response: missing created event', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'missing_created_event',
      context: {
        contractId,
        operation: diagnostics.operation,
      },
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;
  if (createArgument == null) {
    throw new OcpParseError('Invalid contract events response: missing create argument', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'missing_create_argument',
      context: {
        contractId,
        operation: diagnostics.operation,
      },
    });
  }

  return createArgument;
}

function requireCreateArgumentRecord(
  createArgument: unknown,
  contractId: string,
  diagnostics: { operation: string; templateId?: string }
): Record<string, unknown> {
  if (
    ((typeof createArgument === 'object' && createArgument !== null) || typeof createArgument === 'function') &&
    nodeUtilTypes.isProxy(createArgument)
  ) {
    throw new OcpParseError('Contract createArgument must not be a proxy', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_shape',
      context: {
        contractId,
        operation: diagnostics.operation,
        templateId: diagnostics.templateId,
        receivedValue: createArgument,
      },
    });
  }
  if (!createArgument || typeof createArgument !== 'object' || Array.isArray(createArgument)) {
    throw new OcpParseError('Contract createArgument must be an object', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_shape',
      context: {
        contractId,
        operation: diagnostics.operation,
        templateId: diagnostics.templateId,
        receivedType: Array.isArray(createArgument) ? 'array' : typeof createArgument,
      },
    });
  }

  return createArgument as Record<string, unknown>;
}

function missingContractDataError(
  mode: 'contract' | 'parse',
  message: string,
  contractId: string,
  diagnostics: { operation: string; classification: string }
): OcpContractError | OcpParseError {
  const context = {
    contractId,
    operation: diagnostics.operation,
  };

  return mode === 'contract'
    ? new OcpContractError(message, {
        contractId,
        code: OcpErrorCodes.RESULT_NOT_FOUND,
        classification: diagnostics.classification,
        context,
      })
    : new OcpParseError(message, {
        source: `contract ${contractId}`,
        code: OcpErrorCodes.INVALID_RESPONSE,
        classification: diagnostics.classification,
        context,
      });
}

function registerRuleError(
  rule: RuleResult<unknown> & { ok: false },
  contractId: string,
  templateId: string | undefined,
  operation: string
): OcpContractError {
  return new OcpContractError(`Contract ${contractId} is not a genuine register contract: ${rule.message}`, {
    code: rule.reason === 'wrong_signatories' ? OcpErrorCodes.AUTHORIZATION_FAILED : OcpErrorCodes.SCHEMA_MISMATCH,
    contractId,
    templateId,
    classification: `register_${rule.reason}`,
    context: { contractId, operation, reason: rule.reason },
  });
}

/**
 * The register's admission rules a single created event can be checked against (rules 1, 4 and 6 of `admitContract`;
 * the caller decodes the payload through its generated codec, rule 3):
 *
 * 1. Its package name is `OpenCapTable-v35`, present on the event or in a `#name:` template ID.
 * 4. Its signatories are exactly its `context`'s issuer, `system_operator` and TA, three distinct parties.
 * 6. When the event carries the reader interface's view, the view names the payload's cap table, object ID, object type
 *    and security IDs. `getEventsByContractId` in canton-node-sdk 0.0.266 reads with a wildcard filter, which returns
 *    no views, so this holds once that read takes interface filters.
 *
 * A `context` that is not a record of four strings is left to the caller's decoding, which rejects it.
 */
function applyRegisterRules(
  createdEvent: LedgerCreatedEvent,
  createArgument: Record<string, unknown>,
  template: RegisterTemplate,
  contractId: string,
  operation: string
): void {
  const templateId = typeof createdEvent.templateId === 'string' ? createdEvent.templateId : undefined;
  const parsed = parseCreatedEvent({
    contractId,
    templateId,
    packageName: createdEvent.packageName,
    createArgument,
    signatories: createdEvent.signatories,
    offset: typeof createdEvent.offset === 'number' ? createdEvent.offset : 0,
    interfaceViews: createdEvent.interfaceViews,
  });
  if (!parsed.ok) throw registerRuleError(parsed, contractId, templateId, operation);
  const identity = identifyRegisterTemplate(parsed.value);
  if (!identity.ok) throw registerRuleError(identity, contractId, templateId, operation);

  const context: RegisterContext | null = rawContextOf(createArgument);
  if (context === null) return;
  const signatories = checkRegisterSignatories(parsed.value.signatories, context);
  if (!signatories.ok) throw registerRuleError(signatories, contractId, templateId, operation);

  const views = parsed.value.interfaceViews;
  if (template.kind === 'record') {
    const data = createArgument.ocf_data;
    const objectId = typeof data === 'object' && data !== null ? (data as { id?: unknown }).id : undefined;
    if (typeof objectId !== 'string') return;
    const view = checkOcfObjectView(
      views,
      {
        capTableId: context.cap_table_id,
        objectType: template.objectType,
        objectId,
        securityIds: recordSecurityIds(template.entityType, data),
      },
      { requireView: false }
    );
    if (!view.ok) throw registerRuleError(view, contractId, templateId, operation);
    return;
  }
  const key =
    template.kind === 'anchor'
      ? context.cap_table_id
      : createArgument[
          template.kind === 'state' ? 'security_id' : template.kind === 'epoch' ? 'stock_class_id' : 'prefix'
        ];
  if (typeof key !== 'string') return;
  const view = checkRegisterContractView(
    views,
    { capTableId: context.cap_table_id, kind: template.viewKind, key },
    { requireView: false }
  );
  if (!view.ok) throw registerRuleError(view, contractId, templateId, operation);
}

/**
 * Fetch one contract's created event by contract ID and return its create argument.
 *
 * With an `expectedTemplateId`, the template's module and entity must match, and the event's package name must be the
 * expected template's (an event without one fails). When that template is an OpenCapTable-v35 register template, the
 * event must also pass the register's single-event admission rules: exactly the three `Context` parties as signatories,
 * and a consistent interface view when one is present.
 */
export async function readSingleContract(
  client: LedgerJsonApiClient,
  params: GetByContractIdParams,
  options: SingleContractReadOptions
): Promise<SingleContractReadResult> {
  const rawEventsResponse: unknown = await client.getEventsByContractId({
    contractId: params.contractId,
    ...ledgerReadScope(params),
  });
  assertSafeLedgerResponse(rawEventsResponse, params.contractId, options.operation);
  const eventsResponse = rawEventsResponse;

  const createdEvent = eventsResponse.created?.createdEvent;
  if (!createdEvent) {
    throw missingContractDataError(
      options.missingDataError ?? 'contract',
      'Invalid contract events response: missing created event',
      params.contractId,
      {
        operation: options.operation,
        classification: 'missing_created_event',
      }
    );
  }

  if (createdEvent.createArgument == null) {
    throw missingContractDataError(
      options.missingDataError ?? 'contract',
      'Invalid contract events response: missing create argument',
      params.contractId,
      {
        operation: options.operation,
        classification: 'missing_create_argument',
      }
    );
  }

  const templateId = typeof createdEvent.templateId === 'string' ? createdEvent.templateId : undefined;
  const packageName = typeof createdEvent.packageName === 'string' ? createdEvent.packageName : undefined;
  const templateIdentity = options.expectedTemplateId
    ? assertTemplateIdentity(
        {
          templateId,
          packageName,
        },
        options.expectedTemplateId,
        {
          contractId: params.contractId,
          operation: options.operation,
          message:
            templateId === undefined && packageName === undefined
              ? 'Contract template identity is missing; cannot validate expected template'
              : undefined,
        }
      )
    : undefined;

  const createArgument = requireCreateArgumentRecord(createdEvent.createArgument, params.contractId, {
    operation: options.operation,
    templateId,
  });

  const expectedModuleEntity =
    options.expectedTemplateId === undefined ? null : moduleEntityOf(options.expectedTemplateId);
  const registerTemplate = expectedModuleEntity === null ? undefined : REGISTER_TEMPLATES.get(expectedModuleEntity);
  if (registerTemplate !== undefined) {
    applyRegisterRules(createdEvent, createArgument, registerTemplate, params.contractId, options.operation);
  }

  return {
    contractId: params.contractId,
    createArgument,
    createdEvent,
    templateId,
    packageName,
    templateIdentity,
  };
}
