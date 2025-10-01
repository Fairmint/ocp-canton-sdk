import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfEquityCompensationIssuanceData, CommandWithDisclosedContracts, CompensationType, TerminationWindow } from '../../types';
import { dateStringToDAMLTime, monetaryToDaml } from '../../utils/typeConversions';

function compensationTypeToDaml(t: CompensationType): Fairmint.OpenCapTable.Types.OcfCompensationType {
  switch (t) {
    case 'OPTION_NSO': return 'OcfCompensationTypeOptionNSO';
    case 'OPTION_ISO': return 'OcfCompensationTypeOptionISO';
    case 'OPTION': return 'OcfCompensationTypeOption';
    case 'RSU': return 'OcfCompensationTypeRSU';
    case 'CSAR': return 'OcfCompensationTypeCSAR';
    case 'SSAR': return 'OcfCompensationTypeSSAR';
    default: throw new Error('Unknown compensation type');
  }
}

function terminationWindowToDaml(w: TerminationWindow): Fairmint.OpenCapTable.Types.OcfTerminationWindow {
  const reasonMap: Record<TerminationWindow['reason'], Fairmint.OpenCapTable.Types.OcfTerminationWindowType> = {
    VOLUNTARY_OTHER: 'OcfTermVoluntaryOther',
    VOLUNTARY_GOOD_CAUSE: 'OcfTermVoluntaryGoodCause',
    VOLUNTARY_RETIREMENT: 'OcfTermVoluntaryRetirement',
    INVOLUNTARY_OTHER: 'OcfTermInvoluntaryOther',
    INVOLUNTARY_DEATH: 'OcfTermInvoluntaryDeath',
    INVOLUNTARY_DISABILITY: 'OcfTermInvoluntaryDisability',
    INVOLUNTARY_WITH_CAUSE: 'OcfTermInvoluntaryWithCause'
  };
  const periodTypeMap: Record<TerminationWindow['period_type'], Fairmint.OpenCapTable.Types.OcfPeriodType> = {
    DAYS: 'OcfPeriodDays',
    MONTHS: 'OcfPeriodMonths'
  };
  return {
    reason: reasonMap[w.reason],
    period: typeof w.period === 'number' ? w.period.toString() : String(w.period),
    period_type: periodTypeMap[w.period_type]
  };
}

function equityCompIssuanceDataToDaml(d: OcfEquityCompensationIssuanceData): Fairmint.OpenCapTable.Types.OcfEquityCompensationIssuanceData {
  return {
    compensation_type: compensationTypeToDaml(d.compensation_type),
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable === undefined ? null : d.early_exercisable,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })),
    expiration_date: d.expiration_date ? dateStringToDAMLTime(d.expiration_date) : null,
    termination_exercise_windows: d.termination_exercise_windows.map(terminationWindowToDaml),
    comments: d.comments || []
  };
}

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


