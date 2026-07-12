import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationTransferOutput } from '../../../types/output';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlEquityCompensationTransferToNative } from './damlToOcf';

/**
 * OCF Equity Compensation Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/EquityCompensationTransfer.schema.json
 */
export type OcfEquityCompensationTransferEvent = OcfEquityCompensationTransferOutput;

export type GetEquityCompensationTransferAsOcfParams = GetByContractIdParams;

export interface GetEquityCompensationTransferAsOcfResult {
  readonly event: OcfEquityCompensationTransferEvent;
  readonly contractId: string;
}

export async function getEquityCompensationTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationTransferAsOcfParams
): Promise<GetEquityCompensationTransferAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationTransferAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationTransfer,
  });
  const data = extractAndDecodeDamlEntityData('equityCompensationTransfer', createArgument);
  const event = damlEquityCompensationTransferToNative(data);
  return Object.freeze({ event, contractId });
}
