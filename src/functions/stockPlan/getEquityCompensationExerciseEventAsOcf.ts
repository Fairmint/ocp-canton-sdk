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

  const quantity = createArgument.quantity;
  const planSecurityCid = createArgument.plan_security;
  const dateIso: string = createArgument.date;

  const ocf: OcfEquityCompensationExercise = {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: params.contractId,
    quantity,
    security_id: planSecurityCid,
    date: dateIso,
  };

  return { event: ocf, contractId: params.contractId };
}
