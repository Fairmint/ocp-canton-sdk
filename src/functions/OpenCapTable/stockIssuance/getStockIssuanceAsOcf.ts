import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockIssuance, SecurityExemption, ShareNumberRange, StockIssuanceType } from '../../../types/native';
import {
  damlMonetaryToNative,
  damlTimeToDateString,
  isRecord,
  nonEmptyArrayOrUndefined,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

function requireStockIssuanceCollectionRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return value;
}

function requireStockIssuanceCollectionString(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, 'Must be a non-empty string', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function stockIssuanceCollection(value: unknown, fieldPath: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, 'Must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: value,
    });
  }
  return value;
}

function damlSecurityExemptionToNative(value: unknown, index: number): SecurityExemption {
  const fieldPath = `stockIssuance.security_law_exemptions[${index}]`;
  const exemption = requireStockIssuanceCollectionRecord(value, fieldPath);
  return {
    description: requireStockIssuanceCollectionString(exemption.description, `${fieldPath}.description`),
    jurisdiction: requireStockIssuanceCollectionString(exemption.jurisdiction, `${fieldPath}.jurisdiction`),
  };
}

function damlShareNumberRangeToNative(value: unknown, index: number): ShareNumberRange {
  const fieldPath = `stockIssuance.share_numbers_issued[${index}]`;
  const range = requireStockIssuanceCollectionRecord(value, fieldPath);
  return {
    starting_share_number: requireStockIssuanceCollectionString(
      range.starting_share_number,
      `${fieldPath}.starting_share_number`
    ),
    ending_share_number: requireStockIssuanceCollectionString(
      range.ending_share_number,
      `${fieldPath}.ending_share_number`
    ),
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

type RequiredStockIssuanceStringField =
  | 'id'
  | 'date'
  | 'security_id'
  | 'custom_id'
  | 'stakeholder_id'
  | 'stock_class_id';

function requireStockIssuanceString(value: unknown, field: RequiredStockIssuanceStringField): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcpValidationError(`stockIssuance.${field}`, 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function decodeStockIssuanceVesting(input: unknown, index: number): Fairmint.OpenCapTable.Types.Vesting.OcfVesting {
  try {
    return Fairmint.OpenCapTable.Types.Vesting.OcfVesting.decoder.runWithException(input);
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    const detail = cause?.message ?? String(error);
    throw new OcpParseError(`Invalid DAML vesting at index ${index}: ${detail}`, {
      source: `stockIssuance.vestings[${index}]`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_stock_issuance_vesting',
      context: { index },
      ...(cause ? { cause } : {}),
    });
  }
}

export function damlStockIssuanceDataToNative(
  d: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData
): OcfStockIssuance {
  if (!isRecord(d)) {
    throw new OcpParseError('StockIssuance data must be a non-null object', {
      source: 'stockIssuance.issuance_data',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_stock_issuance_data_shape',
    });
  }
  const id = requireStockIssuanceString(d.id, 'id');
  const date = requireStockIssuanceString(d.date, 'date');
  const securityId = requireStockIssuanceString(d.security_id, 'security_id');
  const customId = requireStockIssuanceString(d.custom_id, 'custom_id');
  const stakeholderId = requireStockIssuanceString(d.stakeholder_id, 'stakeholder_id');
  const stockClassId = requireStockIssuanceString(d.stock_class_id, 'stock_class_id');
  const vestingInputs: unknown = d.vestings;
  if (vestingInputs !== undefined && !Array.isArray(vestingInputs)) {
    throw new OcpParseError('StockIssuance vestings must be an array', {
      source: 'stockIssuance.vestings',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_stock_issuance_vestings_shape',
      context: { receivedType: vestingInputs === null ? 'null' : typeof vestingInputs },
    });
  }
  const vestings = nonEmptyArrayOrUndefined(
    Array.isArray(vestingInputs)
      ? vestingInputs.map((input, index) => {
          const vesting = decodeStockIssuanceVesting(input, index);
          return {
            date: damlTimeToDateString(vesting.date, `stockIssuance.vestings[${index}].date`),
            amount: normalizeNumericString(vesting.amount),
          };
        })
      : [],
    'stockIssuance.vestings'
  );
  const issuanceType = damlStockIssuanceTypeToNative(d.issuance_type);

  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'stockIssuance.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'stockIssuance.stockholder_approval_date'
  );
  const securityLawExemptions = stockIssuanceCollection(
    d.security_law_exemptions,
    'stockIssuance.security_law_exemptions'
  ).map(damlSecurityExemptionToNative);
  const shareNumbersIssued = stockIssuanceCollection(d.share_numbers_issued, 'stockIssuance.share_numbers_issued').map(
    damlShareNumberRangeToNative
  );

  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id,
    date: damlTimeToDateString(date, 'stockIssuance.date'),
    security_id: securityId,
    custom_id: customId,
    stakeholder_id: stakeholderId,
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    security_law_exemptions: securityLawExemptions,
    stock_class_id: stockClassId,
    ...(d.stock_plan_id && { stock_plan_id: d.stock_plan_id }),
    share_numbers_issued: shareNumbersIssued,
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
