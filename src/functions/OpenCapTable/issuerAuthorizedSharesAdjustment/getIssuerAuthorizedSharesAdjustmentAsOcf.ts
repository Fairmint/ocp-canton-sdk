import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
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
  return {
    object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    id: d.id,
    date: damlTimeToDateString(d.date, 'issuerAuthorizedSharesAdjustment.date'),
    issuer_id: d.issuer_id,
    new_shares_authorized: normalizeNumericString(
      d.new_shares_authorized,
      'issuerAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    ...(d.board_approval_date !== null
      ? {
          board_approval_date: damlTimeToDateString(
            d.board_approval_date,
            'issuerAuthorizedSharesAdjustment.board_approval_date'
          ),
        }
      : {}),
    ...(d.stockholder_approval_date !== null
      ? {
          stockholder_approval_date: damlTimeToDateString(
            d.stockholder_approval_date,
            'issuerAuthorizedSharesAdjustment.stockholder_approval_date'
          ),
        }
      : {}),
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
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
