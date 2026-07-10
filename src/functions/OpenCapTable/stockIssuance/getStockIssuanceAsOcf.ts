import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockIssuance, SecurityExemption, ShareNumberRange, StockIssuanceType } from '../../../types/native';
import {
  damlMonetaryToNative,
  damlTimeToDateString,
  nonEmptyArrayOrUndefined,
  normalizeNumericString,
} from '../../../utils/typeConversions';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
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

function damlStockIssuanceTypeToNative(t: unknown): StockIssuanceType | undefined {
  if (t === null || t === undefined) return undefined;
  switch (t) {
    case 'OcfStockIssuanceRSA':
      return 'RSA';
    case 'OcfStockIssuanceFounders':
      return 'FOUNDERS_STOCK';
    default: {
      const detail = typeof t === 'string' ? `: ${t}` : '';
      throw new OcpParseError(`Unknown DAML stock issuance type${detail}`, {
        source: 'stockIssuance.issuance_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: t },
      });
    }
  }
}

export function damlStockIssuanceDataToNative(
  d: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData
): OcfStockIssuance {
  const { id: generatedId } = d;
  const id: unknown = generatedId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stockIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  const vestings = nonEmptyArrayOrUndefined(
    d.vestings.map((vesting) => ({
      date: damlTimeToDateString(vesting.date),
      amount: normalizeNumericString(vesting.amount),
    }))
  );
  const issuanceType = damlStockIssuanceTypeToNative(d.issuance_type);

  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id,
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
    security_law_exemptions: d.security_law_exemptions.map(damlSecurityExemptionToNative),
    stock_class_id: d.stock_class_id,
    ...(d.stock_plan_id && { stock_plan_id: d.stock_plan_id }),
    share_numbers_issued: d.share_numbers_issued.map(damlShareNumberRangeToNative),
    share_price: damlMonetaryToNative(d.share_price),
    quantity: normalizeNumericString(d.quantity),
    ...(d.vesting_terms_id && { vesting_terms_id: d.vesting_terms_id }),
    ...(vestings ? { vestings } : {}),
    ...(d.cost_basis && { cost_basis: damlMonetaryToNative(d.cost_basis) }),
    stock_legend_ids: d.stock_legend_ids,
    ...(issuanceType !== undefined ? { issuance_type: issuanceType } : {}),
    comments: d.comments,
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
  const issuanceData = extractAndDecodeDamlEntityData('stockIssuance', createArgument);
  const native = damlStockIssuanceDataToNative(issuanceData);
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
