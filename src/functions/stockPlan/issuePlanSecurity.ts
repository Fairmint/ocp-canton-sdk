import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';
import { ContractDetails } from '../../types/contractDetails';
import { OcfEquityCompensationIssuanceData } from '../../types/native';
import { equityCompIssuanceDataToDaml } from '../../utils/typeConversions';

export interface IssuePlanSecurityParams {
  stockPlanContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  stakeholderParty: string;
  stockClassContractId: string;
  vestingTermsContractId?: string;
  issuanceData: OcfEquityCompensationIssuanceData;
}

export interface IssuePlanSecurityResult {
  contractId: string; // PlanSecurityGrant contract id
  updateId: string;
}

/**
 * Issue an equity compensation plan security by exercising the IssuePlanSecurity choice on a StockPlan
 *
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/issuance/EquityCompensationIssuance.schema.json
 * - stockClassContractId: Class the security will ultimately exercise into
 * - vestingTermsContractId (optional): Vesting terms to apply
 * - issuanceData: compensation_type, quantity, optional exercise/base price, early_exercisable, vestings or vesting_terms_id,
 *   expiration_date, termination_exercise_windows, comments
 */
export async function issuePlanSecurity(
  client: LedgerJsonApiClient,
  params: IssuePlanSecurityParams
): Promise<IssuePlanSecurityResult> {
  const choiceArguments: Fairmint.OpenCapTable.StockPlan.IssuePlanSecurity = {
    stakeholder: params.stakeholderParty,
    issuance_data: equityCompIssuanceDataToDaml(params.issuanceData),
    stock_class: params.stockClassContractId,
    vesting_terms: params.vestingTermsContractId ? { tag: 'Some', value: params.vestingTermsContractId } as any : null
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.StockPlan.templateId,
          contractId: params.stockPlanContractId,
          choice: 'IssuePlanSecurity',
          choiceArgument: choiceArguments
        }
      }
    ],
    disclosedContracts: [
      {
        templateId: params.featuredAppRightContractDetails.templateId,
        contractId: params.featuredAppRightContractDetails.contractId,
        createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
        synchronizerId: params.featuredAppRightContractDetails.synchronizerId
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}
