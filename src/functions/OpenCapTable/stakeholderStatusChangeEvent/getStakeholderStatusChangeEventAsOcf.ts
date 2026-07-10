/**
 * DAML to OCF converter for StakeholderStatusChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStakeholderStatusChangeEventToNative } from './damlToOcf';

/** Parameters for getting a stakeholder status change event as OCF */
export type GetStakeholderStatusChangeEventAsOcfParams = GetByContractIdParams;

/** Result of getting a stakeholder status change event as OCF */
export interface GetStakeholderStatusChangeEventAsOcfResult {
  /** The OCF-formatted stakeholder status change event */
  event: OcfStakeholderStatusChangeEvent;
  /** The contract ID */
  contractId: string;
}

/**
 * Read a StakeholderStatusChangeEvent contract from the ledger and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient for ledger access
 * @param params - Parameters including the contract ID
 * @returns The OCF-formatted event and contract ID
 */
export async function getStakeholderStatusChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderStatusChangeEventAsOcfParams
): Promise<GetStakeholderStatusChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderStatusChangeEventAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent,
  });
  const data = extractAndDecodeDamlEntityData('stakeholderStatusChangeEvent', createArgument);
  const event = damlStakeholderStatusChangeEventToNative(data);
  return { event, contractId: params.contractId };
}
