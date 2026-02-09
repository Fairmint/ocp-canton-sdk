import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js/lib';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/reports-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface CreateCompanyValuationReportParams {
  companyId: string;
  companyValuation: string | number;
  observers?: string[];
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
}

export interface CreateCompanyValuationReportResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Create a CompanyValuationReport by exercising the CreateCompanyValuationReport choice on the OCP Factory contract.
 *
 * This function requires the FeaturedAppRight contract details to be provided for disclosed contracts, which is
 * necessary for cross-domain contract interactions in Canton.
 */
export async function createCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: CreateCompanyValuationReportParams
): Promise<CreateCompanyValuationReportResult> {
  const { command, disclosedContracts } = buildCreateCompanyValuationReportCommand(client, params);

  const response = (await client.submitAndWaitForTransactionTree({
    commands: [command],
    disclosedContracts,
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport.templateId
  );
  if (!created) {
    throw new OcpContractError('Expected CreatedTreeEvent not found', {
      templateId: Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport.templateId,
      choice: 'CreateCompanyValuationReport',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId,
    response,
  };
}

export function buildCreateCompanyValuationReportCommand(
  client: LedgerJsonApiClient,
  params: CreateCompanyValuationReportParams
): CommandWithDisclosedContracts {
  const network = client.getNetwork();
  const networkData = factoryContractIdData[network as keyof typeof factoryContractIdData] as
    | (typeof factoryContractIdData)[keyof typeof factoryContractIdData]
    | undefined;
  if (!networkData) {
    throw new OcpValidationError('network', `Unsupported network: ${network}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: network,
    });
  }

  const choiceArguments: Fairmint.OpenCapTableReports.ReportsFactory.CreateCompanyValuationReport = {
    company_id: params.companyId,
    company_valuation:
      typeof params.companyValuation === 'number' ? params.companyValuation.toString() : params.companyValuation,
    observers: params.observers ?? [],
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: networkData.templateId,
      contractId: networkData.reportsFactoryContractId,
      choice: 'CreateCompanyValuationReport',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
