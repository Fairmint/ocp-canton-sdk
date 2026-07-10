import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor, type OcfEntityType } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractEntityData } from '../capTable/damlEntityData';

type CancellationEntityType = Extract<
  OcfEntityType,
  'convertibleCancellation' | 'equityCompensationCancellation' | 'stockCancellation' | 'warrantCancellation'
>;

/**
 * Decode one cancellation payload after validating Optional fields that the generated
 * DAML decoder otherwise defaults to `null` when a present value has the wrong type.
 */
export function extractAndDecodeCancellationData<const EntityType extends CancellationEntityType>(
  entityType: EntityType,
  createArgument: unknown
): DamlDataTypeFor<EntityType> {
  const data = extractEntityData(entityType, createArgument);
  const balanceSecurityId = data.balance_security_id;

  if (balanceSecurityId !== null && balanceSecurityId !== undefined && typeof balanceSecurityId !== 'string') {
    const decoderPath = 'input.balance_security_id';
    const fieldPath = `${entityType}.balance_security_id`;
    const actualType = typeof balanceSecurityId;
    const decoderMessage = `expected a string, null, or undefined, got ${actualType}`;

    throw new OcpParseError(`Invalid DAML data for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
      source: `damlEntityData.${entityType}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
        decoderPath,
        decoderMessage,
        fieldPath,
        expectedType: 'string | null | undefined',
        receivedType: actualType,
      },
    });
  }

  return decodeDamlEntityData(entityType, data);
}
