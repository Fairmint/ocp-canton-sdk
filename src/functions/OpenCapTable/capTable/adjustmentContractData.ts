import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { findLosslessCodecMismatch } from './damlCodecLosslessness';

export type AdministrativeAdjustmentEntityType = Extract<
  OcfEntityType,
  'issuerAuthorizedSharesAdjustment' | 'stockClassAuthorizedSharesAdjustment' | 'stockPlanPoolAdjustment'
>;

export function isAdministrativeAdjustmentEntityType(
  entityType: OcfEntityType
): entityType is AdministrativeAdjustmentEntityType {
  return (
    entityType === 'issuerAuthorizedSharesAdjustment' ||
    entityType === 'stockClassAuthorizedSharesAdjustment' ||
    entityType === 'stockPlanPoolAdjustment'
  );
}

interface AdministrativeAdjustmentCreateArgumentMap {
  issuerAuthorizedSharesAdjustment: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment;
  stockClassAuthorizedSharesAdjustment: Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment;
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface AdministrativeAdjustmentCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  readonly encode: (value: T) => unknown;
}

type AdministrativeAdjustmentCreateArgumentCodecMap = {
  readonly [EntityType in AdministrativeAdjustmentEntityType]: AdministrativeAdjustmentCreateArgumentCodec<
    AdministrativeAdjustmentCreateArgumentMap[EntityType]
  >;
};

const ADMINISTRATIVE_ADJUSTMENT_CREATE_ARGUMENT_CODEC_MAP: AdministrativeAdjustmentCreateArgumentCodecMap = {
  issuerAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment,
  stockClassAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment,
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment,
};

type AdministrativeAdjustmentDataFor<EntityType extends AdministrativeAdjustmentEntityType> =
  AdministrativeAdjustmentCreateArgumentMap[EntityType]['adjustment_data'];

const REQUIRED_ADJUSTMENT_DATA_FIELDS: Readonly<Record<AdministrativeAdjustmentEntityType, readonly string[]>> = {
  issuerAuthorizedSharesAdjustment: ['id', 'date', 'issuer_id', 'new_shares_authorized', 'comments'],
  stockClassAuthorizedSharesAdjustment: ['id', 'date', 'stock_class_id', 'new_shares_authorized', 'comments'],
  stockPlanPoolAdjustment: ['id', 'date', 'stock_plan_id', 'shares_reserved', 'comments'],
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

function adjustmentDecodeError(
  entityType: AdministrativeAdjustmentEntityType,
  decoderPath: string,
  decoderMessage: string
): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlAdministrativeAdjustmentCreateArgument.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
    },
  });
}

function requireOwnFields(
  entityType: AdministrativeAdjustmentEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw adjustmentDecodeError(entityType, decoderPath, `the key '${field}' is required as an own property`);
    }
  }
}

function validateDenseOwnList(
  entityType: AdministrativeAdjustmentEntityType,
  value: unknown,
  decoderPath: string
): void {
  if (!Array.isArray(value)) return;

  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwnField(value, String(index))) {
      throw adjustmentDecodeError(
        entityType,
        `${decoderPath}[${index}]`,
        'list element is missing or inherited rather than an own property'
      );
    }
  }
}

function validateAdministrativeAdjustmentOwnProperties(
  entityType: AdministrativeAdjustmentEntityType,
  createArgument: unknown
): void {
  if (!isRecord(createArgument)) return;

  requireOwnFields(entityType, createArgument, ['context', 'adjustment_data'], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');

  const adjustmentData = ownField(createArgument, 'adjustment_data');
  if (!isRecord(adjustmentData)) return;

  requireOwnFields(entityType, adjustmentData, REQUIRED_ADJUSTMENT_DATA_FIELDS[entityType], 'input.adjustment_data');
  validateDenseOwnList(entityType, ownField(adjustmentData, 'comments'), 'input.adjustment_data.comments');
}

/** Decode and losslessly validate the full generated adjustment contract wrapper. */
export function extractAndDecodeAdministrativeAdjustmentData<
  const EntityType extends AdministrativeAdjustmentEntityType,
>(entityType: EntityType, createArgument: unknown): AdministrativeAdjustmentDataFor<EntityType> {
  validateAdministrativeAdjustmentOwnProperties(entityType, createArgument);
  const codec: AdministrativeAdjustmentCreateArgumentCodec<AdministrativeAdjustmentCreateArgumentMap[EntityType]> =
    ADMINISTRATIVE_ADJUSTMENT_CREATE_ARGUMENT_CODEC_MAP[entityType];
  const decoded = codec.decoder.run(createArgument);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw adjustmentDecodeError(entityType, decoderPath, decoderMessage);
  }

  const mismatch = findLosslessCodecMismatch(createArgument, codec.encode(decoded.result));
  if (mismatch) throw adjustmentDecodeError(entityType, mismatch.decoderPath, mismatch.decoderMessage);

  return decoded.result.adjustment_data;
}
