import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleTransfer } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleTransferToNative } from './damlToOcf';

/**
 * OCF Convertible Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/ConvertibleTransfer.schema.json
 */
export type OcfConvertibleTransferEvent = OcfConvertibleTransfer;

export type GetConvertibleTransferAsOcfParams = GetByContractIdParams;

export interface GetConvertibleTransferAsOcfResult {
  event: OcfConvertibleTransferEvent;
  contractId: string;
}

export async function getConvertibleTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleTransferAsOcfParams
): Promise<GetConvertibleTransferAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleTransferAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleTransfer,
  });
  const data = extractAndDecodeDamlEntityData('convertibleTransfer', createArgument);
  const event = damlConvertibleTransferToNative(data);
  return { event, contractId: params.contractId };
}
