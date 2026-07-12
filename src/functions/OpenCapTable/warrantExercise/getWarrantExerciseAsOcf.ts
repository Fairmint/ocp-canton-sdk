import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { DeepReadonly, GetByContractIdParams } from '../../../types/common';
import type { OcfWarrantExercise } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlWarrantExerciseToNative } from './damlToOcf';

/**
 * OCF Warrant Exercise Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/WarrantExercise.schema.json
 */
export type OcfWarrantExerciseEvent = DeepReadonly<OcfWarrantExercise>;

export type GetWarrantExerciseAsOcfParams = GetByContractIdParams;

export interface GetWarrantExerciseAsOcfResult {
  readonly event: OcfWarrantExerciseEvent;
  readonly contractId: string;
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
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantExercise,
  });
  const data = extractAndDecodeDamlEntityData('warrantExercise', createArgument);
  const native = damlWarrantExerciseToNative(data);
  return Object.freeze({ event: native, contractId: params.contractId });
}
