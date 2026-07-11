import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types/native';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { validateAdministrativeAdjustmentFields } from '../capTable/administrativeAdjustmentValidation';
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
  const newSharesAuthorized = validateAdministrativeAdjustmentFields('issuerAuthorizedSharesAdjustment', {
    id: d.id,
    subjectField: 'issuer_id',
    subjectValue: d.issuer_id,
    numericField: 'new_shares_authorized',
    numericValue: d.new_shares_authorized,
    comments: d.comments,
  });
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
    new_shares_authorized: newSharesAuthorized,
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
