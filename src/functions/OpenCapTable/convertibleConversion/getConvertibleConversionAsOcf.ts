import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfConvertibleConversion } from '../../../types/native';
import type { DamlConvertibleConversionData } from './damlToOcf';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type DamlConvertibleConversionInput = Pick<DamlConvertibleConversionData, 'id' | 'date' | 'security_id'> & {
  resulting_security_ids?: string[] | null;
  balance_security_id?: string | null;
  trigger_id?: string | null;
  comments?: string[] | null;
};

function isDamlConvertibleConversionData(value: unknown): value is DamlConvertibleConversionInput {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.security_id === 'string' &&
    (value.resulting_security_ids === undefined ||
      value.resulting_security_ids === null ||
      (Array.isArray(value.resulting_security_ids) &&
        value.resulting_security_ids.every((id) => typeof id === 'string'))) &&
    (value.balance_security_id === undefined ||
      value.balance_security_id === null ||
      typeof value.balance_security_id === 'string') &&
    (value.trigger_id === undefined || value.trigger_id === null || typeof value.trigger_id === 'string') &&
    (value.comments === undefined ||
      value.comments === null ||
      (Array.isArray(value.comments) && value.comments.every((comment) => typeof comment === 'string')))
  );
}

/**
 * OCF Convertible Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export interface OcfConvertibleConversionEvent extends OcfConvertibleConversion {
  object_type: 'TX_CONVERTIBLE_CONVERSION';
}

export interface GetConvertibleConversionAsOcfParams {
  contractId: string;
}

export interface GetConvertibleConversionAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

/**
 * Read a ConvertibleConversion contract and return a generic OCF ConvertibleConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export async function getConvertibleConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionAsOcfParams
): Promise<GetConvertibleConversionAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  const conversionData = createArgument.conversion_data;
  if (!isDamlConvertibleConversionData(conversionData)) {
    throw new OcpContractError('ConvertibleConversion data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = conversionData;

  // Validate resulting_security_ids
  if (!d.resulting_security_ids || d.resulting_security_ids.length === 0) {
    throw new OcpValidationError(
      'convertibleConversion.resulting_security_ids',
      'Required field must be a non-empty array',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: d.resulting_security_ids,
      }
    );
  }

  const event: OcfConvertibleConversionEvent = {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.trigger_id ? { trigger_id: d.trigger_id } : {}),
    ...(d.comments && d.comments.length ? { comments: d.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
