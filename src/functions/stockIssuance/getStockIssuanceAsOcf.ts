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
  const { ocf_id, ...rest } = native as any;
  const ocf = {
    object_type: 'TX_STOCK_ISSUANCE' as const,
    id: ocf_id,
    ...rest
  };
  return { contractId: params.contractId, stockIssuance: ocf };
}


