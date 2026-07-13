import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleCancellation } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleCancellationToNative } from './damlToOcf';

/**
 * OCF Convertible Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/ConvertibleCancellation.schema.json
 *
 * Note: Convertible cancellations don't have a quantity field since convertibles are monetary instruments (SAFEs,
 * convertible notes) rather than share-based securities.
 */
export type OcfConvertibleCancellationEvent = OcfConvertibleCancellation;

export type GetConvertibleCancellationAsOcfParams = GetByContractIdParams;

export interface GetConvertibleCancellationAsOcfResult {
  event: OcfConvertibleCancellationEvent;
  contractId: string;
}

/** Type alias for DAML ConvertibleCancellation contract createArgument */
type ConvertibleCancellationCreateArgument = Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation;

/**
 * Get a convertible cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The convertible cancellation event in OCF format
 */
export async function getConvertibleCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleCancellationAsOcfParams
): Promise<GetConvertibleCancellationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleCancellationAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
  });
  const contract = createArgument as ConvertibleCancellationCreateArgument;
  const data = contract.cancellation_data;

  const event = damlConvertibleCancellationToNative({
    id: data.id,
    date: data.date,
    security_id: data.security_id,
    amount: data.amount,
    ...(data.balance_security_id ? { balance_security_id: data.balance_security_id } : {}),
    reason_text: data.reason_text,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  });
  return { event, contractId: params.contractId };
}
