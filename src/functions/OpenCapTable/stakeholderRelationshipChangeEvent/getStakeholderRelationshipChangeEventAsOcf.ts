/**
 * DAML to OCF converter for StakeholderRelationshipChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import {
  GENERATED_CONTEXT_FIELDS,
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import {
  damlStakeholderRelationshipChangeEventToNative,
  type DamlStakeholderRelationshipChangeData,
} from './damlToOcf';

/** Parameters for getting a stakeholder relationship change event as OCF */
export type GetStakeholderRelationshipChangeEventAsOcfParams = GetByContractIdParams;

/** Result of getting a stakeholder relationship change event as OCF */
export interface GetStakeholderRelationshipChangeEventAsOcfResult {
  /** The OCF-formatted stakeholder relationship change event */
  event: OcfStakeholderRelationshipChangeEvent;
  /** The contract ID */
  contractId: string;
}

/**
 * Read a StakeholderRelationshipChangeEvent contract from the ledger and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient for ledger access
 * @param params - Parameters including the contract ID
 * @returns The OCF-formatted event and contract ID
 */
export async function getStakeholderRelationshipChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderRelationshipChangeEventAsOcfParams
): Promise<GetStakeholderRelationshipChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderRelationshipChangeEventAsOcf',
    expectedTemplateId:
      Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
  });
  const argumentPath = 'StakeholderRelationshipChangeEvent.createArgument';
  assertSafeGeneratedDamlJson(createArgument, argumentPath);
  const sourceContract = requireGeneratedRecord(createArgument, argumentPath);
  rejectUnknownGeneratedFields(sourceContract, argumentPath, ['context', 'ocf_data']);
  const contextPath = `${argumentPath}.context`;
  const context = requireGeneratedRecord(sourceContract.context, contextPath);
  rejectUnknownGeneratedFields(context, contextPath, GENERATED_CONTEXT_FIELDS);
  for (const field of GENERATED_CONTEXT_FIELDS) {
    requireGeneratedString(context[field], `${contextPath}.${field}`);
  }
  requireGeneratedRecord(sourceContract.ocf_data, `${argumentPath}.ocf_data`);

  const event: OcfStakeholderRelationshipChangeEvent = damlStakeholderRelationshipChangeEventToNative(
    sourceContract.ocf_data as DamlStakeholderRelationshipChangeData
  );
  decodeGeneratedDaml(
    createArgument,
    {
      decode: (value) =>
        Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.decoder.runWithException(
          value
        ),
      encode: (value) =>
        Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.encode(value),
    },
    argumentPath
  );

  return { event, contractId: params.contractId };
}
