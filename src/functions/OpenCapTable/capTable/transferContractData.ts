import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import { assertPlainDataValue, PlainDataValidationError } from '../shared/plainDataValidation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { assertLosslessGeneratedDamlRoundTrip } from './damlCodecLosslessness';

export type TransferEntityType = Extract<
  OcfEntityType,
  'convertibleTransfer' | 'equityCompensationTransfer' | 'stockTransfer' | 'warrantTransfer'
>;

export function isTransferEntityType(entityType: OcfEntityType): entityType is TransferEntityType {
  return (
    entityType === 'convertibleTransfer' ||
    entityType === 'equityCompensationTransfer' ||
    entityType === 'stockTransfer' ||
    entityType === 'warrantTransfer'
  );
}

interface TransferCreateArgumentMap {
  convertibleTransfer: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer;
  equityCompensationTransfer: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer;
  stockTransfer: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer;
  warrantTransfer: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface TransferCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  readonly encode: (value: T) => unknown;
}

type TransferCreateArgumentCodecMap = {
  readonly [EntityType in TransferEntityType]: TransferCreateArgumentCodec<TransferCreateArgumentMap[EntityType]>;
};

/** Generated template codecs correlated with each supported transfer family. */
const TRANSFER_CREATE_ARGUMENT_CODEC_MAP: TransferCreateArgumentCodecMap = {
  convertibleTransfer: Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer,
  equityCompensationTransfer: Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer,
  stockTransfer: Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer,
  warrantTransfer: Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer,
};

type TransferDataFor<EntityType extends TransferEntityType> = TransferCreateArgumentMap[EntityType]['transfer_data'];

const REQUIRED_TRANSFER_DATA_FIELDS: Readonly<Record<TransferEntityType, readonly string[]>> = {
  convertibleTransfer: ['id', 'amount', 'date', 'security_id', 'comments', 'resulting_security_ids'],
  equityCompensationTransfer: ['id', 'quantity', 'date', 'security_id', 'comments', 'resulting_security_ids'],
  stockTransfer: ['id', 'quantity', 'date', 'security_id', 'comments', 'resulting_security_ids'],
  warrantTransfer: ['id', 'quantity', 'date', 'security_id', 'comments', 'resulting_security_ids'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function ownField(record: Record<string, unknown>, field: string): unknown {
  return hasOwnField(record, field) ? record[field] : undefined;
}

function receivedType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function transferDecodeError(
  entityType: TransferEntityType,
  decoderPath: string,
  decoderMessage: string,
  diagnostics: Record<string, unknown> = {}
): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlToOcf.${entityType}.createArgument`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
      ...diagnostics,
    },
  });
}

function transferDataDecodeError(
  entityType: TransferEntityType,
  decoderPath: string,
  decoderMessage: string
): OcpParseError {
  return new OcpParseError(`Invalid DAML data for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlToOcf.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_daml_data',
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
    },
  });
}

function plainIssuePath(error: PlainDataValidationError): string {
  if (error.issueKind !== 'inherited') return error.fieldPath;

  const inheritedIndex = /^(.*)\["(\d+)"\]$/.exec(error.fieldPath);
  if (inheritedIndex !== null) {
    return `${inheritedIndex[1]}[${inheritedIndex[2]}]`;
  }
  return error.fieldPath;
}

function validatePlainTransferBoundary(
  entityType: TransferEntityType,
  value: unknown,
  boundary: 'data' | 'wrapper'
): void {
  try {
    assertPlainDataValue(value, 'input', { allowUndefinedObjectProperties: true });
  } catch (error) {
    if (!(error instanceof PlainDataValidationError)) throw error;
    const decoderPath = plainIssuePath(error);
    if (boundary === 'data') {
      throw transferDataDecodeError(entityType, decoderPath, error.message);
    }
    throw transferDecodeError(entityType, decoderPath, error.message);
  }
}

/** Trap-free recursive preflight for a direct generated transfer payload. */
export function validateTransferDamlDataInput(entityType: TransferEntityType, value: unknown): void {
  validatePlainTransferBoundary(entityType, value, 'data');
  if (!isRecord(value)) return;

  for (const field of REQUIRED_TRANSFER_DATA_FIELDS[entityType]) {
    if (!hasOwnField(value, field) || ownField(value, field) === undefined) {
      throw transferDataDecodeError(entityType, `input.${field}`, `the key '${field}' is required as an own property`);
    }
  }
}

function requireOwnFields(
  entityType: TransferEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw transferDecodeError(
        entityType,
        `${decoderPath}.${field}`,
        `the key '${field}' is required as an own property`
      );
    }
  }
}

function validateDenseOwnList(entityType: TransferEntityType, value: unknown, decoderPath: string): void {
  if (!Array.isArray(value)) return;

  for (let index = 0; index < value.length; index++) {
    if (!hasOwnField(value, String(index))) {
      throw transferDecodeError(
        entityType,
        `${decoderPath}[${index}]`,
        'list element is missing or inherited rather than an own property'
      );
    }
  }
}

function validateOptionalString(
  entityType: TransferEntityType,
  transferData: Record<string, unknown>,
  field: 'balance_security_id' | 'consideration_text'
): void {
  const decoderPath = `input.transfer_data.${field}`;
  if (!hasOwnField(transferData, field)) {
    if (field in transferData) {
      throw transferDecodeError(
        entityType,
        decoderPath,
        `optional key '${field}' is inherited rather than an own property`
      );
    }
    return;
  }

  const value = ownField(transferData, field);
  if (value === null || typeof value === 'string') return;

  const actualType = receivedType(value);
  throw transferDecodeError(entityType, decoderPath, `expected a string or null, got ${actualType}`, {
    fieldPath: `${entityType}.${field}`,
    expectedType: 'string | null',
    receivedType: actualType,
  });
}

function validateTransferOwnProperties(entityType: TransferEntityType, createArgument: unknown): void {
  if (!isRecord(createArgument)) return;

  requireOwnFields(entityType, createArgument, ['context', 'transfer_data'], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) {
    requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');
  }

  const transferData = ownField(createArgument, 'transfer_data');
  if (!isRecord(transferData)) return;

  const numericField = entityType === 'convertibleTransfer' ? 'amount' : 'quantity';
  requireOwnFields(
    entityType,
    transferData,
    ['id', numericField, 'date', 'security_id', 'comments', 'resulting_security_ids'],
    'input.transfer_data'
  );

  if (entityType === 'convertibleTransfer') {
    const amount = ownField(transferData, 'amount');
    if (isRecord(amount)) {
      requireOwnFields(entityType, amount, ['amount', 'currency'], 'input.transfer_data.amount');
    }
  }

  validateDenseOwnList(entityType, ownField(transferData, 'comments'), 'input.transfer_data.comments');
  validateDenseOwnList(
    entityType,
    ownField(transferData, 'resulting_security_ids'),
    'input.transfer_data.resulting_security_ids'
  );
  validateOptionalString(entityType, transferData, 'balance_security_id');
  validateOptionalString(entityType, transferData, 'consideration_text');
}

/** Decode the full generated contract wrapper and return its recursively decoded transfer payload. */
export function extractAndDecodeTransferData<const EntityType extends TransferEntityType>(
  entityType: EntityType,
  createArgument: unknown
): TransferDataFor<EntityType> {
  validatePlainTransferBoundary(entityType, createArgument, 'wrapper');
  validateTransferOwnProperties(entityType, createArgument);
  const codec: TransferCreateArgumentCodec<TransferCreateArgumentMap[EntityType]> =
    TRANSFER_CREATE_ARGUMENT_CODEC_MAP[entityType];
  const decoded = codec.decoder.run(createArgument);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw transferDecodeError(entityType, decoderPath, decoderMessage);
  }

  let encoded: unknown;
  try {
    encoded = codec.encode(decoded.result);
  } catch (error) {
    throw transferDecodeError(entityType, 'input', `encode failed: ${toSafeDiagnosticText(error)}`, {
      phase: 'encode',
    });
  }
  const rootPath = `damlToOcf.${entityType}.createArgument`;
  assertLosslessGeneratedDamlRoundTrip(createArgument, encoded, {
    rootPath,
    description: `${entityType} create argument`,
    decodeSource: rootPath,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
    },
  });

  return decoded.result.transfer_data;
}
