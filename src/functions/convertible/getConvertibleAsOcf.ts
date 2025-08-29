import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlConvertibleIssuanceToNative } from '../../utils/typeConversions';

export interface OcfConvertibleIssuance {
  object_type: 'CONVERTIBLE_ISSUANCE';
  id?: string;
  stakeholder: string;
  issuance_data: ReturnType<typeof damlConvertibleIssuanceToNative>;
}

export interface GetConvertibleAsOcfParams {
  contractId: string;
}

export interface GetConvertibleAsOcfResult {
  convertible: OcfConvertibleIssuance;
  contractId: string;
}

export async function getConvertibleAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleAsOcfParams
): Promise<GetConvertibleAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  const issuance = damlConvertibleIssuanceToNative(createArgument.issuance_data);

  const ocf: OcfConvertibleIssuance = {
    object_type: 'CONVERTIBLE_ISSUANCE',
    id: params.contractId,
    stakeholder: createArgument.stakeholder,
    issuance_data: issuance
  };

  return { convertible: ocf, contractId: params.contractId };
}
