import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfConvertibleConversion } from '../../../types/native';

/**
 * OCF Convertible Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export interface OcfConvertibleConversionEvent extends OcfConvertibleConversion {
  object_type: 'TX_CONVERTIBLE_CONVERSION';
}

export interface GetConvertibleConversionEventAsOcfParams {
  contractId: string;
}

export interface GetConvertibleConversionEventAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

/**
 * Read a ConvertibleConversion contract and return a generic OCF ConvertibleConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export async function getConvertibleConversionEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionEventAsOcfParams
): Promise<GetConvertibleConversionEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  // ConvertibleConversion contracts store data under conversion_data key
  const d: Record<string, unknown> =
    (createArgument.conversion_data as Record<string, unknown> | undefined) ?? createArgument;

  // Validate resulting_security_ids
  if (!Array.isArray(d.resulting_security_ids) || d.resulting_security_ids.length === 0) {
    throw new Error('Convertible conversion resulting_security_ids is required');
  }

  const event: OcfConvertibleConversionEvent = {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: d.id as string,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id as string,
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id as string } : {}),
    ...(d.trigger_id ? { trigger_id: d.trigger_id as string } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };

  return { event, contractId: params.contractId };
}
