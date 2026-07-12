import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleConversion } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleConversionToNative, type DamlConvertibleConversionData } from './damlToOcf';

/** Canonical OCF ConvertibleConversion returned by the dedicated ledger reader. */
export type OcfConvertibleConversionEvent = OcfConvertibleConversion;

export type GetConvertibleConversionAsOcfParams = GetByContractIdParams;

export interface GetConvertibleConversionAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

/** Read and validate a ConvertibleConversion contract as canonical OCF. */
export async function getConvertibleConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionAsOcfParams
): Promise<GetConvertibleConversionAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleConversionAsOcf',
  });

  if (!Object.prototype.hasOwnProperty.call(createArgument, 'conversion_data')) {
    throw new OcpContractError('ConvertibleConversion data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const event = damlConvertibleConversionToNative(createArgument.conversion_data as DamlConvertibleConversionData);
  return { event, contractId: params.contractId };
}
