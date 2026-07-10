import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockIssuance, SecurityExemption, ShareNumberRange, StockIssuanceType } from '../../../types/native';
import {
  damlMonetaryToNative,
  damlTimeToDateString,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function damlSecurityExemptionToNative(e: Fairmint.OpenCapTable.Types.Stock.OcfSecurityExemption): SecurityExemption {
  return { description: e.description, jurisdiction: e.jurisdiction };
}

function damlShareNumberRangeToNative(r: Fairmint.OpenCapTable.Types.Stock.OcfShareNumberRange): ShareNumberRange {
  return {
    starting_share_number: r.starting_share_number,
    ending_share_number: r.ending_share_number,
  };
}

function damlStockIssuanceTypeToNative(t: string | null): StockIssuanceType | undefined {
  if (t === null) return undefined;
  switch (t) {
    case 'OcfStockIssuanceRSA':
      return 'RSA';
    case 'OcfStockIssuanceFounders':
      return 'FOUNDERS_STOCK';
    default:
      throw new OcpParseError(`Unknown DAML stock issuance type: ${t}`, {
        source: 'stockIssuance.issuance_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

export function damlStockIssuanceDataToNative(
  d: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData
): OcfStockIssuance {
  const anyD = d as unknown as Record<string, unknown>;
  const { id } = anyD;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stockIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  const vestings = Array.isArray((anyD as { vestings?: unknown }).vestings)
    ? (anyD as { vestings: Array<{ date: string; amount: string }> }).vestings.map((vesting) => ({
        date: damlTimeToDateString(vesting.date, 'stockIssuance.vestings[].date'),
        amount: normalizeNumericString(vesting.amount),
      }))
    : [];

  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'stockIssuance.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'stockIssuance.stockholder_approval_date'
  );

  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id,
    date: damlTimeToDateString(d.date, 'stockIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    security_law_exemptions: (Array.isArray((anyD as { security_law_exemptions?: unknown }).security_law_exemptions)
      ? (anyD as { security_law_exemptions: Fairmint.OpenCapTable.Types.Stock.OcfSecurityExemption[] })
          .security_law_exemptions
      : []
    ).map(damlSecurityExemptionToNative),
    stock_class_id: d.stock_class_id,
    ...(d.stock_plan_id && { stock_plan_id: d.stock_plan_id }),
    share_numbers_issued: Array.isArray((anyD as { share_numbers_issued?: unknown }).share_numbers_issued)
      ? (
          anyD as { share_numbers_issued: Fairmint.OpenCapTable.Types.Stock.OcfShareNumberRange[] }
        ).share_numbers_issued.map(damlShareNumberRangeToNative)
      : [],
    share_price: damlMonetaryToNative(d.share_price),
    quantity: normalizeNumericString(d.quantity),
    ...(d.vesting_terms_id && { vesting_terms_id: d.vesting_terms_id }),
    ...(vestings.length > 0 ? { vestings } : {}),
    ...(d.cost_basis && { cost_basis: damlMonetaryToNative(d.cost_basis) }),
    stock_legend_ids: Array.isArray((d as unknown as { stock_legend_ids?: unknown }).stock_legend_ids)
      ? (d as unknown as { stock_legend_ids: string[] }).stock_legend_ids
      : [],
    ...((anyD as { issuance_type?: unknown }).issuance_type != null && {
      issuance_type: damlStockIssuanceTypeToNative(
        (anyD as { issuance_type?: unknown }).issuance_type as string | null
      ),
    }),
    comments:
      (anyD as { comments?: unknown }).comments !== undefined &&
      Array.isArray((anyD as { comments?: unknown }).comments)
        ? (anyD as { comments: string[] }).comments
        : [],
  };
}

export interface GetStockIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetStockIssuanceAsOcfResult {
  contractId: string;
  stockIssuance: OcfStockIssuance;
}

/**
 * Read a stock issuance contract and convert DAML issuance data to OCF `TX_STOCK_ISSUANCE`.
 *
 * @param client - Ledger JSON API client
 * @param params - Stock issuance contract id
 * @returns Typed issuance object and contract id
 * @throws OcpParseError when payload or enums cannot be mapped
 */
export async function getStockIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockIssuanceAsOcfParams
): Promise<GetStockIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockIssuanceAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
  });
  const arg = createArgument as Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance;
  const argWithData = arg as unknown as {
    issuance_data?: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;
  };
  if (!argWithData.issuance_data) {
    throw new OcpParseError('Missing issuance_data in StockIssuance', {
      source: 'StockIssuance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const native = damlStockIssuanceDataToNative(argWithData.issuance_data);
  const { share_numbers_issued, vestings, comments, issuance_type, ...rest } = native;

  const ocf = {
    ...rest,
    ...(share_numbers_issued && share_numbers_issued.length > 0 ? { share_numbers_issued } : {}),
    ...(vestings && vestings.length > 0 ? { vestings } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
    ...(issuance_type ? { issuance_type } : {}),
  };
  return { contractId: params.contractId, stockIssuance: ocf };
}
