import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface CreateCompanyValuationReportParams {
  companyId: string;
  companyValuation: string | number;
  observers?: string[];
}

export interface CreateCompanyValuationReportResult {
  contractId: string;
  updateId: string;
}

/**
 * Create a CompanyValuationReport by exercising the CreateCompanyValuationReport choice
 * on the OCP Factory contract.
 */
export async function createCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: CreateCompanyValuationReportParams
): Promise<CreateCompanyValuationReportResult> {
  const network = client.getNetwork();
  const networkData = factoryContractIdData[network as keyof typeof factoryContractIdData];
  if (!networkData) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const choiceArguments: Fairmint.OpenCapTable.OcpFactory.CreateCompanyValuationReport = {
    company_id: params.companyId,
    company_valuation: typeof params.companyValuation === 'number'
      ? params.companyValuation.toString()
      : params.companyValuation,
    observers: params.observers ?? []
  };

  const response = await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: networkData.templateId,
          contractId: networkData.ocpFactoryContractId,
          choice: 'CreateCompanyValuationReport',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const event = response.transactionTree.eventsById[1];
  if ('CreatedTreeEvent' in event) {
    return {
      contractId: event.CreatedTreeEvent.value.contractId,
      updateId: response.transactionTree.updateId
    };
  } else {
    throw new Error('Expected CreatedTreeEvent not found');
  }
} 