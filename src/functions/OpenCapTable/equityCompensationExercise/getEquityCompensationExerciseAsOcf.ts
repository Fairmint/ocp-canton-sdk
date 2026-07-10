import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationExercise } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type DamlEquityCompensationExerciseData = DamlDataTypeFor<'equityCompensationExercise'>;

/**
 * Converts DAML EquityCompensationExercise data to native OCF format.
 * Used by the dispatcher pattern in damlToOcf.ts
 */
export function damlEquityCompensationExerciseDataToNative(
  d: DamlEquityCompensationExerciseData
): OcfEquityCompensationExercise {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'equityCompensationExercise.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    resulting_security_ids: d.resulting_security_ids,
    ...(d.comments.length ? { comments: d.comments } : {}),
  };
}

export interface GetEquityCompensationExerciseAsOcfParams extends GetByContractIdParams {}

export interface GetEquityCompensationExerciseAsOcfResult {
  event: OcfEquityCompensationExercise;
  contractId: string;
}

/**
 * Read an EquityCompensationExercise contract and return its canonical OCF object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/EquityCompensationExercise.schema.json
 */
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
