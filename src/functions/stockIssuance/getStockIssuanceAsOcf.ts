import { damlTimeToDateString, damlMonetaryToNative } from '../../utils/typeConversions';
import type {
  OcfStockIssuanceData,
  SecurityExemption,
  ShareNumberRange,
  StockIssuanceType,
} from '../../types/native';
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

function damlSecurityExemptionToNative(
  e: Fairmint.OpenCapTable.Types.OcfSecurityExemption
): SecurityExemption {
  return { description: e.description, jurisdiction: e.jurisdiction };
}

function damlShareNumberRangeToNative(
  r: Fairmint.OpenCapTable.Types.OcfShareNumberRange
): ShareNumberRange {
  return {
    starting_share_number: r.starting_share_number,
    ending_share_number: r.ending_share_number,
  };
}

function damlStockIssuanceTypeToNative(t: any): StockIssuanceType | undefined {
  switch (t) {
    case 'OcfStockIssuanceRSA':
      return 'RSA';
    case 'OcfStockIssuanceFounders':
      return 'FOUNDERS_STOCK';
    default:
      return undefined;
  }
}

function damlStockIssuanceDataToNative(
  d: Fairmint.OpenCapTable.StockIssuance.OcfStockIssuanceData
): OcfStockIssuanceData {
  const anyD = d as unknown as { [k: string]: unknown };
  return {
    id: (d as any).id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    ...(d.board_approval_date && {
      board_approval_date: damlTimeToDateString(d.board_approval_date),
    }),
    ...(d.stockholder_approval_date && {
      stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date),
    }),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    security_law_exemptions: (Array.isArray(
      (anyD as { security_law_exemptions?: unknown }).security_law_exemptions
    )
      ? (anyD as { security_law_exemptions: Fairmint.OpenCapTable.Types.OcfSecurityExemption[] })
          .security_law_exemptions
      : []
    ).map(damlSecurityExemptionToNative),
    stock_class_id: d.stock_class_id,
    ...(d.stock_plan_id && { stock_plan_id: d.stock_plan_id }),
    share_numbers_issued: Array.isArray(
      (anyD as { share_numbers_issued?: unknown }).share_numbers_issued
    )
      ? (
          anyD as { share_numbers_issued: Fairmint.OpenCapTable.Types.OcfShareNumberRange[] }
        ).share_numbers_issued.map(damlShareNumberRangeToNative)
      : [],
    share_price: damlMonetaryToNative(d.share_price),
    quantity: d.quantity,
    ...(d.vesting_terms_id && { vesting_terms_id: d.vesting_terms_id }),
    vestings: Array.isArray((anyD as { vestings?: unknown }).vestings)
      ? (anyD as { vestings: { date: string; amount: string }[] }).vestings.map((v) => ({
          date: damlTimeToDateString(v.date),
          amount: v.amount,
        }))
      : [],
    ...(d.cost_basis && { cost_basis: damlMonetaryToNative(d.cost_basis) }),
    stock_legend_ids: Array.isArray(
      (d as unknown as { stock_legend_ids?: unknown }).stock_legend_ids
    )
      ? (d as unknown as { stock_legend_ids: string[] }).stock_legend_ids
      : [],
    ...((anyD as { issuance_type?: unknown }).issuance_type !== undefined && {
      issuance_type: damlStockIssuanceTypeToNative(
        (anyD as { issuance_type?: unknown }).issuance_type
      ),
    }),
    comments:
      (anyD as { comments?: unknown }).comments !== undefined &&
      Array.isArray((anyD as { comments?: unknown }).comments)
        ? (anyD as { comments: string[] }).comments
        : [],
  };
}

export interface GetStockIssuanceAsOcfParams {
  contractId: string;
}

export interface GetStockIssuanceAsOcfResult {
  contractId: string;
  stockIssuance: OcfStockIssuanceData & { object_type: 'TX_STOCK_ISSUANCE'; id?: string };
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
  const { id, share_numbers_issued, vestings, comments, issuance_type, ...rest } = native as any;
  const ocf = {
    object_type: 'TX_STOCK_ISSUANCE' as const,
    id,
    ...rest,
    ...(share_numbers_issued.length > 0 ? { share_numbers_issued } : {}),
    ...(rest.stock_legend_ids.length > 0 ? { stock_legend_ids: rest.stock_legend_ids } : {}),
    security_law_exemptions: rest.security_law_exemptions,
    ...(comments.length > 0 ? { comments } : {}),
    ...(vestings.length > 0 ? { vestings } : {}),
    ...(issuance_type ? { issuance_type } : {}),
  };
  return { contractId: params.contractId, stockIssuance: ocf };
}
