import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { GetByContractIdParams } from '../../../types/common';
import type { PkgConvertibleIssuanceOcfData } from '../../../types/daml';
import type {
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  ConvertibleType,
  OcfConvertibleIssuance,
} from '../../../types/native';
import { assertDamlConversionTriggerFieldNames, parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import {
  damlTimeToDateString,
  isRecord,
  mapDamlTriggerTypeToOcf,
  optionalDamlTimeToDateString,
  toNonEmptyArray,
} from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { convertibleMechanismFromDaml } from '../shared/conversionMechanisms';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { parseDamlNumeric10 } from '../shared/damlNumerics';
import { readSingleContract } from '../shared/singleContractRead';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type OcfConvertibleIssuanceEvent = OcfConvertibleIssuance;
export type DamlConvertibleIssuanceData = PkgConvertibleIssuanceOcfData;

export type GetConvertibleIssuanceAsOcfParams = GetByContractIdParams;

export interface GetConvertibleIssuanceAsOcfResult {
  event: OcfConvertibleIssuanceEvent;
  contractId: string;
}

function invalid(field: string, message: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw invalid(field, `${field} must be an object`, value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(field, `${field} must be a non-empty string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(field, `${field} must be a non-empty string`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') throw invalid(field, `${field} must be a string`, value);
  return value;
}

function requireCurrency(value: unknown, field: string): string {
  const currency = requireString(value, field);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw invalid(field, `${field} must be a three-letter uppercase ISO 4217 code`, value);
  }
  return currency;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(field, `${field} must be a boolean`, value);
  return value;
}

function convertibleTypeFromDaml(value: unknown): ConvertibleType {
  switch (value) {
    case 'OcfConvertibleNote':
      return 'NOTE';
    case 'OcfConvertibleSafe':
      return 'SAFE';
    case 'OcfConvertibleSecurity':
      return 'CONVERTIBLE_SECURITY';
    default:
      throw new OcpParseError(`Unknown convertible_type: ${describeDiagnosticValue(value)}`, {
        source: 'convertibleIssuance.convertible_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function unwrapConvertibleRight(value: unknown, source: string): Record<string, unknown> {
  const right = requireRecord(value, source);
  if ('OcfRightConvertible' in right || 'tag' in right || 'value' in right) {
    throw invalid(source, 'Expected the direct v34 convertible conversion-right record', value);
  }
  return right;
}

function conversionRightFromDaml(value: unknown, source: string): ConvertibleConversionRight {
  const right = unwrapConvertibleRight(value, source);
  if (right.type_ !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw invalid(
      `${source}.type_`,
      'Convertible conversion right type must be CONVERTIBLE_CONVERSION_RIGHT',
      right.type_
    );
  }
  const convertsToFutureRound = optionalBoolean(right.converts_to_future_round, `${source}.converts_to_future_round`);
  const convertsToStockClassId = optionalString(
    right.converts_to_stock_class_id,
    `${source}.converts_to_stock_class_id`
  );
  return {
    type: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismFromDaml(right.conversion_mechanism, `${source}.conversion_mechanism`),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId !== undefined ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

function conversionTriggerFromDaml(value: unknown, index: number): ConvertibleConversionTrigger {
  const source = `convertibleIssuance.conversion_triggers[${index}]`;
  const trigger = requireRecord(value, source);
  assertDamlConversionTriggerFieldNames(trigger, source);
  const typePath = `${source}.type_`;
  const type = mapDamlTriggerTypeToOcf(requireString(trigger.type_, typePath), typePath);
  const triggerFields = triggerFieldsFromDaml(trigger, type, source);
  return parseConversionTriggerFields(
    {
      type,
      trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
      conversion_right: conversionRightFromDaml(trigger.conversion_right, `${source}.conversion_right`),
      nickname: trigger.nickname,
      trigger_description: trigger.trigger_description,
      ...triggerFields,
    },
    source,
    { nullIsAbsent: true, unexpectedFieldCode: OcpErrorCodes.SCHEMA_MISMATCH }
  );
}

function securityLawExemptionsFromDaml(value: unknown): Array<{ description: string; jurisdiction: string }> {
  if (!Array.isArray(value)) {
    throw invalid('convertibleIssuance.security_law_exemptions', 'security_law_exemptions must be an array', value);
  }
  return value.map((item, index) => {
    const exemption = requireRecord(item, `convertibleIssuance.security_law_exemptions[${index}]`);
    return {
      description: requireString(
        exemption.description,
        `convertibleIssuance.security_law_exemptions[${index}].description`
      ),
      jurisdiction: requireString(
        exemption.jurisdiction,
        `convertibleIssuance.security_law_exemptions[${index}].jurisdiction`
      ),
    };
  });
}

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw invalid('convertibleIssuance.comments', 'comments must be an array of strings', value);
  }
  const comments = value.map((comment, index) => requireString(comment, `convertibleIssuance.comments[${index}]`));
  return comments.length > 0 ? comments : undefined;
}

/** Convert decoded DAML ConvertibleIssuance data to its canonical OCF shape. */
export function damlConvertibleIssuanceDataToNative(value: DamlConvertibleIssuanceData): OcfConvertibleIssuance {
  const data = decodeDamlEntityData('convertibleIssuance', value);
  const id = requireString(data.id, 'convertibleIssuance.id');
  const date = damlTimeToDateString(data.date, 'convertibleIssuance.date');
  const investmentAmount = requireRecord(data.investment_amount, 'convertibleIssuance.investment_amount');
  const amount = parseDamlNumeric10(investmentAmount.amount, 'convertibleIssuance.investment_amount.amount');
  const conversionTriggers = data.conversion_triggers;
  if (!Array.isArray(conversionTriggers)) {
    throw invalid(
      'convertibleIssuance.conversion_triggers',
      'conversion_triggers must be an array',
      conversionTriggers
    );
  }
  const seniority = parseDamlSafeInteger(data.seniority, 'convertibleIssuance.seniority', 'int');
  const boardApprovalDate = optionalDamlTimeToDateString(
    data.board_approval_date,
    'convertibleIssuance.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    data.stockholder_approval_date,
    'convertibleIssuance.stockholder_approval_date'
  );
  const considerationText = optionalString(data.consideration_text, 'convertibleIssuance.consideration_text');
  const proRata =
    data.pro_rata === null ? undefined : parseDamlNumeric10(data.pro_rata, 'convertibleIssuance.pro_rata');
  const comments = commentsFromDaml(data.comments);

  const result: OcfConvertibleIssuance = {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id,
    date,
    security_id: requireString(data.security_id, 'convertibleIssuance.security_id'),
    custom_id: requireString(data.custom_id, 'convertibleIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'convertibleIssuance.stakeholder_id'),
    investment_amount: {
      amount,
      currency: requireCurrency(investmentAmount.currency, 'convertibleIssuance.investment_amount.currency'),
    },
    convertible_type: convertibleTypeFromDaml(data.convertible_type),
    conversion_triggers: toNonEmptyArray(
      conversionTriggers.map(conversionTriggerFromDaml),
      'convertibleIssuance.conversion_triggers'
    ),
    seniority,
    security_law_exemptions: securityLawExemptionsFromDaml(data.security_law_exemptions),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(proRata !== undefined ? { pro_rata: proRata } : {}),
    ...(comments ? { comments } : {}),
  };
  return result;
}

/** Retrieve a ConvertibleIssuance contract and return it as an OCF JSON object. */
export async function getConvertibleIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleIssuanceAsOcfParams
): Promise<GetConvertibleIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleIssuance,
  });
  const data = extractAndDecodeDamlEntityData('convertibleIssuance', createArgument);
  const native = damlConvertibleIssuanceDataToNative(data);
  return { event: native, contractId: params.contractId };
}
