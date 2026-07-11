import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { findLosslessCodecMismatch } from './damlCodecLosslessness';

type AcceptanceEntityType = Extract<
  OcfEntityType,
  'convertibleAcceptance' | 'equityCompensationAcceptance' | 'stockAcceptance' | 'warrantAcceptance'
>;

export function isAcceptanceEntityType(entityType: OcfEntityType): entityType is AcceptanceEntityType {
  return (
    entityType === 'convertibleAcceptance' ||
    entityType === 'equityCompensationAcceptance' ||
    entityType === 'stockAcceptance' ||
    entityType === 'warrantAcceptance'
  );
}

interface AcceptanceCreateArgumentMap {
  convertibleAcceptance: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance;
  equityCompensationAcceptance: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance;
  stockAcceptance: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance;
  warrantAcceptance: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface AcceptanceCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  readonly encode: (value: T) => unknown;
}

type AcceptanceCreateArgumentCodecMap = {
  readonly [EntityType in AcceptanceEntityType]: AcceptanceCreateArgumentCodec<AcceptanceCreateArgumentMap[EntityType]>;
};

/** Generated template codecs correlated with each supported acceptance family. */
const ACCEPTANCE_CREATE_ARGUMENT_CODEC_MAP: AcceptanceCreateArgumentCodecMap = {
  convertibleAcceptance: Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptance,
  equityCompensationAcceptance: Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptance,
  stockAcceptance: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance,
  warrantAcceptance: Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptance,
};

type AcceptanceDataFor<EntityType extends AcceptanceEntityType> =
  AcceptanceCreateArgumentMap[EntityType]['acceptance_data'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function ownField(record: Record<string, unknown>, field: string): unknown {
  return hasOwnField(record, field) ? record[field] : undefined;
}

function acceptanceDecodeError(
  entityType: AcceptanceEntityType,
  decoderPath: string,
  decoderMessage: string
): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlAcceptanceCreateArgument.${entityType}`,
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
  entityType: AcceptanceEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw acceptanceDecodeError(entityType, decoderPath, `the key '${field}' is required as an own property`);
    }
  }
}

function validateAcceptanceOwnProperties(entityType: AcceptanceEntityType, createArgument: unknown): void {
  if (!isRecord(createArgument)) return;

  requireOwnFields(entityType, createArgument, ['context', 'acceptance_data'], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) {
    requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');
  }

  const acceptanceData = ownField(createArgument, 'acceptance_data');
  if (!isRecord(acceptanceData)) return;

  requireOwnFields(entityType, acceptanceData, ['id', 'date', 'security_id', 'comments'], 'input.acceptance_data');

  const comments = ownField(acceptanceData, 'comments');
  if (!Array.isArray(comments)) return;

  for (let index = 0; index < comments.length; index++) {
    if (!hasOwnField(comments, String(index))) {
      throw acceptanceDecodeError(
        entityType,
        `input.acceptance_data.comments[${index}]`,
        'list element is missing or inherited rather than an own property'
      );
    }
  }
}

/** Decode the full generated contract wrapper and return its recursively decoded acceptance payload. */
export function extractAndDecodeAcceptanceData<const EntityType extends AcceptanceEntityType>(
  entityType: EntityType,
  createArgument: unknown
): AcceptanceDataFor<EntityType> {
  validateAcceptanceOwnProperties(entityType, createArgument);
  const codec: AcceptanceCreateArgumentCodec<AcceptanceCreateArgumentMap[EntityType]> =
    ACCEPTANCE_CREATE_ARGUMENT_CODEC_MAP[entityType];
  const decoded = codec.decoder.run(createArgument);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw acceptanceDecodeError(entityType, decoderPath, decoderMessage);
  }

  const mismatch = findLosslessCodecMismatch(createArgument, codec.encode(decoded.result));
  if (mismatch) {
    throw acceptanceDecodeError(entityType, mismatch.decoderPath, mismatch.decoderMessage);
  }

  return decoded.result.acceptance_data;
}
