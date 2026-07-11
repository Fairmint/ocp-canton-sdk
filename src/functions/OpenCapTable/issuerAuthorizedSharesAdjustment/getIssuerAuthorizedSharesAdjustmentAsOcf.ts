import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types/native';
import {
  damlTimeToDateString,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type GetIssuerAuthorizedSharesAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetIssuerAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfIssuerAuthorizedSharesAdjustment;
  contractId: string;
}

/** Exact generated DAML payload shape without exposing generated package declarations. */
export interface DamlIssuerAuthorizedSharesAdjustmentData {
  id: string;
  date: string;
  issuer_id: string;
  new_shares_authorized: string;
  comments: string[];
  board_approval_date: string | null;
  stockholder_approval_date: string | null;
}

/**
 * Converts DAML IssuerAuthorizedSharesAdjustment data to native OCF format.
 * Used by damlToOcf dispatcher and getIssuerAuthorizedSharesAdjustmentAsOcf.
 */
export function damlIssuerAuthorizedSharesAdjustmentDataToNative(
  d: DamlIssuerAuthorizedSharesAdjustmentData
): OcfIssuerAuthorizedSharesAdjustment {
  if (!d.id || typeof d.id !== 'string')
    throw new OcpValidationError('issuerAuthorizedSharesAdjustment.id', 'Missing or invalid id', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  if (!d.issuer_id || typeof d.issuer_id !== 'string')
    throw new OcpValidationError('issuerAuthorizedSharesAdjustment.issuer_id', 'Missing or invalid issuer_id', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.issuer_id,
    });
  if (d.new_shares_authorized === undefined || d.new_shares_authorized === null)
    throw new OcpValidationError(
      'issuerAuthorizedSharesAdjustment.new_shares_authorized',
      'Missing new_shares_authorized',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  if (typeof d.new_shares_authorized !== 'string' && typeof d.new_shares_authorized !== 'number')
    throw new OcpValidationError(
      'issuerAuthorizedSharesAdjustment.new_shares_authorized',
      `Must be string or number, got ${typeof d.new_shares_authorized}`,
      { code: OcpErrorCodes.INVALID_TYPE, expectedType: 'string | number', receivedValue: d.new_shares_authorized }
    );
  const boardApprovalDate = optionalDamlTimeToDateString(
    d.board_approval_date,
    'issuerAuthorizedSharesAdjustment.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'issuerAuthorizedSharesAdjustment.stockholder_approval_date'
  );

  return {
    object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    id: d.id,
    date: damlTimeToDateString(d.date, 'issuerAuthorizedSharesAdjustment.date'),
    issuer_id: d.issuer_id,
    new_shares_authorized: normalizeNumericString(
      d.new_shares_authorized,
      'issuerAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}

export async function getIssuerAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetIssuerAuthorizedSharesAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getIssuerAuthorizedSharesAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.issuerAuthorizedSharesAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('issuerAuthorizedSharesAdjustment', createArgument);
  const native = damlIssuerAuthorizedSharesAdjustmentDataToNative(data);
  return { event: native, contractId: params.contractId };
}
