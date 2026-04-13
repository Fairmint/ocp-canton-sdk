import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfWarrantExercise } from '../../../types/native';
import { isRecord } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';
import { damlWarrantExerciseToNative } from './damlToOcf';

/**
 * OCF Warrant Exercise Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/WarrantExercise.schema.json
 */
export interface OcfWarrantExerciseEvent extends OcfWarrantExercise {
  object_type: 'TX_WARRANT_EXERCISE';
}

export type GetWarrantExerciseAsOcfParams = GetByContractIdParams;

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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantExerciseAsOcf',
  });

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
  };

  return { event, contractId: params.contractId };
}
