import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockIssuance, SecurityExemption, ShareNumberRange, StockIssuanceType } from '../../../types/native';
import { damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { assertSafeGeneratedDamlJson } from '../../../utils/generatedDamlValidation';
import {
  damlTimeToDateString,
  isRecord,
  nonEmptyArrayOrUndefined,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlMonetary, requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';
import { readSingleContract } from '../shared/singleContractRead';

export type DamlStockIssuanceData = DamlDataTypeFor<'stockIssuance'>;

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

function requireStockIssuanceCollectionText(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
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
    description: requireStockIssuanceCollectionText(exemption.description, `${fieldPath}.description`),
    jurisdiction: requireStockIssuanceCollectionText(exemption.jurisdiction, `${fieldPath}.jurisdiction`),
  };
}

function damlShareNumberRangeToNative(value: unknown, index: number): ShareNumberRange {
  const fieldPath = `stockIssuance.share_numbers_issued[${index}]`;
  const range = requireStockIssuanceCollectionRecord(value, fieldPath);
  const startingShareNumber = requireGeneratedDamlNumeric10(
    range.starting_share_number,
    `${fieldPath}.starting_share_number`,
    'positive'
  );
  const endingShareNumber = requireGeneratedDamlNumeric10(
    range.ending_share_number,
    `${fieldPath}.ending_share_number`,
    'positive'
  );
  if (damlNumeric10ToScaledBigInt(endingShareNumber) < damlNumeric10ToScaledBigInt(startingShareNumber)) {
    throw new OcpValidationError(`${fieldPath}.ending_share_number`, 'Ending share number must not precede the start', {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'DAML Numeric(10) greater than or equal to starting_share_number',
      receivedValue: range.ending_share_number,
    });
  }
  return {
    starting_share_number: startingShareNumber,
    ending_share_number: endingShareNumber,
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
  if (value === null || value === undefined) {
    throw new OcpValidationError(`stockIssuance.${field}`, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(`stockIssuance.${field}`, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
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

export function damlStockIssuanceDataToNative(input: DamlStockIssuanceData): OcfStockIssuance {
  const d = decodeDamlEntityData('stockIssuance', input);
  const id = requireStockIssuanceString(d.id, 'id');
  const date = requireStockIssuanceString(d.date, 'date');
  const securityId = requireStockIssuanceString(d.security_id, 'security_id');
  const customId = requireStockIssuanceString(d.custom_id, 'custom_id');
  const stakeholderId = requireStockIssuanceString(d.stakeholder_id, 'stakeholder_id');
  const stockClassId = requireStockIssuanceString(d.stock_class_id, 'stock_class_id');
  const vestingInputs: unknown = d.vestings;
  if (vestingInputs !== undefined) {
    assertSafeGeneratedDamlJson(vestingInputs, 'stockIssuance.vestings');
  }
  if (vestingInputs !== undefined && !Array.isArray(vestingInputs)) {
    throw new OcpValidationError('stockIssuance.vestings', 'Must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: vestingInputs,
    });
  }
  const vestings =
    vestingInputs === undefined
      ? undefined
      : nonEmptyArrayOrUndefined(vestingInputs, 'stockIssuance.vestings', (vestingInput, { index }) => {
          const vesting = decodeStockIssuanceVesting(vestingInput, index);
          return {
            date: damlTimeToDateString(vesting.date, `stockIssuance.vestings[${index}].date`),
            amount: requireGeneratedDamlNumeric10(vesting.amount, `stockIssuance.vestings[${index}].amount`),
          };
        });
  const issuanceType = damlStockIssuanceTypeToNative(d.issuance_type);
  const costBasis: unknown = d.cost_basis;

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
    ...(typeof d.consideration_text === 'string' ? { consideration_text: d.consideration_text } : {}),
    security_law_exemptions: securityLawExemptions,
    stock_class_id: stockClassId,
    ...(typeof d.stock_plan_id === 'string' ? { stock_plan_id: d.stock_plan_id } : {}),
    share_numbers_issued: shareNumbersIssued,
    share_price: requireGeneratedDamlMonetary(d.share_price, 'stockIssuance.share_price'),
    quantity: requireGeneratedDamlNumeric10(d.quantity, 'stockIssuance.quantity'),
    ...(typeof d.vesting_terms_id === 'string' ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(vestings ? { vestings } : {}),
    ...(costBasis !== null && costBasis !== undefined
      ? { cost_basis: requireGeneratedDamlMonetary(costBasis, 'stockIssuance.cost_basis') }
      : {}),
    stock_legend_ids: d.stock_legend_ids,
    ...(issuanceType !== undefined ? { issuance_type: issuanceType } : {}),
    comments: d.comments,
  };
}

export interface GetStockIssuanceAsOcfParams extends GetByContractIdParams {}

export interface GetStockIssuanceAsOcfResult {
  contractId: string;
  event: OcfStockIssuance;
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
  return { contractId: params.contractId, event: ocf };
}
