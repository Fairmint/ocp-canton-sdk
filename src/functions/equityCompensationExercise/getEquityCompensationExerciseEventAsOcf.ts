import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfEquityCompensationExercise {
  object_type: 'TX_EQUITY_COMPENSATION_EXERCISE';
  id: string;
  quantity: string | number;
  security_id: string;
  date: string;
  // Optional fields from schema left undefined if not present on DAML event
  consideration_text?: string;
  resulting_security_ids?: string[];
  comments?: string[];
}

export interface GetEquityCompensationExerciseEventAsOcfParams {
  contractId: string; // ContractId of PlanSecurityExerciseEvent
}

export interface GetEquityCompensationExerciseEventAsOcfResult {
  event: OcfEquityCompensationExercise;
  contractId: string;
}

/**
 * Read a PlanSecurityExerciseEvent and return a generic OCF EquityCompensationExercise object.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/EquityCompensationExercise.schema.json
 */
export async function getEquityCompensationExerciseEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationExerciseEventAsOcfParams
): Promise<GetEquityCompensationExerciseEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  // Some events nest OCF data under a specific key; fall back to root for backward compatibility
  const d = createArgument.exercise_data || createArgument;

  const ocf: OcfEquityCompensationExercise = {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: (d as any).id,
    quantity: typeof d.quantity === 'number' ? String(d.quantity) : d.quantity,
    security_id: d.security_id,
    date: (d.date as string).split('T')[0],
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.resulting_security_ids) && d.resulting_security_ids.length ? { resulting_security_ids: d.resulting_security_ids } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };

  return { event: ocf, contractId: params.contractId };
}
