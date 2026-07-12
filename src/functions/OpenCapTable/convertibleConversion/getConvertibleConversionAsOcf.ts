import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { DeepReadonly, GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleConversion } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleConversionToNative } from './damlToOcf';

/** Canonical OCF ConvertibleConversion returned by the dedicated ledger reader. */
export type OcfConvertibleConversionEvent = DeepReadonly<OcfConvertibleConversion>;

export type GetConvertibleConversionAsOcfParams = GetByContractIdParams;

export interface GetConvertibleConversionAsOcfResult {
  readonly event: OcfConvertibleConversionEvent;
  readonly contractId: string;
}

/** Read and validate a ConvertibleConversion contract as canonical OCF. */
export async function getConvertibleConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionAsOcfParams
): Promise<GetConvertibleConversionAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleConversionAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleConversion,
  });
  const data = extractAndDecodeDamlEntityData('convertibleConversion', createArgument);
  const event = damlConvertibleConversionToNative(data);
  return Object.freeze({ event, contractId: params.contractId });
}
