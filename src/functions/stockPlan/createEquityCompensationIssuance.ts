import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfEquityCompensationIssuanceData, CommandWithDisclosedContracts } from '../../types';
import { equityCompIssuanceDataToDaml, dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateEquityCompensationIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  issuanceData: OcfEquityCompensationIssuanceData & {
    id: string;
    date: string;
    security_id: string;
    custom_id: string;
    stakeholder_id: string;
    stock_plan_id?: string;
    stock_class_id?: string;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    consideration_text?: string;
    vesting_terms_id?: string;
  };
}

export interface CreateEquityCompensationIssuanceResult { contractId: string; updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

export async function createEquityCompensationIssuance(
  client: LedgerJsonApiClient,
  params: CreateEquityCompensationIssuanceParams
): Promise<CreateEquityCompensationIssuanceResult> {
  const { command, disclosedContracts } = buildCreateEquityCompensationIssuanceCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  type TreeEvent = SubmitAndWaitForTransactionTreeResponse['transactionTree']['eventsById'][string];
  type CreatedEvent = Extract<TreeEvent, { CreatedTreeEvent: unknown }>;
  const created = Object.values((response.transactionTree as any)?.eventsById ?? (response.transactionTree as any)?.transaction?.eventsById ?? {}).find((e: any): e is CreatedEvent =>
    'CreatedTreeEvent' in e && (e as CreatedEvent).CreatedTreeEvent.value.templateId.endsWith(':Fairmint.OpenCapTable.EquityCompensationIssuance:EquityCompensationIssuance')
  );
  if (!created) throw new Error('Expected EquityCompensationIssuance CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildCreateEquityCompensationIssuanceCommand(params: CreateEquityCompensationIssuanceParams): CommandWithDisclosedContracts {
  const d = params.issuanceData;
  const emptyToNull = (v: string | undefined): string | null => (v === '' ? null : (v ?? null));
  const issuance_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: emptyToNull(d.consideration_text),
    security_law_exemptions: (d.security_law_exemptions || []).map(e => ({ description: e.description, jurisdiction: e.jurisdiction })),
    stock_plan_id: emptyToNull(d.stock_plan_id),
    stock_class_id: d.stock_class_id ?? null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    ...equityCompIssuanceDataToDaml(d)
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateEquityCompensationIssuance = { issuance_data };
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateEquityCompensationIssuance', choiceArgument: choiceArguments } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


