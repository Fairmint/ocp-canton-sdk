import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfVestingTermsData } from '../../types/native';
import { vestingTermsDataToDaml } from '../../utils/typeConversions';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateVestingTermsParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  vestingTermsData: OcfVestingTermsData;
}

export interface CreateVestingTermsResult {
  contractId: string;
  updateId: string;
}

/**
 * Create vesting terms by exercising the CreateVestingTerms choice on an Issuer contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/VestingTerms.schema.json
 */
export async function createVestingTerms(
  client: LedgerJsonApiClient,
  params: CreateVestingTermsParams
): Promise<CreateVestingTermsResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateVestingTerms = {
    vesting_terms_data: vestingTermsDataToDaml(params.vestingTermsData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateVestingTerms',
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
    Fairmint.OpenCapTable.VestingTerms.VestingTerms.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateVestingTermsCommand(params: CreateVestingTermsParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const damlArgs: Fairmint.OpenCapTable.Issuer.CreateVestingTerms = {
    vesting_terms_data: vestingTermsDataToDaml(params.vestingTermsData)
  } as any;

  // Normalize Optional fields for JSON API: use direct value for Some, null for None
  const choiceArguments: any = {
    vesting_terms_data: {
      ...damlArgs.vesting_terms_data,
      vesting_conditions: (damlArgs as any).vesting_terms_data.vesting_conditions.map((c: any) => {
        const portion = c.portion && c.portion.tag === 'Some' ? c.portion.value : null;
        const trigger = ((): any => {
          if (c.trigger && typeof c.trigger === 'object' && 'tag' in c.trigger) {
            return 'value' in c.trigger ? c.trigger : { ...c.trigger, value: null };
          }
          return c.trigger;
        })();
        return {
          ...c,
          portion,
          trigger,
        };
      })
    }
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateVestingTerms',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}
