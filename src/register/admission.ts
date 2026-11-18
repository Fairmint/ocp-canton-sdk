/**
 * `admitContract`: every per-contract rule a reader applies before it indexes a register contract, on one created
 * event.
 *
 * 1. Its package name is `OpenCapTable-v35` and its template's module and entity are one of the register's 55
 *    templates (a package ID other than the bundled one is a warning).
 * 2. The matching interface view (`OcfObject` for an OCF record, `RegisterContract` otherwise) is present, decodes,
 *    and names the payload's cap table (and a register contract's kind and key).
 * 3. Its payload decodes through its generated codec, and an OCF record converts to native OCF.
 * 4. Its signatories are exactly its `Context`'s issuer, `system_operator` and TA, three distinct parties.
 * 6. An OCF record's view names its object ID, its registry object type and the security IDs it names.
 *
 * Rule 5 (key on the full `Context`: foreign contexts and duplicate anchors) needs the whole snapshot, so the reader
 * and the key index apply it.
 */

import { convertToOcf } from '../functions/OpenCapTable/capTable/damlToOcf';
import type {
  AdmittedRegisterContract,
  RegisterContext,
  RegisterReadWarning,
  RegisterRecord,
  RegisterRejectedContract,
} from '../types/register';
import {
  checkOcfObjectView,
  checkRegisterContractView,
  checkRegisterSignatories,
  identifyRegisterTemplate,
  parseCreatedEvent,
  rawContextOf,
  recordSecurityIds,
  rejectedContract,
  type ParsedCreatedEvent,
  type RuleResult,
} from './admissionRules';
import {
  capTableStatusToNative,
  contextToNative,
  decodeCapTablePayload,
  decodeOcfIdShardPayload,
  decodeRecordPayload,
  decodeStockClassEpochPayload,
  decodeStockSecurityPayload,
  ocfIdShardToNative,
  stockClassEpochToNative,
  stockSecurityToNative,
} from './codec';
import type { RegisterTemplate } from './templates';

/** How strictly to admit. */
export interface AdmitContractOptions {
  /**
   * Whether the matching interface view must be present (rule 2). True for reads filtered by the reader interfaces;
   * a view present on any read is always checked.
   */
  requireView: boolean;
}

/** The outcome of admitting one created event. */
export type AdmissionResult =
  | {
      readonly ok: true;
      readonly contract: AdmittedRegisterContract;
      readonly warnings: RegisterReadWarning[];
    }
  | {
      readonly ok: false;
      readonly rejection: RegisterRejectedContract;
      /**
       * The `Context` the contract's raw payload names, when its signatories are exactly that context's three parties:
       * the contract is then that book's, whatever else is wrong with it.
       */
      readonly signedBy: RegisterContext | null;
      readonly warnings: RegisterReadWarning[];
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Decoded {
  context: RegisterContext;
  contract: AdmittedRegisterContract;
}

function decodeContract(
  event: ParsedCreatedEvent,
  template: RegisterTemplate,
  options: AdmitContractOptions
): RuleResult<Decoded> {
  const source = `contract ${event.contractId}.createArgument`;
  const ref = { contractId: event.contractId, templateId: event.templateId, createdOffset: event.offset };
  const invalid = (error: unknown): RuleResult<Decoded> => ({
    ok: false,
    reason: 'invalid_payload',
    message: `Payload does not decode: ${errorMessage(error)}`,
  });
  switch (template.kind) {
    case 'record': {
      let decoded;
      let data;
      try {
        decoded = decodeRecordPayload(template.entityType, event.createArgument, source);
        data = convertToOcf(template.entityType, decoded.ocf_data);
      } catch (error) {
        return invalid(error);
      }
      const context = contextToNative(decoded.context);
      const named = recordSecurityIds(template.entityType, decoded.ocf_data);
      const view = checkOcfObjectView(
        event.interfaceViews,
        {
          capTableId: context.cap_table_id,
          objectType: template.objectType,
          objectId: decoded.ocf_data.id,
          securityIds: named,
        },
        options
      );
      if (!view.ok) return view;
      const record = {
        ...ref,
        entityType: template.entityType,
        objectId: decoded.ocf_data.id,
        objectType: template.objectType,
        securityIds: [...view.value],
        data,
      } as RegisterRecord;
      return { ok: true, value: { context, contract: { kind: 'record', context, contract: record } } };
    }
    case 'anchor': {
      let payload;
      try {
        payload = decodeCapTablePayload(event.createArgument, source);
      } catch (error) {
        return invalid(error);
      }
      const context = contextToNative(payload.context);
      const view = checkRegisterContractView(
        event.interfaceViews,
        { capTableId: context.cap_table_id, kind: template.viewKind, key: context.cap_table_id },
        options
      );
      if (!view.ok) return view;
      const contract = { ...ref, status: capTableStatusToNative(payload.status) };
      return { ok: true, value: { context, contract: { kind: 'anchor', context, contract } } };
    }
    case 'state': {
      let state;
      try {
        state = stockSecurityToNative(decodeStockSecurityPayload(event.createArgument, source), source);
      } catch (error) {
        return invalid(error);
      }
      const { context } = state;
      const view = checkRegisterContractView(
        event.interfaceViews,
        { capTableId: context.cap_table_id, kind: template.viewKind, key: state.security_id },
        options
      );
      if (!view.ok) return view;
      return { ok: true, value: { context, contract: { kind: 'state', context, contract: { ...ref, state } } } };
    }
    case 'epoch': {
      let epoch;
      try {
        epoch = stockClassEpochToNative(decodeStockClassEpochPayload(event.createArgument, source), source);
      } catch (error) {
        return invalid(error);
      }
      const { context } = epoch;
      const view = checkRegisterContractView(
        event.interfaceViews,
        { capTableId: context.cap_table_id, kind: template.viewKind, key: epoch.stock_class_id },
        options
      );
      if (!view.ok) return view;
      return { ok: true, value: { context, contract: { kind: 'epoch', context, contract: { ...ref, epoch } } } };
    }
    case 'shard': {
      let shard;
      try {
        shard = ocfIdShardToNative(decodeOcfIdShardPayload(event.createArgument, source), source);
      } catch (error) {
        return invalid(error);
      }
      const { context } = shard;
      const view = checkRegisterContractView(
        event.interfaceViews,
        { capTableId: context.cap_table_id, kind: template.viewKind, key: shard.prefix },
        options
      );
      if (!view.ok) return view;
      return { ok: true, value: { context, contract: { kind: 'shard', context, contract: { ...ref, shard } } } };
    }
  }
}

/**
 * Apply rules 1, 2, 3, 4 and 6 to one created event. A rejection names the rule broken; when the contract's raw
 * context names three parties that are exactly its signatories, `signedBy` carries that context, so a reader can tell a
 * genuine contract of a book it cannot read from a copy signed by someone else.
 */
export function admitContract(value: unknown, options: AdmitContractOptions): AdmissionResult {
  const parsed = parseCreatedEvent(value);
  if (!parsed.ok) {
    const envelope = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      ok: false,
      rejection: rejectedContract(
        {
          contractId: typeof envelope.contractId === 'string' ? envelope.contractId : '',
          templateId: typeof envelope.templateId === 'string' ? envelope.templateId : null,
          packageName: typeof envelope.packageName === 'string' ? envelope.packageName : null,
        },
        parsed.reason,
        parsed.message,
        null
      ),
      signedBy: null,
      warnings: [],
    };
  }
  const event = parsed.value;
  const raw = rawContextOf(event.createArgument);
  const signedBy = raw !== null && checkRegisterSignatories(event.signatories, raw).ok ? raw : null;
  const reject = (reason: RuleResult<never> & { ok: false }, warnings: RegisterReadWarning[]): AdmissionResult => ({
    ok: false,
    rejection: rejectedContract(event, reason.reason, reason.message, raw?.cap_table_id ?? null),
    signedBy,
    warnings,
  });

  const identity = identifyRegisterTemplate(event);
  if (!identity.ok) return reject(identity, []);
  const warnings = identity.value.warning === null ? [] : [identity.value.warning];

  const decoded = decodeContract(event, identity.value.template, options);
  if (!decoded.ok) return reject(decoded, warnings);

  const signatories = checkRegisterSignatories(event.signatories, decoded.value.context);
  if (!signatories.ok) return reject(signatories, warnings);

  return { ok: true, contract: decoded.value.contract, warnings };
}
