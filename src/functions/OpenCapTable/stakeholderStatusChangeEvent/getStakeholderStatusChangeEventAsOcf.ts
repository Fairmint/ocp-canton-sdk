/**
 * DAML to OCF converter for StakeholderStatusChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStakeholderStatusChangeEventToNative, type DamlStakeholderStatusChangeData } from './damlToOcf';

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
  });
  const data = extractGeneratedCreateArgumentData(createArgument, 'StakeholderStatusChangeEvent.createArgument', {
    dataField: 'event_data',
  });
  const event = damlStakeholderStatusChangeEventToNative(
    data as unknown as DamlStakeholderStatusChangeData,
    'StakeholderStatusChangeEvent.createArgument.event_data'
  );

  return { event, contractId: params.contractId };
}
