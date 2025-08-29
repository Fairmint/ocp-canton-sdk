import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlWarrantIssuanceToNative } from '../../utils/typeConversions';

export interface OcfWarrantIssuance {
  object_type: 'WARRANT_ISSUANCE';
  id?: string;
  stakeholder: string;
  stock_class: string;
  issuance_data: ReturnType<typeof damlWarrantIssuanceToNative>;
}

export interface GetWarrantAsOcfParams {
  contractId: string;
}

export interface GetWarrantAsOcfResult {
  warrant: OcfWarrantIssuance;
  contractId: string;
}

export async function getWarrantAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantAsOcfParams
): Promise<GetWarrantAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  const issuance = damlWarrantIssuanceToNative(createArgument.issuance_data);

  const ocf: OcfWarrantIssuance = {
    object_type: 'WARRANT_ISSUANCE',
    id: params.contractId,
    stakeholder: createArgument.stakeholder,
    stock_class: createArgument.stock_class,
    issuance_data: issuance
  };

  return { warrant: ocf, contractId: params.contractId };
}
