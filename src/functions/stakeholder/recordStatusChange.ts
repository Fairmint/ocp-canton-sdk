import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RecordStatusChangeParams {
  stakeholderContractId: ContractId<Fairmint.OpenCapTable.Stakeholder.Stakeholder>;
  issuerParty: string;
  date: string; // YYYY-MM-DD
  newStatus: Fairmint.OpenCapTable.Types.OcfStakeholderStatusType;
}

export interface RecordStatusChangeResult {
  updateId: string;
  eventContractId: string;
}

/**
 * Record a stakeholder status change event.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/change_event/StakeholderStatusChangeEvent.schema.json
 */
export async function recordStatusChange(
  client: LedgerJsonApiClient,
  params: RecordStatusChangeParams
): Promise<RecordStatusChangeResult> {
  const choiceArgs: Fairmint.OpenCapTable.Stakeholder.RecordStatusChange = {
    date: `${params.date}T00:00:00.000Z`,
    new_status: params.newStatus as any,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId,
          contractId: params.stakeholderContractId,
          choice: 'RecordStatusChange',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Stakeholder.StakeholderStatusChangeEvent.templateId
  ) as any;

  if (!created) throw new Error('StakeholderStatusChangeEvent not found');

  return { updateId: response.transactionTree.updateId, eventContractId: created.CreatedTreeEvent.value.contractId };
}
