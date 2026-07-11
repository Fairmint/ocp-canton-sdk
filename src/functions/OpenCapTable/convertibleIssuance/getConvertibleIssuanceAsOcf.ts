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
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { convertibleMechanismFromDaml } from '../shared/conversionMechanisms';
import { readSingleContract } from '../shared/singleContractRead';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type OcfConvertibleIssuanceEvent = OcfConvertibleIssuance;

export interface GetConvertibleIssuanceAsOcfParams extends GetByContractIdParams {}

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
  if (typeof value !== 'string' || value.length === 0) {
    throw invalid(field, `${field} must be a non-empty string`, value);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireString(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(field, `${field} must be a boolean`, value);
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
  switch (value) {
    case 'OcfConvertibleNote':
      return 'NOTE';
    case 'OcfConvertibleSafe':
      return 'SAFE';
    case 'OcfConvertibleSecurity':
      return 'CONVERTIBLE_SECURITY';
    default:
      throw new OcpParseError(`Unknown convertible_type: ${String(value)}`, {
        source: 'convertibleIssuance.convertible_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function unwrapConvertibleRight(value: unknown, field: string): Record<string, unknown> {
  const right = requireRecord(value, field);
  if ('conversion_mechanism' in right) return right;
  if ('OcfRightConvertible' in right) {
    return requireRecord(right.OcfRightConvertible, `${field}.OcfRightConvertible`);
  }
  if (right.tag === 'OcfRightConvertible') {
    return requireRecord(right.value, `${field}.value`);
  }
  throw invalid(field, 'Expected a convertible conversion right', value);
}

function conversionRightFromDaml(value: unknown, field: string): ConvertibleConversionRight {
  const right = unwrapConvertibleRight(value, field);
  if (right.type_ !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw invalid(
      `${field}.type_`,
      'Convertible conversion right type must be CONVERTIBLE_CONVERSION_RIGHT',
      right.type_
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
  if (!Array.isArray(value)) {
    throw invalid('convertibleIssuance.security_law_exemptions', 'security_law_exemptions must be an array', value);
  }
  return value.map((item, index) => {
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
    throw invalid('convertibleIssuance.comments', 'comments must be an array of strings', value);
  }
  return value.length > 0 ? value : undefined;
}

/** Convert decoded DAML ConvertibleIssuance data to its canonical OCF shape. */
export function damlConvertibleIssuanceDataToNative(value: unknown): OcfConvertibleIssuance {
  const data = requireRecord(value, 'convertibleIssuance');
  const id = requireString(data.id, 'convertibleIssuance.id');
  const date = damlTimeToDateString(data.date, 'convertibleIssuance.date');
  const investmentAmount = requireRecord(data.investment_amount, 'convertibleIssuance.investment_amount');
  const { amount } = investmentAmount;
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw invalid('convertibleIssuance.investment_amount.amount', 'investment amount must be a decimal string', amount);
  }
  const conversionTriggers = data.conversion_triggers;
  if (!Array.isArray(conversionTriggers)) {
    throw invalid(
      'convertibleIssuance.conversion_triggers',
      'conversion_triggers must be an array',
      conversionTriggers
    );
  }
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
      : normalizeNumericString(
          typeof data.pro_rata === 'string' || typeof data.pro_rata === 'number'
            ? data.pro_rata
            : (() => {
                throw invalid('convertibleIssuance.pro_rata', 'pro_rata must be a decimal string', data.pro_rata);
              })(),
          'convertibleIssuance.pro_rata'
        );
  const comments = commentsFromDaml(data.comments);

  return {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id,
    date,
    security_id: requireString(data.security_id, 'convertibleIssuance.security_id'),
    custom_id: requireString(data.custom_id, 'convertibleIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'convertibleIssuance.stakeholder_id'),
    investment_amount: {
      amount: normalizeNumericString(amount, 'convertibleIssuance.investment_amount.amount'),
      currency: requireString(investmentAmount.currency, 'convertibleIssuance.investment_amount.currency'),
    },
    convertible_type: convertibleTypeFromDaml(data.convertible_type),
    conversion_triggers: conversionTriggers.map(conversionTriggerFromDaml),
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
