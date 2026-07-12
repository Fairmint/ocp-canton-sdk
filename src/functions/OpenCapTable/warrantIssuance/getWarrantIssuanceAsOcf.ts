import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { GetByContractIdParams } from '../../../types/common';
import type { PkgWarrantIssuanceOcfData } from '../../../types/daml';
import type {
  ConvertibleConversionRight,
  Monetary,
  NonEmptyArray,
  OcfWarrantIssuance,
  QuantitySourceType,
  StockClassConversionRight,
  VestingSimple,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantTriggerConversionRight,
} from '../../../types/native';
import {
  assertDamlConversionTriggerFieldNames,
  assertUniqueConversionTriggerIds,
  parseConversionTriggerFields,
} from '../../../utils/conversionTriggers';
import { assertSafeGeneratedDamlJson } from '../../../utils/generatedDamlValidation';
import {
  damlTimeToDateString,
  isRecord,
  mapDamlTriggerTypeToOcf,
  nonEmptyArrayOrUndefined,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { ratioMechanismFromDaml, warrantMechanismFromDaml } from '../shared/conversionMechanisms';
import { parseDamlNumeric10 } from '../shared/damlNumerics';
import { readSingleContract } from '../shared/singleContractRead';
import {
  assertInapplicableStockClassRightFields,
  assertStockClassStorageTrigger,
} from '../shared/stockClassRightStorage';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type DamlWarrantIssuanceData = PkgWarrantIssuanceOcfData;
export type GetWarrantIssuanceAsOcfParams = GetByContractIdParams;

export interface GetWarrantIssuanceAsOcfResult {
  warrantIssuance: OcfWarrantIssuance;
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

function requiredDate(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(fieldPath, 'DAML Time or date string', value);
  }
  return damlTimeToDateString(value, fieldPath);
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
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(field, `${field} must be a boolean`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean',
      receivedValue: value,
    });
  }
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
  return {
    amount: parseDamlNumeric10(monetary.amount, `${field}.amount`),
    currency: requireCurrency(monetary.currency, `${field}.currency`),
  };
}

function optionalMonetary(value: unknown, field: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  return monetaryFromDaml(value, field);
}

function warrantRightFromDaml(value: Record<string, unknown>, field: string): WarrantConversionRight {
  const rightType = requireString(value.type_, `${field}.type_`);
  if (rightType !== 'WARRANT_CONVERSION_RIGHT') {
    throw invalidFormat(`${field}.type_`, 'Warrant conversion right type must be WARRANT_CONVERSION_RIGHT', rightType);
  }
  const convertsToFutureRound = optionalBoolean(value.converts_to_future_round, `${field}.converts_to_future_round`);
  const convertsToStockClassId = optionalString(
    value.converts_to_stock_class_id,
    `${field}.converts_to_stock_class_id`
  );
  return {
    type: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: warrantMechanismFromDaml(value.conversion_mechanism, `${field}.conversion_mechanism`),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId !== undefined ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

const UNSUPPORTED_STOCK_CLASS_STORAGE_FIELDS = [
  'ceiling_price_per_share',
  'custom_description',
  'discount_rate',
  'expires_at',
  'floor_price_per_share',
  'percent_of_capitalization',
  'reference_share_price',
  'reference_valuation_price_per_share',
  'valuation_cap',
] as const;

function assertNoUnsupportedStockClassStorageFields(value: Record<string, unknown>, source: string): void {
  for (const field of UNSUPPORTED_STOCK_CLASS_STORAGE_FIELDS) {
    const storedValue = value[field];
    if (storedValue === null || storedValue === undefined) continue;

    schemaMismatch(
      `${source}.${field}`,
      `${field} cannot be represented by the canonical OCF ratio-only stock-class conversion right`,
      'null',
      storedValue
    );
  }
}

function stockClassRightFromDaml(value: Record<string, unknown>, source: string): StockClassConversionRight {
  if (value.type_ !== 'STOCK_CLASS_CONVERSION_RIGHT') {
    throw invalid(
      `${source}.type_`,
      'Stock-class conversion right type must be STOCK_CLASS_CONVERSION_RIGHT',
      value.type_
    );
  }
  assertNoUnsupportedStockClassStorageFields(value, source);
  const convertsToFutureRound = optionalBoolean(value.converts_to_future_round, `${source}.converts_to_future_round`);
  const convertsToStockClassId = requireString(
    value.converts_to_stock_class_id,
    `${field}.converts_to_stock_class_id`
  );
  return {
    type: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismFromDaml(value.conversion_mechanism, `${field}.conversion_mechanism`),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
  };
}

function stockClassRightFromDaml(value: Record<string, unknown>, field: string): StockClassConversionRight {
  const rightType = requireString(value.type_, `${field}.type_`);
  if (rightType !== 'STOCK_CLASS_CONVERSION_RIGHT') {
    throw invalidFormat(
      `${field}.type_`,
      'Stock-class conversion right type must be STOCK_CLASS_CONVERSION_RIGHT',
      rightType
    );
  }
  assertInapplicableStockClassRightFields(value, field);
  const convertsToFutureRound = optionalBoolean(value.converts_to_future_round, `${field}.converts_to_future_round`);
  const convertsToStockClassId = requireString(value.converts_to_stock_class_id, `${field}.converts_to_stock_class_id`);
  return {
    type: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: ratioMechanismFromDaml(value, `${field}.conversion_mechanism`),
    converts_to_stock_class_id: convertsToStockClassId,
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
  };
}

type DecodedWarrantRight =
  | { kind: 'ordinary'; right: WarrantTriggerConversionRight }
  | {
      kind: 'stock-class';
      right: StockClassConversionRight;
      nestedTrigger: unknown;
      nestedTriggerField: string;
    };

function conversionRightFromDaml(value: unknown, field: string): DecodedWarrantRight {
  const variant = requireRecord(value, field);
  const tag = requireString(variant.tag, `${field}.tag`);
  const innerField = `${field}.value`;
  const inner = requireRecord(variant.value, innerField);
  switch (tag) {
    case 'OcfRightWarrant':
      return { kind: 'ordinary', right: warrantRightFromDaml(inner, innerField) };
    case 'OcfRightStockClass':
      return {
        kind: 'stock-class',
        right: stockClassRightFromDaml(inner, innerField),
        nestedTrigger: inner.conversion_trigger,
        nestedTriggerField: `${innerField}.conversion_trigger`,
      };
    case 'OcfRightConvertible':
      return { kind: 'ordinary', right: convertibleRightFromDaml(inner, innerField) };
    default:
      throw new OcpParseError(`Unknown warrant conversion right tag: ${tag}`, {
        source: `${field}.tag`,
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
  const source = `${outerSource}.conversion_right.value.conversion_trigger`;
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
  const source = `warrantIssuance.exercise_triggers[${index}]`;
  const trigger = requireRecord(value, source);
  assertDamlConversionTriggerFieldNames(trigger, source);
  const typePath = `${source}.type_`;
  const type = mapDamlTriggerTypeToOcf(requireString(trigger.type_, typePath), typePath);
  const triggerFields = triggerFieldsFromDaml(trigger, type, source);
  const decodedRight = conversionRightFromDaml(trigger.conversion_right, `${source}.conversion_right`);
  const parsed = parseConversionTriggerFields(
    {
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
    assertStockClassStorageTrigger(
      decodedRight.nestedTrigger,
      decodedRight.nestedTriggerField,
      decodedRight.right.converts_to_stock_class_id,
      trigger
    );
  }
  return parsed;
}

function quantitySourceFromDaml(value: unknown): QuantitySourceType | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw invalidType(
      'warrantIssuance.quantity_source',
      'quantity_source must be a DAML quantity source constructor',
      'string',
      value
    );
  }
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
      throw new OcpParseError(`Unknown quantity_source: ${describeDiagnosticValue(value)}`, {
        source: 'warrantIssuance.quantity_source',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function vestingsFromDaml(value: unknown): NonEmptyArray<VestingSimple> | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalid('warrantIssuance.vestings', 'vestings must be an array', value);
  const vestings = value.map((item, index) => {
    const vesting = requireRecord(item, `warrantIssuance.vestings[${index}]`);
    return {
      date: damlTimeToDateString(vesting.date, `warrantIssuance.vestings[${index}].date`),
      amount: parseDamlNumeric10(vesting.amount, `warrantIssuance.vestings[${index}].amount`),
    };
  });
}

function securityLawExemptionsFromDaml(value: unknown): Array<{ description: string; jurisdiction: string }> {
  if (!Array.isArray(value)) {
    throw invalid('warrantIssuance.security_law_exemptions', 'security_law_exemptions must be an array', value);
  }
  return value.map((item, index) => {
    const exemption = requireRecord(item, `warrantIssuance.security_law_exemptions[${index}]`);
    return {
      description: requireString(
        exemption.description,
        `warrantIssuance.security_law_exemptions[${index}].description`
      ),
      jurisdiction: requireString(
        exemption.jurisdiction,
        `warrantIssuance.security_law_exemptions[${index}].jurisdiction`
      ),
    };
  });
}

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw invalid('warrantIssuance.comments', 'comments must be an array of strings', value);
  }
  const comments = value.map((comment, index) => requireString(comment, `warrantIssuance.comments[${index}]`));
  return comments.length > 0 ? comments : undefined;
}

/** Convert decoded DAML WarrantIssuance data to its canonical OCF shape. */
export function damlWarrantIssuanceDataToNative(value: DamlWarrantIssuanceData): OcfWarrantIssuance {
  const data = decodeDamlEntityData('warrantIssuance', value);
  const exerciseTriggers = data.exercise_triggers;
  if (!Array.isArray(exerciseTriggers)) {
    throw invalid('warrantIssuance.exercise_triggers', 'exercise_triggers must be an array', exerciseTriggers);
  }
  const quantity = data.quantity === null ? undefined : parseDamlNumeric10(data.quantity, 'warrantIssuance.quantity');
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

  const result: OcfWarrantIssuance = {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: requireString(data.id, 'warrantIssuance.id'),
    date: requiredDate(data.date, 'warrantIssuance.date'),
    security_id: requireString(data.security_id, 'warrantIssuance.security_id'),
    custom_id: requireString(data.custom_id, 'warrantIssuance.custom_id'),
    stakeholder_id: requireString(data.stakeholder_id, 'warrantIssuance.stakeholder_id'),
    purchase_price: monetaryFromDaml(data.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: nativeExerciseTriggers,
    security_law_exemptions: securityLawExemptionsFromDaml(data.security_law_exemptions),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(quantitySource !== undefined ? { quantity_source: quantitySource } : {}),
    ...(exercisePrice ? { exercise_price: exercisePrice } : {}),
    ...(expirationDate !== undefined ? { warrant_expiration_date: expirationDate } : {}),
    ...(vestingTermsId !== undefined ? { vesting_terms_id: vestingTermsId } : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };
  return result;
}

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantIssuance,
  });
  const data = extractAndDecodeDamlEntityData('warrantIssuance', createArgument);
  const native = damlWarrantIssuanceDataToNative(data);
  return { warrantIssuance: native, contractId: params.contractId };
}
