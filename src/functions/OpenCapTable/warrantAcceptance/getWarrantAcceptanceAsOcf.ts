import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfWarrantAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlWarrantAcceptanceToNative } from './warrantAcceptanceDataToDaml';

/**
 * OCF Warrant Acceptance event with object_type discriminator.
 */
export type OcfWarrantAcceptanceEvent = OcfWarrantAcceptance;

export type GetWarrantAcceptanceAsOcfParams = GetByContractIdParams;

export interface GetWarrantAcceptanceAsOcfResult {
  event: OcfWarrantAcceptanceEvent;
  contractId: string;
}

/**
 * Retrieve a Warrant Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted warrant acceptance event
 */
export async function getWarrantAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantAcceptanceAsOcfParams
): Promise<GetWarrantAcceptanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantAcceptanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantAcceptance,
  });
  const data = extractAndDecodeDamlEntityData('warrantAcceptance', createArgument);
  const event = damlWarrantAcceptanceToNative(data as Parameters<typeof damlWarrantAcceptanceToNative>[0]);

  return { event, contractId: params.contractId };
}
