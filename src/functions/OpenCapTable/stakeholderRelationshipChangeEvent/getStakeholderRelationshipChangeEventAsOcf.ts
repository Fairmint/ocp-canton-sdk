/**
 * DAML to OCF converter for StakeholderRelationshipChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStakeholderRelationshipChangeEventToNative } from './damlToOcf';

/** Parameters for getting a stakeholder relationship change event as OCF */
export type GetStakeholderRelationshipChangeEventAsOcfParams = GetByContractIdParams;

/** Result of getting a stakeholder relationship change event as OCF */
export interface GetStakeholderRelationshipChangeEventAsOcfResult {
  /** The OCF-formatted stakeholder relationship change event */
  event: OcfStakeholderRelationshipChangeEvent;
  /** The contract ID */
  contractId: string;
}

/**
 * Read a StakeholderRelationshipChangeEvent contract from the ledger and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient for ledger access
 * @param params - Parameters including the contract ID
 * @returns The OCF-formatted event and contract ID
 */
export async function getStakeholderRelationshipChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderRelationshipChangeEventAsOcfParams
): Promise<GetStakeholderRelationshipChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderRelationshipChangeEventAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent,
  });
  const data = extractAndDecodeDamlEntityData('stakeholderRelationshipChangeEvent', createArgument);
  const event = damlStakeholderRelationshipChangeEventToNative(data);
  return { event, contractId: params.contractId };
}
