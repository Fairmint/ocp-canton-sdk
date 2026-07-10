import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  Monetary,
  OcfWarrantIssuance,
  QuantitySourceType,
  StockClassConversionRight,
  VestingSimple,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantTriggerConversionRight,
} from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import {
  damlTimeToDateString,
  isRecord,
  mapDamlTriggerTypeToOcf,
  normalizeNumericString,
} from '../../../utils/typeConversions';
import { ratioMechanismFromDaml, warrantMechanismFromDaml } from '../shared/conversionMechanisms';
import { readSingleContract } from '../shared/singleContractRead';

export interface GetWarrantIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetWarrantIssuanceAsOcfResult {
  warrantIssuance: OcfWarrantIssuance;
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

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw invalid(field, `${field} must be a string`, value);
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

function monetaryFromDaml(value: unknown, field: string): Monetary {
  const monetary = requireRecord(value, field);
  const { amount } = monetary;
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw invalid(`${field}.amount`, `${field}.amount must be a decimal string`, amount);
  }
  return {
    amount: normalizeNumericString(amount),
    currency: requireString(monetary.currency, `${field}.currency`),
  };
}

function optionalMonetary(value: unknown, field: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  return monetaryFromDaml(value, field);
}

function warrantRightFromDaml(value: Record<string, unknown>): WarrantConversionRight {
  if (value.type_ !== 'WARRANT_CONVERSION_RIGHT') {
    throw invalid(
      'warrantIssuance.conversion_right.type',
      'Warrant conversion right type must be WARRANT_CONVERSION_RIGHT',
      value.type_
    );
  }
  const convertsToFutureRound = optionalBoolean(
    value.converts_to_future_round,
    'warrantIssuance.conversion_right.converts_to_future_round'
  );
  const convertsToStockClassId = optionalString(
    value.converts_to_stock_class_id,
    'warrantIssuance.conversion_right.converts_to_stock_class_id'
  );
  return {
    type: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: warrantMechanismFromDaml(value.conversion_mechanism),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

function stockClassRightFromDaml(value: Record<string, unknown>): StockClassConversionRight {
  if (value.type_ !== 'STOCK_CLASS_CONVERSION_RIGHT') {
    throw invalid(
      'warrantIssuance.conversion_right.type',
      'Stock-class conversion right type must be STOCK_CLASS_CONVERSION_RIGHT',
      value.type_
    );
  }
  const convertsToFutureRound = optionalBoolean(
    value.converts_to_future_round,
    'warrantIssuance.conversion_right.converts_to_future_round'
  );
  const convertsToStockClassId = optionalString(
    value.converts_to_stock_class_id,
    'warrantIssuance.conversion_right.converts_to_stock_class_id'
  );
  return {
    type: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: ratioMechanismFromDaml(value, 'warrantIssuance.conversion_right'),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

function conversionRightFromDaml(value: unknown): WarrantTriggerConversionRight {
  const variant = requireRecord(value, 'warrantIssuance.conversion_right');
  const tag = requireString(variant.tag, 'warrantIssuance.conversion_right.tag');
  const inner = requireRecord(variant.value, 'warrantIssuance.conversion_right.value');
  switch (tag) {
    case 'OcfRightWarrant':
      return warrantRightFromDaml(inner);
    case 'OcfRightStockClass':
      return stockClassRightFromDaml(inner);
    case 'OcfRightConvertible':
      throw new OcpParseError('Convertible conversion rights are not supported by WarrantIssuance', {
        source: 'warrantIssuance.conversion_right.tag',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    default:
      throw new OcpParseError(`Unknown warrant conversion right tag: ${tag}`, {
        source: 'warrantIssuance.conversion_right.tag',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function optionalDamlDate(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return damlTimeToDateString(value, field);
}

function triggerFromDaml(value: unknown, index: number): WarrantExerciseTrigger {
  const source = `warrantIssuance.exercise_triggers.${index}`;
  const trigger = requireRecord(value, source);
  return parseConversionTriggerFields(
    {
      type: mapDamlTriggerTypeToOcf(requireString(trigger.type_, `${source}.type`)),
      trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
      conversion_right: conversionRightFromDaml(trigger.conversion_right),
      nickname: trigger.nickname,
      trigger_description: trigger.trigger_description,
      trigger_date: optionalDamlDate(trigger.trigger_date, `${source}.trigger_date`),
      trigger_condition: trigger.trigger_condition,
      start_date: optionalDamlDate(trigger.start_date, `${source}.start_date`),
      end_date: optionalDamlDate(trigger.end_date, `${source}.end_date`),
    },
    source,
    { nullIsAbsent: true }
  );
}

function quantitySourceFromDaml(value: unknown): QuantitySourceType | undefined {
  if (value === null || value === undefined) return undefined;
  switch (value) {
    case 'OcfQuantityHumanEstimated':
      return 'HUMAN_ESTIMATED';
    case 'OcfQuantityMachineEstimated':
      return 'MACHINE_ESTIMATED';
    case 'OcfQuantityUnspecified':
      return 'UNSPECIFIED';
    case 'OcfQuantityInstrumentFixed':
      return 'INSTRUMENT_FIXED';
    case 'OcfQuantityInstrumentMax':
      return 'INSTRUMENT_MAX';
    case 'OcfQuantityInstrumentMin':
      return 'INSTRUMENT_MIN';
    default:
      const received =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
      throw new OcpParseError(`Unknown quantity_source: ${received}`, {
        source: 'warrantIssuance.quantity_source',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function vestingsFromDaml(value: unknown): VestingSimple[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalid('warrantIssuance.vestings', 'vestings must be an array', value);
  const vestings = value.map((item, index) => {
    const vesting = requireRecord(item, `warrantIssuance.vestings.${index}`);
    const { amount } = vesting;
    if (typeof amount !== 'string' && typeof amount !== 'number') {
      throw invalid(`warrantIssuance.vestings.${index}.amount`, 'vesting amount must be a decimal string', amount);
    }
    return {
      date: damlTimeToDateString(requireString(vesting.date, `warrantIssuance.vestings.${index}.date`)),
      amount: normalizeNumericString(amount),
    };
  });
  return vestings.length > 0 ? vestings : undefined;
}

function securityLawExemptionsFromDaml(value: unknown): Array<{ description: string; jurisdiction: string }> {
  if (!Array.isArray(value)) {
    throw invalid('warrantIssuance.security_law_exemptions', 'security_law_exemptions must be an array', value);
  }
  return value.map((item, index) => {
    const exemption = requireRecord(item, `warrantIssuance.security_law_exemptions.${index}`);
    return {
      description: requireString(exemption.description, `warrantIssuance.security_law_exemptions.${index}.description`),
      jurisdiction: requireString(
        exemption.jurisdiction,
        `warrantIssuance.security_law_exemptions.${index}.jurisdiction`
      ),
    };
  });
}

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw invalid('warrantIssuance.comments', 'comments must be an array of strings', value);
  }
  return value.length > 0 ? value : undefined;
}

/** Convert decoded DAML WarrantIssuance data to its canonical OCF shape. */
export function damlWarrantIssuanceDataToNative(value: unknown): OcfWarrantIssuance {
  const data = requireRecord(value, 'warrantIssuance');
  const exerciseTriggers = data.exercise_triggers;
  if (!Array.isArray(exerciseTriggers)) {
    throw invalid('warrantIssuance.exercise_triggers', 'exercise_triggers must be an array', exerciseTriggers);
  }
  const quantity =
    data.quantity === null || data.quantity === undefined
      ? undefined
      : typeof data.quantity === 'string' || typeof data.quantity === 'number'
        ? normalizeNumericString(data.quantity)
        : (() => {
            throw invalid('warrantIssuance.quantity', 'quantity must be a decimal string', data.quantity);
          })();
  const quantitySource = quantitySourceFromDaml(data.quantity_source);
  const exercisePrice = optionalMonetary(data.exercise_price, 'warrantIssuance.exercise_price');
  const expirationDate = optionalString(data.warrant_expiration_date, 'warrantIssuance.warrant_expiration_date');
  const vestingTermsId = optionalString(data.vesting_terms_id, 'warrantIssuance.vesting_terms_id');
  const boardApprovalDate = optionalString(data.board_approval_date, 'warrantIssuance.board_approval_date');
  const stockholderApprovalDate = optionalString(
    data.stockholder_approval_date,
    'warrantIssuance.stockholder_approval_date'
  );
  const considerationText = optionalString(data.consideration_text, 'warrantIssuance.consideration_text');
  const vestings = vestingsFromDaml(data.vestings);
  const comments = commentsFromDaml(data.comments);

  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: requireString(data.id, 'warrantIssuance.id'),
    date: damlTimeToDateString(requireString(data.date, 'warrantIssuance.date')),
    security_id: requireString(data.security_id, 'warrantIssuance.security_id'),
    custom_id: requireText(data.custom_id, 'warrantIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'warrantIssuance.stakeholder_id'),
    purchase_price: monetaryFromDaml(data.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: exerciseTriggers.map(triggerFromDaml),
    security_law_exemptions: securityLawExemptionsFromDaml(data.security_law_exemptions),
    ...(quantity ? { quantity } : {}),
    ...(quantitySource ? { quantity_source: quantitySource } : {}),
    ...(exercisePrice ? { exercise_price: exercisePrice } : {}),
    ...(expirationDate ? { warrant_expiration_date: damlTimeToDateString(expirationDate) } : {}),
    ...(vestingTermsId ? { vesting_terms_id: vestingTermsId } : {}),
    ...(boardApprovalDate ? { board_approval_date: damlTimeToDateString(boardApprovalDate) } : {}),
    ...(stockholderApprovalDate ? { stockholder_approval_date: damlTimeToDateString(stockholderApprovalDate) } : {}),
    ...(considerationText ? { consideration_text: considerationText } : {}),
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };
}

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantIssuanceAsOcf',
  });
  if (!isRecord(createArgument) || !('issuance_data' in createArgument)) {
    throw new OcpParseError('Unexpected createArgument for WarrantIssuance', {
      source: 'WarrantIssuance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const native = damlWarrantIssuanceDataToNative(createArgument.issuance_data);
  return { warrantIssuance: native, contractId: params.contractId };
}
