import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleConversion } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleConversionToNative } from './damlToOcf';

/**
 * OCF Convertible Conversion Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export interface OcfConvertibleConversionEvent extends OcfConvertibleConversion {
  object_type: 'TX_CONVERTIBLE_CONVERSION';
}

export type GetConvertibleConversionAsOcfParams = GetByContractIdParams;

export interface GetConvertibleConversionAsOcfResult {
  event: OcfConvertibleConversionEvent;
  contractId: string;
}

/**
 * Read a ConvertibleConversion contract and return a generic OCF ConvertibleConversion object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export async function getConvertibleConversionAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleConversionAsOcfParams
): Promise<GetConvertibleConversionAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleConversionAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleConversion,
  });
  const data = extractAndDecodeDamlEntityData('convertibleConversion', createArgument);
  const event = damlConvertibleConversionToNative(data);
  return { event, contractId: params.contractId };
}
