import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  Monetary,
  OcfStockIssuance,
  SecurityExemption,
  ShareNumberRange,
  StockIssuanceType,
  VestingSimple,
} from '../../../types/native';
import { damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlNumeric10 } from '../shared/damlNumerics';
import { readSingleContract } from '../shared/singleContractRead';

export type DamlStockIssuanceData = DamlDataTypeFor<'stockIssuance'>;

function requiredText(value: unknown, fieldPath: string): string {
  if (value === undefined || value === null) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function requiredIdentifier(value: unknown, fieldPath: string): string {
  const text = requiredText(value, fieldPath);
  if (text.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a non-empty string`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return text;
}

function optionalText(value: unknown, fieldPath: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string or null`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string or null',
      receivedValue: value,
    });
  }
  return value;
}

function monetaryFromDaml(value: unknown, fieldPath: string): Monetary {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a Monetary object`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  const record = value as Record<string, unknown>;
  const currency = requiredText(record.currency, `${fieldPath}.currency`);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new OcpValidationError(`${fieldPath}.currency`, `${fieldPath}.currency must be an ISO 4217 code`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: record.currency,
    });
  }
  return { amount: parseDamlNumeric10(record.amount, `${fieldPath}.amount`), currency };
}

function optionalMonetaryFromDaml(value: unknown, fieldPath: string): Monetary | undefined {
  return value === null || value === undefined ? undefined : monetaryFromDaml(value, fieldPath);
}

function stockIssuanceTypeFromDaml(value: unknown): StockIssuanceType | undefined {
  if (value === null || value === undefined) return undefined;
  switch (value) {
    case 'OcfStockIssuanceRSA':
      return 'RSA';
    case 'OcfStockIssuanceFounders':
      return 'FOUNDERS_STOCK';
    default:
      throw new OcpParseError('Unknown DAML stock issuance type', {
        source: 'stockIssuance.issuance_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: value },
      });
  }
}

function securityLawExemptionsFromDaml(
  values: DamlStockIssuanceData['security_law_exemptions']
): SecurityExemption[] {
  return values.map((value, index) => ({
    description: requiredText(value.description, `stockIssuance.security_law_exemptions[${index}].description`),
    jurisdiction: requiredText(value.jurisdiction, `stockIssuance.security_law_exemptions[${index}].jurisdiction`),
  }));
}

function shareNumberRangesFromDaml(values: DamlStockIssuanceData['share_numbers_issued']): ShareNumberRange[] {
  return values.map((value, index) => {
    const path = `stockIssuance.share_numbers_issued[${index}]`;
    const startingShareNumber = parseDamlNumeric10(value.starting_share_number, `${path}.starting_share_number`);
    const endingShareNumber = parseDamlNumeric10(value.ending_share_number, `${path}.ending_share_number`);
    if (damlNumeric10ToScaledBigInt(endingShareNumber) < damlNumeric10ToScaledBigInt(startingShareNumber)) {
      throw new OcpValidationError(`${path}.ending_share_number`, 'Ending share number must not precede the start', {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: 'DAML Numeric(10) greater than or equal to starting_share_number',
        receivedValue: value.ending_share_number,
      });
    }
    return { starting_share_number: startingShareNumber, ending_share_number: endingShareNumber };
  });
}

function vestingsFromDaml(values: DamlStockIssuanceData['vestings']): VestingSimple[] {
  return values.map((value, index) => ({
    date: damlTimeToDateString(value.date, `stockIssuance.vestings[${index}].date`),
    amount: parseDamlNumeric10(value.amount, `stockIssuance.vestings[${index}].amount`),
  }));
}

/** Convert an exact generated DAML stock-issuance payload to canonical OCF. */
export function damlStockIssuanceDataToNative(input: DamlStockIssuanceData): OcfStockIssuance {
  const d = decodeDamlEntityData('stockIssuance', input);
  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'stockIssuance.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'stockIssuance.stockholder_approval_date'
  );
  const considerationText = optionalText(d.consideration_text, 'stockIssuance.consideration_text');
  const stockPlanId = optionalText(d.stock_plan_id, 'stockIssuance.stock_plan_id');
  const vestingTermsId = optionalText(d.vesting_terms_id, 'stockIssuance.vesting_terms_id');
  const costBasis = optionalMonetaryFromDaml(d.cost_basis, 'stockIssuance.cost_basis');
  const issuanceType = stockIssuanceTypeFromDaml(d.issuance_type);
  const vestings = vestingsFromDaml(d.vestings);

  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id: requiredIdentifier(d.id, 'stockIssuance.id'),
    date: damlTimeToDateString(d.date, 'stockIssuance.date'),
    security_id: requiredIdentifier(d.security_id, 'stockIssuance.security_id'),
    custom_id: requiredIdentifier(d.custom_id, 'stockIssuance.custom_id'),
    stakeholder_id: requiredIdentifier(d.stakeholder_id, 'stockIssuance.stakeholder_id'),
    security_law_exemptions: securityLawExemptionsFromDaml(d.security_law_exemptions),
    stock_class_id: requiredIdentifier(d.stock_class_id, 'stockIssuance.stock_class_id'),
    share_numbers_issued: shareNumberRangesFromDaml(d.share_numbers_issued),
    share_price: monetaryFromDaml(d.share_price, 'stockIssuance.share_price'),
    quantity: parseDamlNumeric10(d.quantity, 'stockIssuance.quantity'),
    stock_legend_ids: d.stock_legend_ids.map((value, index) =>
      requiredText(value, `stockIssuance.stock_legend_ids[${index}]`)
    ),
    comments: d.comments.map((value, index) => requiredText(value, `stockIssuance.comments[${index}]`)),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(stockPlanId !== undefined ? { stock_plan_id: stockPlanId } : {}),
    ...(vestingTermsId !== undefined ? { vesting_terms_id: vestingTermsId } : {}),
    ...(vestings.length > 0 ? { vestings: vestings as [VestingSimple, ...VestingSimple[]] } : {}),
    ...(costBasis !== undefined ? { cost_basis: costBasis } : {}),
    ...(issuanceType !== undefined ? { issuance_type: issuanceType } : {}),
  };
}

export type GetStockIssuanceAsOcfParams = GetByContractIdParams;
export interface GetStockIssuanceAsOcfResult {
  event: OcfStockIssuance;
  contractId: string;
}

/** Read a stock issuance contract and return its canonical OCF event. */
export async function getStockIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockIssuanceAsOcfParams
): Promise<GetStockIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockIssuance,
  });
  const data = extractAndDecodeDamlEntityData('stockIssuance', createArgument);
  return { event: damlStockIssuanceDataToNative(data), contractId: params.contractId };
}
