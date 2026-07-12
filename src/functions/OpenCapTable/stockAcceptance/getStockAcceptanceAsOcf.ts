import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfStockAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockAcceptanceToNative } from './stockAcceptanceDataToDaml';

/**
 * OCF Stock Acceptance event with object_type discriminator.
 */
export type OcfStockAcceptanceEvent = OcfStockAcceptance;

export type GetStockAcceptanceAsOcfParams = GetByContractIdParams;

export interface GetStockAcceptanceAsOcfResult {
  event: OcfStockAcceptanceEvent;
  contractId: string;
}

/**
 * Retrieve a Stock Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted stock acceptance event
 */
export async function getStockAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockAcceptanceAsOcfParams
): Promise<GetStockAcceptanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockAcceptanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockAcceptance,
  });
  const data = extractAndDecodeDamlEntityData('stockAcceptance', createArgument);
  const event = damlStockAcceptanceToNative(data);

  return { event, contractId: params.contractId };
}
