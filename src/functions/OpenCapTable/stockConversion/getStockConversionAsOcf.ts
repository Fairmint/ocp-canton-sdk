import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockConversion } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockConversionToNative } from './damlToOcf';

/** Canonical OCF StockConversion returned by the dedicated ledger reader. */
export type OcfStockConversionEvent = OcfStockConversion;

export type GetStockConversionAsOcfParams = GetByContractIdParams;

export interface GetStockConversionAsOcfResult {
  event: OcfStockConversionEvent;
  contractId: string;
}

/** Read a StockConversion contract and return its canonical OCF object. */
export async function getStockConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockConversionAsOcfParams
): Promise<GetStockConversionAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockConversionAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockConversion,
  });
  const data = extractAndDecodeDamlEntityData('stockConversion', createArgument);
  const event = damlStockConversionToNative(data);
  return { event, contractId: params.contractId };
}
