import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfIssuerAuthorizedSharesAdjustmentOutput } from '../../../types/output';
import { canonicalizeAdministrativeAdjustmentReadNumeric } from '../capTable/administrativeAdjustmentValidation';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { generatedDamlTimeToDateString, optionalGeneratedDamlTimeToDateString } from '../shared/generatedDamlValues';
import { readSingleContract } from '../shared/singleContractRead';

export type GetIssuerAuthorizedSharesAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetIssuerAuthorizedSharesAdjustmentAsOcfResult {
  readonly event: OcfIssuerAuthorizedSharesAdjustmentOutput;
  readonly contractId: string;
}

export type DamlIssuerAuthorizedSharesAdjustmentData = DamlDataTypeFor<'issuerAuthorizedSharesAdjustment'>;

/** Convert exact generated IssuerAuthorizedSharesAdjustment data to native OCF. */
export function damlIssuerAuthorizedSharesAdjustmentDataToNative(
  input: DamlIssuerAuthorizedSharesAdjustmentData
): OcfIssuerAuthorizedSharesAdjustmentOutput {
  const data = decodeDamlEntityData('issuerAuthorizedSharesAdjustment', input);
  const boardApprovalDate = optionalGeneratedDamlTimeToDateString(
    data.board_approval_date,
    'issuerAuthorizedSharesAdjustment.board_approval_date'
  );
  const stockholderApprovalDate = optionalGeneratedDamlTimeToDateString(
    data.stockholder_approval_date,
    'issuerAuthorizedSharesAdjustment.stockholder_approval_date'
  );

  return Object.freeze({
    object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    id: data.id,
    date: generatedDamlTimeToDateString(data.date, 'issuerAuthorizedSharesAdjustment.date'),
    issuer_id: data.issuer_id,
    new_shares_authorized: canonicalizeAdministrativeAdjustmentReadNumeric(
      data.new_shares_authorized,
      'issuerAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(data.comments.length > 0 ? { comments: Object.freeze([...data.comments]) } : {}),
  });
}

export async function getIssuerAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetIssuerAuthorizedSharesAdjustmentAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getIssuerAuthorizedSharesAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.issuerAuthorizedSharesAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('issuerAuthorizedSharesAdjustment', createArgument);
  const event = damlIssuerAuthorizedSharesAdjustmentDataToNative(data);
  return Object.freeze({ event, contractId });
}
