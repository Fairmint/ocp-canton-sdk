import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfEquityCompensationAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlEquityCompensationAcceptanceToNative } from './equityCompensationAcceptanceDataToDaml';

/**
 * OCF Equity Compensation Acceptance event with object_type discriminator.
 */
export type OcfEquityCompensationAcceptanceEvent = OcfEquityCompensationAcceptance;

export type GetEquityCompensationAcceptanceAsOcfParams = GetByContractIdParams;

export interface GetEquityCompensationAcceptanceAsOcfResult {
  event: OcfEquityCompensationAcceptanceEvent;
  contractId: string;
}

/**
 * Retrieve an Equity Compensation Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted equity compensation acceptance event
 */
export async function getEquityCompensationAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationAcceptanceAsOcfParams
): Promise<GetEquityCompensationAcceptanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationAcceptanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationAcceptance,
  });
  const data = extractAndDecodeDamlEntityData('equityCompensationAcceptance', createArgument);
  const event = damlEquityCompensationAcceptanceToNative(data);

  return { event, contractId: params.contractId };
}
