/** Ledger reader for StakeholderRelationshipChangeEvent contracts. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderRelationshipChangeEventOutput } from '../../../types/output';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStakeholderRelationshipChangeEventToNative } from './damlToOcf';

/** Parameters for getting a stakeholder relationship change event as OCF. */
export type GetStakeholderRelationshipChangeEventAsOcfParams = GetByContractIdParams;

/** Exact result returned by the relationship-event ledger reader. */
export interface GetStakeholderRelationshipChangeEventAsOcfResult {
  readonly event: OcfStakeholderRelationshipChangeEventOutput;
  readonly contractId: string;
}

/** Read, validate, and convert one relationship-event contract. */
export async function getStakeholderRelationshipChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderRelationshipChangeEventAsOcfParams
): Promise<GetStakeholderRelationshipChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderRelationshipChangeEventAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent,
  });
  const data = extractAndDecodeDamlEntityData('stakeholderRelationshipChangeEvent', createArgument);
  return Object.freeze({
    event: damlStakeholderRelationshipChangeEventToNative(data),
    contractId: params.contractId,
  });
}
