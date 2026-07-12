import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationExercise } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import { readSingleContract } from '../shared/singleContractRead';

export type DamlEquityCompensationExerciseData = DamlDataTypeFor<'equityCompensationExercise'>;

/** Convert generated DAML EquityCompensationExercise data to native OCF. */
export function damlEquityCompensationExerciseDataToNative(
  input: DamlEquityCompensationExerciseData
): OcfEquityCompensationExercise {
  const data = decodeDamlEntityData('equityCompensationExercise', input);
  const considerationText = data.consideration_text ?? undefined;
  return {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: data.id,
    date: damlTimeToDateString(data.date, 'equityCompensationExercise.date'),
    security_id: data.security_id,
    quantity: requireGeneratedDamlNumeric10(data.quantity, 'equityCompensationExercise.quantity'),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    resulting_security_ids: data.resulting_security_ids,
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}

export interface GetEquityCompensationExerciseAsOcfParams extends GetByContractIdParams {}

export interface GetEquityCompensationExerciseAsOcfResult {
  event: OcfEquityCompensationExercise;
  contractId: string;
}

/** Read an EquityCompensationExercise contract and return its canonical OCF object. */
export async function getEquityCompensationExerciseAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationExerciseAsOcfParams
): Promise<GetEquityCompensationExerciseAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationExerciseAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationExercise,
  });
  const data = extractAndDecodeDamlEntityData('equityCompensationExercise', createArgument);
  const native = damlEquityCompensationExerciseDataToNative(data);
  return { event: native, contractId: params.contractId };
}
