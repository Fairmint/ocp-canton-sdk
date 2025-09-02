import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RecordRelationshipChangeParams {
  stakeholderContractId: ContractId<Fairmint.OpenCapTable.Stakeholder.Stakeholder>;
  issuerParty: string;
  date: string; // YYYY-MM-DD
  relationshipStarted?: Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType;
  relationshipEnded?: Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType;
}

export interface RecordRelationshipChangeResult {
  updateId: string;
  eventContractId: string;
}

/**
 * Record a stakeholder relationship change event.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json
 */
export async function recordRelationshipChange(
  client: LedgerJsonApiClient,
  params: RecordRelationshipChangeParams
): Promise<RecordRelationshipChangeResult> {
  const choiceArgs: Fairmint.OpenCapTable.Stakeholder.RecordRelationshipChange = {
    date: `${params.date}T00:00:00.000Z`,
    relationship_started: params.relationshipStarted ? { tag: 'Some', value: params.relationshipStarted } : null,
    relationship_ended: params.relationshipEnded ? { tag: 'Some', value: params.relationshipEnded } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId,
          contractId: params.stakeholderContractId,
          choice: 'RecordRelationshipChange',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Stakeholder.StakeholderRelationshipChangeEvent.templateId
  ) as any;

  if (!created) throw new Error('StakeholderRelationshipChangeEvent not found');

  return { updateId: response.transactionTree.updateId, eventContractId: created.CreatedTreeEvent.value.contractId };
}
