import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
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
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeLosslessGeneratedDamlValue } from '../capTable/damlCodecLosslessness';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import {
  convertibleMechanismFromDaml,
  ratioMechanismFromDaml,
  warrantMechanismFromDaml,
} from '../shared/conversionMechanisms';
import { parseDamlNumeric10 } from '../shared/damlNumerics';
import { requireDecimalString, requireMonetary } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';
import {
  assertInapplicableStockClassRightFields,
  assertStockClassStorageTrigger,
} from '../shared/stockClassRightStorage';
import { triggerFieldsFromDaml } from '../shared/triggerFields';

export type DamlWarrantIssuanceData = DamlDataTypeFor<'warrantIssuance'>;

export interface GetWarrantIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetWarrantIssuanceAsOcfResult {
  event: OcfWarrantIssuance;
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
    throw new OcpValidationError(field, `${field} is required and must be a string`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw invalidType(field, `${field} must be a string`, 'string', value);
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
  if (typeof value !== 'string') throw invalidType(field, `${field} must be a string`, 'string', value);
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw invalidType(field, `${field} must be a string`, 'string', value);
  return value;
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
  return requireMonetary(value, field);
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

function convertibleRightFromDaml(value: Record<string, unknown>, field: string): ConvertibleConversionRight {
  const rightType = requireString(value.type_, `${field}.type_`);
  if (rightType !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw invalidFormat(
      `${field}.type_`,
      'Convertible conversion right type must be CONVERTIBLE_CONVERSION_RIGHT',
      rightType
    );
  }
  const convertsToFutureRound = optionalBoolean(value.converts_to_future_round, `${field}.converts_to_future_round`);
  const convertsToStockClassId = optionalString(
    value.converts_to_stock_class_id,
    `${field}.converts_to_stock_class_id`
  );
  return {
    type: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: convertibleMechanismFromDaml(value.conversion_mechanism, `${field}.conversion_mechanism`),
    ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    ...(convertsToStockClassId !== undefined ? { converts_to_stock_class_id: convertsToStockClassId } : {}),
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
      throw new OcpParseError(`Unknown quantity_source: ${value}`, {
        source: 'warrantIssuance.quantity_source',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function vestingsFromDaml(value: unknown): NonEmptyArray<VestingSimple> | undefined {
  if (value === undefined) return undefined;
  assertSafeGeneratedDamlJson(value, 'warrantIssuance.vestings');
  return nonEmptyArrayOrUndefined(value, 'warrantIssuance.vestings', (item, { index }) => {
    const field = `warrantIssuance.vestings[${index}]`;
    if (!isRecord(item)) {
      throw invalidType(field, `${field} must be an object`, 'object', item);
    }
    const date = requiredDate(item.date, `${field}.date`);
    const normalizedAmount = parseDamlNumeric10(item.amount, `${field}.amount`);
    return {
      date,
      amount: normalizedAmount,
    };
  });
}

function securityLawExemptionsFromDaml(value: unknown): Array<{ description: string; jurisdiction: string }> {
  return requireArray(value, 'warrantIssuance.security_law_exemptions').map((item, index) => {
    const exemption = requireRecord(item, `warrantIssuance.security_law_exemptions[${index}]`);
    return {
      description: requireText(exemption.description, `warrantIssuance.security_law_exemptions[${index}].description`),
      jurisdiction: requireText(
        exemption.jurisdiction,
        `warrantIssuance.security_law_exemptions[${index}].jurisdiction`
      ),
    };
  });
}

function commentsFromDaml(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw invalidType('warrantIssuance.comments', 'comments must be an array of strings', 'string[]', value);
  }
  return value.length > 0 ? value : undefined;
}

/** Convert decoded DAML WarrantIssuance data to its canonical OCF shape. */
export function damlWarrantIssuanceDataToNative(value: DamlWarrantIssuanceData): OcfWarrantIssuance {
  const data = decodeDamlEntityData('warrantIssuance', value);
  const exerciseTriggers = requireArray(data.exercise_triggers, 'warrantIssuance.exercise_triggers');
  const nativeExerciseTriggers = exerciseTriggers.map(triggerFromDaml);
  assertUniqueConversionTriggerIds(
    nativeExerciseTriggers,
    'warrantIssuance.exercise_triggers',
    OcpErrorCodes.SCHEMA_MISMATCH
  );
  const quantity = data.quantity === null ? undefined : requireDecimalString(data.quantity, 'warrantIssuance.quantity');
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

  const native: OcfWarrantIssuance = {
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
    ...(quantitySource ? { quantity_source: quantitySource } : {}),
    ...(exercisePrice ? { exercise_price: exercisePrice } : {}),
    ...(expirationDate !== undefined ? { warrant_expiration_date: expirationDate } : {}),
    ...(vestingTermsId !== undefined ? { vesting_terms_id: vestingTermsId } : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };

  decodeLosslessGeneratedDamlValue(Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData, value, {
    rootPath: 'warrantIssuance',
    description: 'warrantIssuance',
    decodeSource: 'getWarrantIssuanceAsOcf',
    allowUndefinedOptional: true,
    allowNullishEmptyArray: true,
    context: {
      entityType: 'warrantIssuance',
      expectedTemplateId: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
    },
  });
  return native;
}

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantIssuance,
  });
  const native = damlWarrantIssuanceDataToNative(extractAndDecodeDamlEntityData('warrantIssuance', createArgument));
  return { event: native, contractId };
}
