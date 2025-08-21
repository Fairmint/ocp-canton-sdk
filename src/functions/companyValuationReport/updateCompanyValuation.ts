import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';

export interface UpdateCompanyValuationParams {
  companyValuationReportContractId: string;
  newCompanyValuation: string | number;
}

export interface UpdateCompanyValuationResult {
  contractId: string;
  updateId: string;
  transactionTree: SubmitAndWaitForTransactionTreeResponse;
}

interface CompanyValuationReportCreateArgumentShape {
  system_operator?: string;
}

function hasSystemOperator(arg: unknown): arg is Required<Pick<CompanyValuationReportCreateArgumentShape, 'system_operator'>> {
  return !!arg && typeof arg === 'object' && typeof (arg as CompanyValuationReportCreateArgumentShape).system_operator === 'string';
}

/**
 * Update the company valuation on a CompanyValuationReport by exercising SetCompanyValuation.
 */
export async function updateCompanyValuation(
  client: LedgerJsonApiClient,
  params: UpdateCompanyValuationParams
): Promise<UpdateCompanyValuationResult> {
  // Determine the acting party (system_operator) from the created event
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.companyValuationReportContractId
  });
  
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasSystemOperator(createArgument)) {
    throw new Error('System operator not found in contract create argument');
  }
  const systemOperator = createArgument.system_operator;

  const choiceArguments: Fairmint.OpenCapTable.CompanyValuationReport.SetCompanyValuation = {
    new_company_valuation: typeof params.newCompanyValuation === 'number'
      ? params.newCompanyValuation.toString()
      : params.newCompanyValuation
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [systemOperator],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId,
          contractId: params.companyValuationReportContractId,
          choice: 'SetCompanyValuation',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId,
    transactionTree: response.transactionTree
  };
}
