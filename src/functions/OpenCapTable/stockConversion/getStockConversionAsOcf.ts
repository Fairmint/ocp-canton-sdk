import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockConversion } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockConversionToNative } from './damlToOcf';

/**
 * OCF Stock Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/StockConversion.schema.json
 */
export type OcfStockConversionEvent = OcfStockConversion;

export type GetStockConversionAsOcfParams = GetByContractIdParams;

export interface GetStockConversionAsOcfResult {
  event: OcfStockConversionEvent;
  contractId: string;
}

/**
 * Read a StockConversion contract and return a generic OCF StockConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/StockConversion.schema.json
 */
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
