import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfWarrantExercise } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

/**
 * OCF Warrant Exercise Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/WarrantExercise.schema.json
 */
export interface OcfWarrantExerciseEvent extends Omit<OcfWarrantExercise, 'quantity'> {
  object_type: 'TX_WARRANT_EXERCISE';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetWarrantExerciseEventAsOcfParams {
  contractId: string;
}

export interface GetWarrantExerciseEventAsOcfResult {
  event: OcfWarrantExerciseEvent;
  contractId: string;
}

/**
 * Read a WarrantExercise contract and return a generic OCF WarrantExercise object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/WarrantExercise.schema.json
 */
export async function getWarrantExerciseEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantExerciseEventAsOcfParams
): Promise<GetWarrantExerciseEventAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  // WarrantExercise contracts store data under exercise_data key
  const d: Record<string, unknown> =
    (createArgument.exercise_data as Record<string, unknown> | undefined) ?? createArgument;

  // Validate quantity
  if (d.quantity === undefined || d.quantity === null) {
    throw new Error('Warrant exercise quantity is required');
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new Error(`Warrant exercise quantity must be string or number, got ${typeof d.quantity}`);
  }

  // Validate resulting_security_ids
  if (!Array.isArray(d.resulting_security_ids) || d.resulting_security_ids.length === 0) {
    throw new Error('Warrant exercise resulting_security_ids is required');
  }

  const event: OcfWarrantExerciseEvent = {
    object_type: 'TX_WARRANT_EXERCISE',
    id: d.id as string,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id as string,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id as string } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text as string } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };

  return { event, contractId: params.contractId };
}
