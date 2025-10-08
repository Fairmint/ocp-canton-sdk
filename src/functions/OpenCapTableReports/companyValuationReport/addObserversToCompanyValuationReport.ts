import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { extractUpdateId } from '../../../utils/typeConversions';

export interface AddObserversToCompanyValuationReportParams {
  companyValuationReportContractId: string;
  added: string[];
}

export interface AddObserversToCompanyValuationReportResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

interface CompanyValuationReportCreateArgumentShape {
  system_operator?: string;
}

function hasSystemOperator(
  arg: unknown
): arg is Required<Pick<CompanyValuationReportCreateArgumentShape, 'system_operator'>> {
  return (
    Boolean(arg) &&
    typeof arg === 'object' &&
    typeof (arg as CompanyValuationReportCreateArgumentShape).system_operator === 'string'
  );
}

/** Add observers to a CompanyValuationReport by exercising AddObservers. */
export async function addObserversToCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: AddObserversToCompanyValuationReportParams
): Promise<AddObserversToCompanyValuationReportResult> {
  // Determine the acting party (system_operator) from the created event
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.companyValuationReportContractId,
  });

  const createdEvent = eventsResponse.created?.createdEvent;
  if (!createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }

  const { createArgument } = createdEvent;
  if (!hasSystemOperator(createArgument)) {
    throw new Error('System operator not found in contract create argument');
  }
  const systemOperator = createArgument.system_operator;

  const choiceArguments: Fairmint.OpenCapTableReports.CompanyValuationReport.AddObservers = {
    added: params.added,
  };

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [systemOperator],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport.templateId,
          contractId: params.companyValuationReportContractId,
          choice: 'AddObservers',
          choiceArgument: choiceArguments,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: extractUpdateId(response),
    response,
  };
}

