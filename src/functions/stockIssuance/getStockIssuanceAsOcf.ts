import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcfStockIssuanceData } from '../../types/native';
import { damlStockIssuanceDataToNative } from '../../utils/typeConversions';

export interface GetStockIssuanceAsOcfParams {
  contractId: string;
}

export interface GetStockIssuanceAsOcfResult {
  contractId: string;
  stockIssuance: (OcfStockIssuanceData & { object_type: 'TX_STOCK_ISSUANCE'; id?: string });
}

export async function getStockIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockIssuanceAsOcfParams
): Promise<GetStockIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) {
    throw new Error('Missing createArgument for StockIssuance');
  }
  const arg = created.createArgument as Fairmint.OpenCapTable.StockIssuance.StockIssuance;
  const native = damlStockIssuanceDataToNative((arg as any).issuance_data);
  const {
    id,
    share_numbers_issued,
    vestings,
    comments,
    issuance_type,
    ...rest
  } = native as any;
  const ocf = {
    object_type: 'TX_STOCK_ISSUANCE' as const,
    id,
    ...rest,
    ...(Array.isArray(share_numbers_issued) && share_numbers_issued.length > 0
      ? { share_numbers_issued }
      : {}),
    ...(Array.isArray((rest as any).stock_legend_ids) && (rest as any).stock_legend_ids.length > 0
      ? { stock_legend_ids: (rest as any).stock_legend_ids }
      : {}),
    ...(Array.isArray((rest as any).security_law_exemptions) && (rest as any).security_law_exemptions.length > 0
      ? { security_law_exemptions: (rest as any).security_law_exemptions }
      : {}),
    ...(Array.isArray(comments) && comments.length > 0 ? { comments } : {}),
    ...(Array.isArray(vestings) && vestings.length > 0 ? { vestings } : {}),
    ...(issuance_type ? { issuance_type } : {})
  };
  return { contractId: params.contractId, stockIssuance: ocf };
}


