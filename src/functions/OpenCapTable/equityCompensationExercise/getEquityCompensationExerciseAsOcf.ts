import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { DeepReadonly, GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationExercise } from '../../../types/native';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import {
  freezeConversionExerciseEvent,
  generatedOptionalConversionExerciseText,
  requireGeneratedConversionExerciseComments,
  requireGeneratedConversionExerciseText,
  requireGeneratedEquityExerciseResultIds,
} from '../shared/conversionExerciseReadValues';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import { readSingleContract } from '../shared/singleContractRead';

export type DamlEquityCompensationExerciseData = DamlDataTypeFor<'equityCompensationExercise'>;

/** Convert generated DAML EquityCompensationExercise data to native OCF. */
export function damlEquityCompensationExerciseDataToNative(
  input: DamlEquityCompensationExerciseData
): DeepReadonly<OcfEquityCompensationExercise> {
  const data = decodeDamlEntityData('equityCompensationExercise', input);
  const considerationText = generatedOptionalConversionExerciseText(
    data.consideration_text,
    'equityCompensationExercise.consideration_text'
  );
  const comments = requireGeneratedConversionExerciseComments(data.comments, 'equityCompensationExercise.comments');
  return freezeConversionExerciseEvent({
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: requireGeneratedConversionExerciseText(data.id, 'equityCompensationExercise.id'),
    date: damlTimeToDateString(data.date, 'equityCompensationExercise.date'),
    security_id: requireGeneratedConversionExerciseText(data.security_id, 'equityCompensationExercise.security_id'),
    quantity: requireGeneratedDamlNumeric10(data.quantity, 'equityCompensationExercise.quantity'),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    resulting_security_ids: requireGeneratedEquityExerciseResultIds(
      data.resulting_security_ids,
      'equityCompensationExercise.resulting_security_ids'
    ),
    ...(comments.length > 0 ? { comments } : {}),
  });
}

export interface GetEquityCompensationExerciseAsOcfParams extends GetByContractIdParams {}

export interface GetEquityCompensationExerciseAsOcfResult {
  readonly event: DeepReadonly<OcfEquityCompensationExercise>;
  readonly contractId: string;
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
  return Object.freeze({ event: native, contractId: params.contractId });
}
