import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface GetIssuerAuthorizedSharesAdjustmentAsOcfParams {
  contractId: string;
}
export interface GetIssuerAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfIssuerAuthorizedSharesAdjustment;
  contractId: string;
}

/**
 * Converts DAML IssuerAuthorizedSharesAdjustment data to native OCF format.
 * Used by damlToOcf dispatcher and getIssuerAuthorizedSharesAdjustmentAsOcf.
 */
export function damlIssuerAuthorizedSharesAdjustmentDataToNative(
  d: Record<string, unknown>
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
  if (!d.date || typeof d.date !== 'string')
    throw new OcpValidationError('issuerAuthorizedSharesAdjustment.date', 'Missing or invalid date', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.date,
    });

  return {
    id: d.id,
    date: d.date.split('T')[0],
    issuer_id: d.issuer_id,
    new_shares_authorized: normalizeNumericString(
      typeof d.new_shares_authorized === 'number' ? String(d.new_shares_authorized) : d.new_shares_authorized
    ),
    ...(d.board_approval_date ? { board_approval_date: (d.board_approval_date as string).split('T')[0] } : {}),
    ...(d.stockholder_approval_date
      ? { stockholder_approval_date: (d.stockholder_approval_date as string).split('T')[0] }
      : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}

export async function getIssuerAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetIssuerAuthorizedSharesAdjustmentAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument)
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  const arg = res.created.createdEvent.createArgument as Record<string, unknown>;
  const d = (arg.adjustment_data ?? arg) as Record<string, unknown>;

  const event = damlIssuerAuthorizedSharesAdjustmentDataToNative(d);
  return { event, contractId: params.contractId };
}
