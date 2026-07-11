import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  ConvertibleType,
  OcfConvertibleIssuance,
} from '../../../types/native';
import {
  damlTimeToDateString,
  isRecord,
  mapDamlTriggerTypeToOcf,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { convertibleMechanismFromDaml } from '../shared/conversionMechanisms';
import { requireDecimalString, requireMonetary, requireNonEmptyArray } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type OcfConvertibleIssuanceEvent = OcfConvertibleIssuance;

export interface GetConvertibleIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetConvertibleIssuanceAsOcfResult {
  event: OcfConvertibleIssuanceEvent;
  contractId: string;
}

function invalidFormat(field: string, message: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    receivedValue,
  });
}

function invalidType(field: string, message: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, message, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  if (!Array.isArray(value)) throw invalidType(field, `${field} must be an array`, 'array', value);
  return value;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) {
    throw requiredMissing(field, 'object', value);
  }
  if (!isRecord(value)) {
    throw invalidType(field, `${field} must be an object`, 'object', value);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(field, 'non-empty string', value);
  }
  if (typeof value !== 'string') {
    throw invalidType(field, `${field} must be a string`, 'non-empty string', value);
  }
  if (value.length === 0) {
    throw invalidFormat(field, `${field} must be a non-empty string`, value);
  }
  return value;
}

function requiredDate(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(fieldPath, 'DAML Time or date string', value);
  }
  return damlTimeToDateString(value, fieldPath);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireString(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(field, `${field} must be a boolean`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean',
      receivedValue: value,
    });
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  const expectedType = 'safe integer number or base-10 integer string';
  if (value === null || value === undefined) {
    throw new OcpValidationError(field, `${field} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new OcpValidationError(field, `${field} must be an integer`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value === 'string' && !/^-?\d+$/.test(value)) {
    throw new OcpValidationError(field, `${field} must be a base-10 integer string`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  const integer = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(integer)) {
    throw new OcpValidationError(field, `${field} must be a safe integer`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return integer;
}

function convertibleTypeFromDaml(value: unknown): ConvertibleType {
  const field = 'convertibleIssuance.convertible_type';
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'OcfConvertibleNote':
      return 'NOTE';
    case 'OcfConvertibleSafe':
      return 'SAFE';
    case 'OcfConvertibleSecurity':
      return 'CONVERTIBLE_SECURITY';
    default:
      throw new OcpParseError(`Unknown convertible_type: ${runtimeValue}`, {
        source: field,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function conversionRightFromDaml(value: unknown, field: string): ConvertibleConversionRight {
  const right = requireRecord(value, field);
  const rightType = requireString(right.type_, `${field}.type_`);
  if (rightType !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw invalidFormat(
      `${field}.type_`,
      'Convertible conversion right type must be CONVERTIBLE_CONVERSION_RIGHT',
      rightType
    );
  }
  const convertsToFutureRound = optionalBoolean(right.converts_to_future_round, `${field}.converts_to_future_round`);
  const convertsToStockClassId = optionalString(
    right.converts_to_stock_class_id,
    `${field}.converts_to_stock_class_id`
  );
  return {
    type: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismFromDaml(right.conversion_mechanism, `${field}.conversion_mechanism`),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

function conversionTriggerFromDaml(value: unknown, index: number): ConvertibleConversionTrigger {
  const field = `convertibleIssuance.conversion_triggers.${index}`;
  const trigger = requireRecord(value, field);
  const nickname = optionalString(trigger.nickname, `${field}.nickname`);
  const description = optionalString(trigger.trigger_description, `${field}.trigger_description`);
  const typePath = `${field}.type_`;
  const type = mapDamlTriggerTypeToOcf(requireString(trigger.type_, typePath), typePath);
  const triggerFields = triggerFieldsFromDaml(trigger, type, field);
  return {
    type,
    trigger_id: requireString(trigger.trigger_id, `${field}.trigger_id`),
    conversion_right: conversionRightFromDaml(trigger.conversion_right, `${field}.conversion_right`),
    ...(nickname ? { nickname } : {}),
    ...(description ? { trigger_description: description } : {}),
    ...triggerFields,
  };
}

function securityLawExemptionsFromDaml(value: unknown): Array<{ description: string; jurisdiction: string }> {
  return requireArray(value, 'convertibleIssuance.security_law_exemptions').map((item, index) => {
    const exemption = requireRecord(item, `convertibleIssuance.security_law_exemptions.${index}`);
    return {
      description: requireString(
        exemption.description,
        `convertibleIssuance.security_law_exemptions.${index}.description`
      ),
      jurisdiction: requireString(
        exemption.jurisdiction,
        `convertibleIssuance.security_law_exemptions.${index}.jurisdiction`
      ),
    };
  });
}

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw invalidType('convertibleIssuance.comments', 'comments must be an array of strings', 'string[]', value);
  }
  return value.length > 0 ? value : undefined;
}

/** Convert decoded DAML ConvertibleIssuance data to its canonical OCF shape. */
export function damlConvertibleIssuanceDataToNative(value: unknown): OcfConvertibleIssuance {
  const data = requireRecord(value, 'convertibleIssuance');
  const id = requireString(data.id, 'convertibleIssuance.id');
  const date = requiredDate(data.date, 'convertibleIssuance.date');
  const investmentAmount = requireMonetary(data.investment_amount, 'convertibleIssuance.investment_amount');
  const conversionTriggers = requireNonEmptyArray(data.conversion_triggers, 'convertibleIssuance.conversion_triggers');
  const [firstConversionTrigger, ...remainingConversionTriggers] = conversionTriggers;
  const nativeConversionTriggers: OcfConvertibleIssuance['conversion_triggers'] = [
    conversionTriggerFromDaml(firstConversionTrigger, 0),
    ...remainingConversionTriggers.map((trigger, index) => conversionTriggerFromDaml(trigger, index + 1)),
  ];
  const seniority = requiredInteger(data.seniority, 'convertibleIssuance.seniority');
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
    data.pro_rata === null || data.pro_rata === undefined
      ? undefined
      : requireDecimalString(data.pro_rata, 'convertibleIssuance.pro_rata');
  const comments = commentsFromDaml(data.comments);

  return {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id,
    date,
    security_id: requireString(data.security_id, 'convertibleIssuance.security_id'),
    custom_id: requireString(data.custom_id, 'convertibleIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'convertibleIssuance.stakeholder_id'),
    investment_amount: investmentAmount,
    convertible_type: convertibleTypeFromDaml(data.convertible_type),
    conversion_triggers: nativeConversionTriggers,
    seniority,
    security_law_exemptions: securityLawExemptionsFromDaml(data.security_law_exemptions),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText ? { consideration_text: considerationText } : {}),
    ...(proRata !== undefined ? { pro_rata: proRata } : {}),
    ...(comments ? { comments } : {}),
  };
}

/** Retrieve a ConvertibleIssuance contract and return it as an OCF JSON object. */
export async function getConvertibleIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleIssuanceAsOcfParams
): Promise<GetConvertibleIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleIssuanceAsOcf',
  });
  if (!isRecord(createArgument) || !('issuance_data' in createArgument)) {
    throw new OcpParseError('Unexpected createArgument for ConvertibleIssuance', {
      source: 'ConvertibleIssuance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const native = damlConvertibleIssuanceDataToNative(createArgument.issuance_data);
  return { event: native, contractId: params.contractId };
}
