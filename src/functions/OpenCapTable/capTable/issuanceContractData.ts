import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import {
  assertPlainDataValue,
  deepFreezePlainDataValue,
  PlainDataValidationError,
} from '../shared/plainDataValidation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { findLosslessCodecMismatch, type ReadonlyGeneratedDaml } from './damlCodecLosslessness';

export type ComplexIssuanceEntityType = Extract<
  OcfEntityType,
  'convertibleIssuance' | 'equityCompensationIssuance' | 'stockIssuance' | 'warrantIssuance'
>;

export function isComplexIssuanceEntityType(entityType: OcfEntityType): entityType is ComplexIssuanceEntityType {
  return (
    entityType === 'convertibleIssuance' ||
    entityType === 'equityCompensationIssuance' ||
    entityType === 'stockIssuance' ||
    entityType === 'warrantIssuance'
  );
}

interface ComplexIssuanceCreateArgumentMap {
  convertibleIssuance: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance;
  equityCompensationIssuance: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance;
  stockIssuance: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance;
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface ComplexIssuanceCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  readonly encode: (value: T) => unknown;
}

type ComplexIssuanceCreateArgumentCodecMap = {
  readonly [EntityType in ComplexIssuanceEntityType]: ComplexIssuanceCreateArgumentCodec<
    ComplexIssuanceCreateArgumentMap[EntityType]
  >;
};

const COMPLEX_ISSUANCE_CREATE_ARGUMENT_CODEC_MAP: ComplexIssuanceCreateArgumentCodecMap = {
  convertibleIssuance: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance,
  equityCompensationIssuance: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance,
  stockIssuance: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance,
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance,
};

const MAX_ISSUANCE_NESTING_DEPTH = 128;
const MAX_ISSUANCE_VALUE_COUNT = 250_000;

export type ComplexIssuanceDataFor<EntityType extends ComplexIssuanceEntityType> =
  ComplexIssuanceCreateArgumentMap[EntityType]['issuance_data'];

const REQUIRED_ISSUANCE_DATA_FIELDS: Readonly<Record<ComplexIssuanceEntityType, readonly string[]>> = {
  convertibleIssuance: [
    'id',
    'convertible_type',
    'custom_id',
    'date',
    'investment_amount',
    'security_id',
    'seniority',
    'stakeholder_id',
    'comments',
    'conversion_triggers',
    'security_law_exemptions',
  ],
  equityCompensationIssuance: [
    'id',
    'custom_id',
    'date',
    'compensation_type',
    'quantity',
    'security_id',
    'stakeholder_id',
    'comments',
    'security_law_exemptions',
    'vestings',
    'termination_exercise_windows',
  ],
  stockIssuance: [
    'id',
    'custom_id',
    'date',
    'quantity',
    'security_id',
    'share_price',
    'stakeholder_id',
    'stock_class_id',
    'comments',
    'security_law_exemptions',
    'share_numbers_issued',
    'stock_legend_ids',
    'vestings',
  ],
  warrantIssuance: [
    'id',
    'custom_id',
    'date',
    'purchase_price',
    'security_id',
    'stakeholder_id',
    'comments',
    'exercise_triggers',
    'security_law_exemptions',
    'vestings',
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function ownField(record: Record<string, unknown>, field: string): unknown {
  return hasOwnField(record, field) ? record[field] : undefined;
}

function issuanceDecodeError(
  entityType: ComplexIssuanceEntityType,
  decoderPath: string,
  decoderMessage: string
): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlComplexIssuanceCreateArgument.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
    },
  });
}

function issuanceDataDecodeError(
  entityType: ComplexIssuanceEntityType,
  decoderPath: string,
  decoderMessage: string
): OcpParseError {
  return new OcpParseError(`Invalid DAML data for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlEntityData.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
    },
  });
}

function validatePlainIssuanceBoundary(
  entityType: ComplexIssuanceEntityType,
  value: unknown,
  decoderPath: string,
  boundary: 'data' | 'wrapper'
): void {
  try {
    assertPlainDataValue(value, decoderPath, {
      allowUndefinedObjectProperties: boundary === 'data',
      maxDepth: MAX_ISSUANCE_NESTING_DEPTH,
      maxValues: MAX_ISSUANCE_VALUE_COUNT,
    });
  } catch (error) {
    if (!(error instanceof PlainDataValidationError)) throw error;
    const path = error.issueKind === 'inherited' ? error.containerPath : error.fieldPath;
    if (boundary === 'data') {
      throw issuanceDataDecodeError(entityType, path, error.message);
    }
    throw issuanceDecodeError(entityType, path, error.message);
  }
}

/** Trap-free recursive preflight for a direct generated complex-issuance payload. */
export function validateComplexIssuanceDamlDataInput(entityType: ComplexIssuanceEntityType, value: unknown): void {
  validatePlainIssuanceBoundary(entityType, value, 'input', 'data');
  if (!isRecord(value)) return;
  for (const field of REQUIRED_ISSUANCE_DATA_FIELDS[entityType]) {
    if (!hasOwnField(value, field) || ownField(value, field) === undefined) {
      throw issuanceDataDecodeError(entityType, `input.${field}`, `the key '${field}' is required as an own property`);
    }
  }
}

/** Decode and losslessly validate one direct generated complex-issuance data payload. */
export function decodeComplexIssuanceDamlData<const EntityType extends ComplexIssuanceEntityType>(
  entityType: EntityType,
  input: unknown
): ReadonlyGeneratedDaml<ComplexIssuanceDataFor<EntityType>> {
  validateComplexIssuanceDamlDataInput(entityType, input);
  const codec: ComplexIssuanceCreateArgumentCodec<ComplexIssuanceCreateArgumentMap[EntityType]> =
    COMPLEX_ISSUANCE_CREATE_ARGUMENT_CODEC_MAP[entityType];
  const dataCodec = {
    decoder: {
      run(value: unknown) {
        const wrapper = codec.decoder.run({
          context: { issuer: '', system_operator: '' },
          issuance_data: value,
        });
        return wrapper.ok
          ? ({ ok: true, result: wrapper.result.issuance_data } as const)
          : ({
              ok: false,
              error: {
                at: wrapper.error.at.replace(/^input\.issuance_data/, 'input'),
                message: wrapper.error.message,
              },
            } as const);
      },
    },
    encode(value: ComplexIssuanceDataFor<EntityType>): unknown {
      const encoded = codec.encode({
        context: { issuer: '', system_operator: '' },
        issuance_data: value,
      } as ComplexIssuanceCreateArgumentMap[EntityType]);
      return isRecord(encoded) ? ownField(encoded, 'issuance_data') : undefined;
    },
  };
  let decoded: ReturnType<typeof dataCodec.decoder.run>;
  try {
    decoded = dataCodec.decoder.run(input);
  } catch (error) {
    throw issuanceDataDecodeError(entityType, 'input', `generated decoder failed: ${toSafeDiagnosticText(error)}`);
  }
  if (!decoded.ok) {
    throw issuanceDataDecodeError(entityType, decoded.error.at, decoded.error.message);
  }
  let encoded: unknown;
  try {
    encoded = dataCodec.encode(decoded.result);
  } catch (error) {
    throw issuanceDataDecodeError(entityType, 'input', `generated encoder failed: ${toSafeDiagnosticText(error)}`);
  }
  let mismatch: ReturnType<typeof findLosslessCodecMismatch>;
  try {
    mismatch = findLosslessCodecMismatch(input, encoded);
  } catch (error) {
    throw issuanceDataDecodeError(entityType, 'input', `lossless comparison failed: ${toSafeDiagnosticText(error)}`);
  }
  if (mismatch) throw issuanceDataDecodeError(entityType, mismatch.decoderPath, mismatch.decoderMessage);
  return deepFreezePlainDataValue(decoded.result) as ReadonlyGeneratedDaml<ComplexIssuanceDataFor<EntityType>>;
}

function requireOwnFields(
  entityType: ComplexIssuanceEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw issuanceDecodeError(entityType, decoderPath, `the key '${field}' is required as an own property`);
    }
  }
}

function validateDenseOwnList(entityType: ComplexIssuanceEntityType, value: unknown, decoderPath: string): void {
  if (!Array.isArray(value)) return;
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwnField(value, String(index))) {
      throw issuanceDecodeError(
        entityType,
        `${decoderPath}[${index}]`,
        'list element is missing or inherited rather than an own property'
      );
    }
  }
}

function validateRecordList(
  entityType: ComplexIssuanceEntityType,
  value: unknown,
  decoderPath: string,
  requiredFields: readonly string[]
): void {
  validateDenseOwnList(entityType, value, decoderPath);
  if (!Array.isArray(value)) return;
  for (let index = 0; index < value.length; index += 1) {
    const element = value[index];
    if (isRecord(element)) requireOwnFields(entityType, element, requiredFields, `${decoderPath}[${index}]`);
  }
}

function validateMonetary(entityType: ComplexIssuanceEntityType, value: unknown, decoderPath: string): void {
  if (isRecord(value)) requireOwnFields(entityType, value, ['amount', 'currency'], decoderPath);
}

function validateIssuanceOwnProperties(entityType: ComplexIssuanceEntityType, createArgument: unknown): void {
  if (!isRecord(createArgument)) return;

  requireOwnFields(entityType, createArgument, ['context', 'issuance_data'], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');

  const data = ownField(createArgument, 'issuance_data');
  if (!isRecord(data)) return;
  const dataPath = 'input.issuance_data';
  requireOwnFields(entityType, data, REQUIRED_ISSUANCE_DATA_FIELDS[entityType], dataPath);

  validateDenseOwnList(entityType, ownField(data, 'comments'), `${dataPath}.comments`);
  validateRecordList(entityType, ownField(data, 'security_law_exemptions'), `${dataPath}.security_law_exemptions`, [
    'description',
    'jurisdiction',
  ]);

  if (entityType === 'convertibleIssuance') {
    validateMonetary(entityType, ownField(data, 'investment_amount'), `${dataPath}.investment_amount`);
    validateRecordList(entityType, ownField(data, 'conversion_triggers'), `${dataPath}.conversion_triggers`, [
      'conversion_right',
      'trigger_id',
      'type_',
    ]);
    return;
  }

  if (entityType === 'equityCompensationIssuance') {
    validateMonetary(entityType, ownField(data, 'base_price'), `${dataPath}.base_price`);
    validateMonetary(entityType, ownField(data, 'exercise_price'), `${dataPath}.exercise_price`);
    validateRecordList(entityType, ownField(data, 'vestings'), `${dataPath}.vestings`, ['amount', 'date']);
    validateRecordList(
      entityType,
      ownField(data, 'termination_exercise_windows'),
      `${dataPath}.termination_exercise_windows`,
      ['period', 'period_type', 'reason']
    );
    return;
  }

  if (entityType === 'warrantIssuance') {
    validateMonetary(entityType, ownField(data, 'purchase_price'), `${dataPath}.purchase_price`);
    validateMonetary(entityType, ownField(data, 'exercise_price'), `${dataPath}.exercise_price`);
    validateRecordList(entityType, ownField(data, 'exercise_triggers'), `${dataPath}.exercise_triggers`, [
      'conversion_right',
      'trigger_id',
      'type_',
    ]);
    validateRecordList(entityType, ownField(data, 'vestings'), `${dataPath}.vestings`, ['amount', 'date']);
    return;
  }

  validateMonetary(entityType, ownField(data, 'share_price'), `${dataPath}.share_price`);
  validateMonetary(entityType, ownField(data, 'cost_basis'), `${dataPath}.cost_basis`);
  validateRecordList(entityType, ownField(data, 'share_numbers_issued'), `${dataPath}.share_numbers_issued`, [
    'ending_share_number',
    'starting_share_number',
  ]);
  validateDenseOwnList(entityType, ownField(data, 'stock_legend_ids'), `${dataPath}.stock_legend_ids`);
  validateRecordList(entityType, ownField(data, 'vestings'), `${dataPath}.vestings`, ['amount', 'date']);
}

/** Decode and losslessly validate a complete generated issuance contract wrapper. */
export function extractAndDecodeComplexIssuanceData<const EntityType extends ComplexIssuanceEntityType>(
  entityType: EntityType,
  createArgument: unknown
): ReadonlyGeneratedDaml<ComplexIssuanceDataFor<EntityType>> {
  validatePlainIssuanceBoundary(entityType, createArgument, 'input', 'wrapper');
  validateIssuanceOwnProperties(entityType, createArgument);
  const codec: ComplexIssuanceCreateArgumentCodec<ComplexIssuanceCreateArgumentMap[EntityType]> =
    COMPLEX_ISSUANCE_CREATE_ARGUMENT_CODEC_MAP[entityType];
  let decoded: ReturnType<typeof codec.decoder.run>;
  try {
    decoded = codec.decoder.run(createArgument);
  } catch (error) {
    throw issuanceDecodeError(entityType, 'input', `generated decoder failed: ${toSafeDiagnosticText(error)}`);
  }

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw issuanceDecodeError(entityType, decoderPath, decoderMessage);
  }

  let encoded: unknown;
  try {
    encoded = codec.encode(decoded.result);
  } catch (error) {
    throw issuanceDecodeError(entityType, 'input', `generated encoder failed: ${toSafeDiagnosticText(error)}`);
  }
  let mismatch: ReturnType<typeof findLosslessCodecMismatch>;
  try {
    mismatch = findLosslessCodecMismatch(createArgument, encoded);
  } catch (error) {
    throw issuanceDecodeError(entityType, 'input', `lossless comparison failed: ${toSafeDiagnosticText(error)}`);
  }
  if (mismatch) throw issuanceDecodeError(entityType, mismatch.decoderPath, mismatch.decoderMessage);

  return deepFreezePlainDataValue(decoded.result.issuance_data) as ReadonlyGeneratedDaml<
    ComplexIssuanceDataFor<EntityType>
  >;
}
