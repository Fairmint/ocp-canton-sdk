/** Ledger reader for StakeholderStatusChangeEvent contracts. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderStatusChangeEventOutput } from '../../../types/output';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStakeholderStatusChangeEventToNative } from './damlToOcf';

/** Parameters for getting a stakeholder status change event as OCF. */
export type GetStakeholderStatusChangeEventAsOcfParams = GetByContractIdParams;

/** Exact result returned by the status-event ledger reader. */
export interface GetStakeholderStatusChangeEventAsOcfResult {
  readonly event: OcfStakeholderStatusChangeEventOutput;
  readonly contractId: string;
}

/** Read, validate, and convert one status-event contract. */
export async function getStakeholderStatusChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderStatusChangeEventAsOcfParams
): Promise<GetStakeholderStatusChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderStatusChangeEventAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent,
  });
  const data = extractAndDecodeDamlEntityData('stakeholderStatusChangeEvent', createArgument);
  return Object.freeze({
    event: damlStakeholderStatusChangeEventToNative(
      data as Parameters<typeof damlStakeholderStatusChangeEventToNative>[0]
    ),
    contractId: params.contractId,
  });
}
