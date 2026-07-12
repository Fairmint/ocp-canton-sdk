import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfValuation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlValuationToNative } from './damlToOcf';

export interface GetValuationAsOcfParams extends GetByContractIdParams {}

export interface GetValuationAsOcfResult {
  valuation: OcfValuation;
  contractId: string;
}

/**
 * Retrieve a valuation contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The valuation data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Valuation.schema.json
 */
export async function getValuationAsOcf(
  client: LedgerJsonApiClient,
  params: GetValuationAsOcfParams
): Promise<GetValuationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getValuationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.valuation,
  });

  const valuationData = extractAndDecodeDamlEntityData('valuation', createArgument);
  const native = damlValuationToNative(valuationData as Parameters<typeof damlValuationToNative>[0]);
  return {
    valuation: native,
    contractId: params.contractId,
  };
}
