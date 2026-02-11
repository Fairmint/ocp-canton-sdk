import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfWarrantExercise } from '../../../types/native';
import { damlWarrantExerciseToNative } from './damlToOcf';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * OCF Warrant Exercise Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/WarrantExercise.schema.json
 */
export interface OcfWarrantExerciseEvent extends Omit<OcfWarrantExercise, 'quantity'> {
  object_type: 'TX_WARRANT_EXERCISE';
  /** Quantity as string for OCF JSON serialization */
  quantity: string;
}

export interface GetWarrantExerciseAsOcfParams {
  contractId: string;
}

export interface GetWarrantExerciseAsOcfResult {
  event: OcfWarrantExerciseEvent;
  contractId: string;
}

/**
 * Read a WarrantExercise contract and return a generic OCF WarrantExercise object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/WarrantExercise.schema.json
 */
export async function getWarrantExerciseAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantExerciseAsOcfParams
): Promise<GetWarrantExerciseAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;

  const exerciseData = createArgument.exercise_data;
  if (!isRecord(exerciseData)) {
    throw new OcpContractError('WarrantExercise data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const d = exerciseData;

  const native = damlWarrantExerciseToNative(d);
  // Add object_type to create the full event type
  // Note: quantity is typed as string | number in OcfWarrantExercise but normalizeNumericString always returns string
  const event: OcfWarrantExerciseEvent = {
    object_type: 'TX_WARRANT_EXERCISE',
    ...native,
    quantity: native.quantity,
  };

  return { event, contractId: params.contractId };
}
