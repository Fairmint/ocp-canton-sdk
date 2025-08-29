import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfWarrantExerciseEvent {
  object_type: 'WARRANT_EXERCISE';
  id?: string;
  warrant: string;
  stakeholder: string;
  stock_class: string;
  quantity: string;
  date: string;
}

export interface GetWarrantExerciseEventAsOcfParams {
  contractId: string;
}

export interface GetWarrantExerciseEventAsOcfResult {
  event: OcfWarrantExerciseEvent;
  contractId: string;
}

export async function getWarrantExerciseEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantExerciseEventAsOcfParams
): Promise<GetWarrantExerciseEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  const ocf: OcfWarrantExerciseEvent = {
    object_type: 'WARRANT_EXERCISE',
    id: params.contractId,
    warrant: createArgument.warrant,
    stakeholder: createArgument.stakeholder,
    stock_class: createArgument.stock_class,
    quantity: createArgument.quantity,
    date: (createArgument.date as string).split('T')[0]
  };

  return { event: ocf, contractId: params.contractId };
}
