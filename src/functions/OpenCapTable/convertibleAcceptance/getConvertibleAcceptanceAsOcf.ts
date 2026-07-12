import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfConvertibleAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleAcceptanceToNative } from './convertibleAcceptanceDataToDaml';

/**
 * OCF Convertible Acceptance event with object_type discriminator.
 */
export type OcfConvertibleAcceptanceEvent = OcfConvertibleAcceptance;

export type GetConvertibleAcceptanceAsOcfParams = GetByContractIdParams;

export interface GetConvertibleAcceptanceAsOcfResult {
  event: OcfConvertibleAcceptanceEvent;
  contractId: string;
}

/**
 * Retrieve a Convertible Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted convertible acceptance event
 */
export async function getConvertibleAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleAcceptanceAsOcfParams
): Promise<GetConvertibleAcceptanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleAcceptanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleAcceptance,
  });
  const data = extractAndDecodeDamlEntityData('convertibleAcceptance', createArgument);
  const event = damlConvertibleAcceptanceToNative(data as Parameters<typeof damlConvertibleAcceptanceToNative>[0]);

  return { event, contractId: params.contractId };
}
