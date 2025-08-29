import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfConvertibleConversionEvent {
  object_type: 'CONVERTIBLE_CONVERSION';
  id?: string;
  convertible: string;
  stakeholder: string;
  stock_class: string;
  quantity: string;
  date: string;
}

export interface GetConvertibleConversionEventAsOcfParams {
  contractId: string;
}

export interface GetConvertibleConversionEventAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

export async function getConvertibleConversionEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionEventAsOcfParams
): Promise<GetConvertibleConversionEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  const ocf: OcfConvertibleConversionEvent = {
    object_type: 'CONVERTIBLE_CONVERSION',
    id: params.contractId,
    convertible: createArgument.convertible,
    stakeholder: createArgument.stakeholder,
    stock_class: createArgument.stock_class,
    quantity: createArgument.quantity,
    date: (createArgument.date as string).split('T')[0]
  };

  return { event: ocf, contractId: params.contractId };
}
