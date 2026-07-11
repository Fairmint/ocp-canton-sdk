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
} from '../../../types/native';
import { assertDamlConversionTriggerFieldNames, parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import {
  damlTimeToDateString,
  isRecord,
  mapDamlTriggerTypeToOcf,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { ratioMechanismFromDaml, warrantMechanismFromDaml } from '../shared/conversionMechanisms';
import { readSingleContract } from '../shared/singleContractRead';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

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
  if (!isRecord(value)) {
    throw new OcpValidationError(field, `${field} must be a Monetary object`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  const monetary = value;
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
    conversion_mechanism: warrantMechanismFromDaml(
      value.conversion_mechanism,
      'warrantIssuance.exercise_triggers[].conversion_right.conversion_mechanism'
    ),
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
  const convertsToStockClassId = requireString(
    value.converts_to_stock_class_id,
    'warrantIssuance.conversion_right.converts_to_stock_class_id'
  );
  return {
    type: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: ratioMechanismFromDaml(
      value,
      'warrantIssuance.exercise_triggers[].conversion_right.conversion_mechanism'
    ),
    converts_to_stock_class_id: convertsToStockClassId,
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
  };
}

type DecodedWarrantRight =
  | { kind: 'warrant'; right: WarrantConversionRight }
  | { kind: 'stock-class'; right: StockClassConversionRight; nestedTrigger: unknown };

function conversionRightFromDaml(value: unknown): DecodedWarrantRight {
  const variant = requireRecord(value, 'warrantIssuance.conversion_right');
  const tag = requireString(variant.tag, 'warrantIssuance.conversion_right.tag');
  const inner = requireRecord(variant.value, 'warrantIssuance.conversion_right.value');
  switch (tag) {
    case 'OcfRightWarrant':
      return { kind: 'warrant', right: warrantRightFromDaml(inner) };
    case 'OcfRightStockClass':
      return {
        kind: 'stock-class',
        right: stockClassRightFromDaml(inner),
        nestedTrigger: inner.conversion_trigger,
      };
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

const NESTED_TRIGGER_FIELDS = [
  'type',
  'trigger_id',
  'nickname',
  'trigger_description',
  'trigger_date',
  'trigger_condition',
  'start_date',
  'end_date',
] as const;

function schemaMismatch(field: string, message: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(field, message, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    expectedType,
    receivedValue,
  });
}

function requireNestedRecord(value: unknown, source: string): Record<string, unknown> {
  if (!isRecord(value)) {
    return schemaMismatch(source, `${source} must be a canonical DAML record`, 'object', value);
  }
  return value;
}

function assertExactNestedFields(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  source: string
): void {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      schemaMismatch(
        `${source}.${field}`,
        `${field} is not a valid field on the canonical nested stock-class storage placeholder`,
        'absent',
        record[field]
      );
    }
  }
}

function nestedStockClassTargetFromDaml(value: unknown, source: string, expectedTarget: string): string {
  const rightSource = `${source}.conversion_right`;
  const variant = requireNestedRecord(value, rightSource);
  assertExactNestedFields(variant, ['tag', 'value'], rightSource);
  if (variant.tag !== 'OcfRightConvertible') {
    return schemaMismatch(
      `${rightSource}.tag`,
      'Nested stock-class storage trigger must use the canonical convertible placeholder right',
      'OcfRightConvertible',
      variant.tag
    );
  }

  const innerSource = `${rightSource}.value`;
  const inner = requireNestedRecord(variant.value, innerSource);
  assertExactNestedFields(
    inner,
    ['type_', 'conversion_mechanism', 'converts_to_future_round', 'converts_to_stock_class_id'],
    innerSource
  );
  if (inner.type_ !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    return schemaMismatch(
      `${innerSource}.type_`,
      'Nested stock-class storage trigger has an invalid placeholder right type',
      'CONVERTIBLE_CONVERSION_RIGHT',
      inner.type_
    );
  }
  if (inner.converts_to_future_round !== null) {
    return schemaMismatch(
      `${innerSource}.converts_to_future_round`,
      'Nested stock-class storage trigger must not target a future round',
      'null',
      inner.converts_to_future_round
    );
  }
  if (inner.converts_to_stock_class_id !== expectedTarget) {
    return schemaMismatch(
      `${innerSource}.converts_to_stock_class_id`,
      'Nested stock-class storage trigger target must match the enclosing stock-class right',
      expectedTarget,
      inner.converts_to_stock_class_id
    );
  }

  const mechanismSource = `${innerSource}.conversion_mechanism`;
  const mechanism = requireNestedRecord(inner.conversion_mechanism, mechanismSource);
  assertExactNestedFields(mechanism, ['tag', 'value'], mechanismSource);
  if (mechanism.tag !== 'OcfConvMechCustom') {
    return schemaMismatch(
      `${mechanismSource}.tag`,
      'Nested stock-class storage trigger must use the canonical custom placeholder mechanism',
      'OcfConvMechCustom',
      mechanism.tag
    );
  }
  const mechanismValueSource = `${mechanismSource}.value`;
  const mechanismValue = requireNestedRecord(mechanism.value, mechanismValueSource);
  assertExactNestedFields(mechanismValue, ['custom_conversion_description'], mechanismValueSource);
  if (mechanismValue.custom_conversion_description !== 'Stock class conversion') {
    return schemaMismatch(
      `${mechanismValueSource}.custom_conversion_description`,
      'Nested stock-class storage trigger has an invalid placeholder description',
      'Stock class conversion',
      mechanismValue.custom_conversion_description
    );
  }

  return expectedTarget;
}

function assertNestedStockClassTrigger(
  value: unknown,
  outerTrigger: WarrantExerciseTrigger,
  expectedTarget: string,
  outerSource: string
): void {
  const source = `${outerSource}.conversion_right.conversion_trigger`;
  const trigger = requireNestedRecord(value, source);
  assertDamlConversionTriggerFieldNames(trigger, source);
  const typePath = `${source}.type_`;
  const type = mapDamlTriggerTypeToOcf(requireString(trigger.type_, typePath), typePath);
  const triggerFields = triggerFieldsFromDaml(trigger, type, source);
  const nestedTrigger = parseConversionTriggerFields(
    {
      type,
      trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
      conversion_right: nestedStockClassTargetFromDaml(trigger.conversion_right, source, expectedTarget),
      nickname: trigger.nickname,
      trigger_description: trigger.trigger_description,
      ...triggerFields,
    },
    source,
    { nullIsAbsent: true, unexpectedFieldCode: OcpErrorCodes.SCHEMA_MISMATCH }
  );

  const outer = outerTrigger as unknown as Record<string, unknown>;
  const nested = nestedTrigger as unknown as Record<string, unknown>;
  for (const field of NESTED_TRIGGER_FIELDS) {
    if (nested[field] !== outer[field]) {
      schemaMismatch(
        `${source}.${field}`,
        `Nested stock-class storage trigger ${field} must match the enclosing trigger`,
        `same value as ${outerSource}.${field}`,
        nested[field]
      );
    }
  }
}

function triggerFromDaml(value: unknown, index: number): WarrantExerciseTrigger {
  const source = `warrantIssuance.exercise_triggers.${index}`;
  const trigger = requireRecord(value, source);
  assertDamlConversionTriggerFieldNames(trigger, source);
  const typePath = `${source}.type_`;
  const type = mapDamlTriggerTypeToOcf(requireString(trigger.type_, typePath), typePath);
  const triggerFields = triggerFieldsFromDaml(trigger, type, source);
  const decodedRight = conversionRightFromDaml(trigger.conversion_right);
  const parsed = parseConversionTriggerFields(
    {
      type,
      trigger_id: requireString(trigger.trigger_id, `${source}.trigger_id`),
      conversion_right: decodedRight.right,
      nickname: trigger.nickname,
      trigger_description: trigger.trigger_description,
      ...triggerFields,
    },
    source,
    { nullIsAbsent: true, unexpectedFieldCode: OcpErrorCodes.SCHEMA_MISMATCH }
  );
  if (decodedRight.kind === 'stock-class') {
    assertNestedStockClassTrigger(
      decodedRight.nestedTrigger,
      parsed,
      decodedRight.right.converts_to_stock_class_id,
      source
    );
  }
  return parsed;
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
      date: damlTimeToDateString(vesting.date, 'warrantIssuance.vestings[].date'),
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
  const expirationDate = optionalDamlTimeToDateString(
    data.warrant_expiration_date,
    'warrantIssuance.warrant_expiration_date'
  );
  const vestingTermsId = optionalString(data.vesting_terms_id, 'warrantIssuance.vesting_terms_id');
  const boardApprovalDate = optionalDamlTimeToDateString(
    data.board_approval_date,
    'warrantIssuance.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    data.stockholder_approval_date,
    'warrantIssuance.stockholder_approval_date'
  );
  const considerationText = optionalString(data.consideration_text, 'warrantIssuance.consideration_text');
  const vestings = vestingsFromDaml(data.vestings);
  const comments = commentsFromDaml(data.comments);

  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: requireString(data.id, 'warrantIssuance.id'),
    date: damlTimeToDateString(data.date, 'warrantIssuance.date'),
    security_id: requireString(data.security_id, 'warrantIssuance.security_id'),
    custom_id: requireText(data.custom_id, 'warrantIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'warrantIssuance.stakeholder_id'),
    purchase_price: monetaryFromDaml(data.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: exerciseTriggers.map(triggerFromDaml),
    security_law_exemptions: securityLawExemptionsFromDaml(data.security_law_exemptions),
    ...(quantity ? { quantity } : {}),
    ...(quantitySource ? { quantity_source: quantitySource } : {}),
    ...(exercisePrice ? { exercise_price: exercisePrice } : {}),
    ...(expirationDate !== undefined ? { warrant_expiration_date: expirationDate } : {}),
    ...(vestingTermsId ? { vesting_terms_id: vestingTermsId } : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
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
