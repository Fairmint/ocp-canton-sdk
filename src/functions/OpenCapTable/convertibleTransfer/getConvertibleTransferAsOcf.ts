import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleTransferOutput } from '../../../types/output';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleTransferToNative } from './damlToOcf';

/**
 * OCF Convertible Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/ConvertibleTransfer.schema.json
 */
export type OcfConvertibleTransferEvent = OcfConvertibleTransferOutput;

export type GetConvertibleTransferAsOcfParams = GetByContractIdParams;

export interface GetConvertibleTransferAsOcfResult {
  readonly event: OcfConvertibleTransferEvent;
  readonly contractId: string;
}

export async function getConvertibleTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleTransferAsOcfParams
): Promise<GetConvertibleTransferAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleTransferAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleTransfer,
  });
  const data = extractAndDecodeDamlEntityData('convertibleTransfer', createArgument);
  const event = damlConvertibleTransferToNative(data as Parameters<typeof damlConvertibleTransferToNative>[0]);
  return Object.freeze({ event, contractId });
}
