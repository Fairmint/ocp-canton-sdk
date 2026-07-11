import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';

type CancellationEntityType = Extract<
  OcfEntityType,
  'convertibleCancellation' | 'equityCompensationCancellation' | 'stockCancellation' | 'warrantCancellation'
>;

export function isCancellationEntityType(entityType: OcfEntityType): entityType is CancellationEntityType {
  return (
    entityType === 'convertibleCancellation' ||
    entityType === 'equityCompensationCancellation' ||
    entityType === 'stockCancellation' ||
    entityType === 'warrantCancellation'
  );
}

interface CancellationCreateArgumentMap {
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation;
  equityCompensationCancellation: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation;
  stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation;
  warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface CancellationCreateArgumentDecoder<T> {
  run(input: unknown): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
}

type CancellationCreateArgumentDecoderMap = {
  readonly [EntityType in CancellationEntityType]: CancellationCreateArgumentDecoder<
    CancellationCreateArgumentMap[EntityType]
  >;
};

/** Generated template decoders correlated with each supported cancellation family. */
const CANCELLATION_CREATE_ARGUMENT_DECODER_MAP = {
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.decoder,
  equityCompensationCancellation:
    Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.decoder,
  stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.decoder,
  warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.decoder,
} as const satisfies CancellationCreateArgumentDecoderMap;

type CancellationDataFor<EntityType extends CancellationEntityType> =
  CancellationCreateArgumentMap[EntityType]['cancellation_data'];

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

function cancellationDecodeError(
  entityType: CancellationEntityType,
  decoderPath: string,
  decoderMessage: string,
  diagnostics: Record<string, unknown> = {}
): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlCancellationCreateArgument.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
      ...diagnostics,
    },
  });
}

function requireOwnFields(
  entityType: CancellationEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw cancellationDecodeError(entityType, decoderPath, `the key '${field}' is required as an own property`);
    }
  }
}

function validateCancellationOwnProperties(entityType: CancellationEntityType, createArgument: unknown): void {
  if (!isRecord(createArgument)) return;

  requireOwnFields(entityType, createArgument, ['context', 'cancellation_data'], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) {
    requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');
  }

  const cancellationData = ownField(createArgument, 'cancellation_data');
  if (!isRecord(cancellationData)) return;

  const numericField = entityType === 'convertibleCancellation' ? 'amount' : 'quantity';
  requireOwnFields(
    entityType,
    cancellationData,
    ['id', numericField, 'date', 'reason_text', 'security_id', 'comments'],
    'input.cancellation_data'
  );

  if (entityType === 'convertibleCancellation') {
    const amount = ownField(cancellationData, 'amount');
    if (isRecord(amount)) {
      requireOwnFields(entityType, amount, ['amount', 'currency'], 'input.cancellation_data.amount');
    }
  }

  const comments = ownField(cancellationData, 'comments');
  if (Array.isArray(comments)) {
    for (let index = 0; index < comments.length; index++) {
      if (!hasOwnField(comments, String(index))) {
        throw cancellationDecodeError(
          entityType,
          `input.cancellation_data.comments[${index}]`,
          'list element is missing or inherited rather than an own property'
        );
      }
    }
  }

  if (!hasOwnField(cancellationData, 'balance_security_id')) {
    if ('balance_security_id' in cancellationData) {
      throw cancellationDecodeError(
        entityType,
        'input.cancellation_data.balance_security_id',
        "optional key 'balance_security_id' is inherited rather than an own property"
      );
    }
    return;
  }

  const balanceSecurityId = ownField(cancellationData, 'balance_security_id');
  if (balanceSecurityId === null || balanceSecurityId === undefined || typeof balanceSecurityId === 'string') return;

  const actualType = receivedType(balanceSecurityId);
  throw cancellationDecodeError(
    entityType,
    'input.cancellation_data.balance_security_id',
    `expected a string, null, or undefined, got ${actualType}`,
    {
      fieldPath: `${entityType}.balance_security_id`,
      expectedType: 'string | null | undefined',
      receivedType: actualType,
    }
  );
}

/** Decode the full generated contract wrapper and return its recursively decoded cancellation payload. */
export function extractAndDecodeCancellationData<const EntityType extends CancellationEntityType>(
  entityType: EntityType,
  createArgument: unknown
): CancellationDataFor<EntityType>;
export function extractAndDecodeCancellationData(
  entityType: CancellationEntityType,
  createArgument: unknown
): CancellationDataFor<CancellationEntityType> {
  validateCancellationOwnProperties(entityType, createArgument);
  const decoded = CANCELLATION_CREATE_ARGUMENT_DECODER_MAP[entityType].run(createArgument);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw cancellationDecodeError(entityType, decoderPath, decoderMessage);
  }

  return decoded.result.cancellation_data;
}
