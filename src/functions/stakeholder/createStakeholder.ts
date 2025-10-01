import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStakeholderData, CommandWithDisclosedContracts, Name } from '../../types';
import { stakeholderTypeToDaml, contactInfoToDaml, contactInfoWithoutNameToDaml, addressToDaml } from '../../utils/typeConversions';

function nameToDaml(n: Name): Fairmint.OpenCapTable.Stakeholder.OcfName {
  return {
    legal_name: n.legal_name,
    first_name: n.first_name || null,
    last_name: n.last_name || null
  };
}

function stakeholderDataToDaml(data: OcfStakeholderData): Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData {
  if (!data.id) throw new Error('stakeholder.id is required');
  const payload: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData = {
    id: data.id,
    name: nameToDaml(data.name),
    stakeholder_type: stakeholderTypeToDaml(data.stakeholder_type),
    issuer_assigned_id: data.issuer_assigned_id || null,
    primary_contact: data.primary_contact ? contactInfoToDaml(data.primary_contact) : null,
    contact_info: data.contact_info ? contactInfoWithoutNameToDaml(data.contact_info) : null,
    addresses: (data.addresses || []).map(addressToDaml),
    tax_ids: (data.tax_ids || []),
    comments: data.comments || []
  } as any;
  
  const dataWithSingular = data as OcfStakeholderData & { current_relationship?: string };
  const relationships = data.current_relationships 
    || (dataWithSingular.current_relationship ? [dataWithSingular.current_relationship] : []);
  
  if (relationships && relationships.length) {
    const mapRel = (r: string): Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType => {
      const v = r.toUpperCase();
      if (v.includes('EMPLOYEE')) return 'OcfRelEmployee';
      if (v.includes('ADVISOR')) return 'OcfRelAdvisor';
      if (v.includes('INVESTOR')) return 'OcfRelInvestor';
      if (v.includes('FOUNDER')) return 'OcfRelFounder';
      if (v.includes('BOARD')) return 'OcfRelBoardMember';
      if (v.includes('OFFICER')) return 'OcfRelOfficer';
      return 'OcfRelOther';
    };
    payload.current_relationships = relationships.map(mapRel);
  }
  if (data.current_status) {
    const status: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderStatusType = (
      data.current_status === 'ACTIVE' ? 'OcfStakeholderStatusActive' :
      data.current_status === 'LEAVE_OF_ABSENCE' ? 'OcfStakeholderStatusLeaveOfAbsence' :
      data.current_status === 'TERMINATION_VOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationVoluntaryOther' :
      data.current_status === 'TERMINATION_VOLUNTARY_GOOD_CAUSE' ? 'OcfStakeholderStatusTerminationVoluntaryGoodCause' :
      data.current_status === 'TERMINATION_VOLUNTARY_RETIREMENT' ? 'OcfStakeholderStatusTerminationVoluntaryRetirement' :
      data.current_status === 'TERMINATION_INVOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationInvoluntaryOther' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DEATH' ? 'OcfStakeholderStatusTerminationInvoluntaryDeath' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DISABILITY' ? 'OcfStakeholderStatusTerminationInvoluntaryDisability' :
      'OcfStakeholderStatusTerminationInvoluntaryWithCause'
    );
    payload.current_status = status;
  }
  return payload;
}

export interface CreateStakeholderParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  stakeholderData: OcfStakeholderData;
}

export interface CreateStakeholderResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Create a stakeholder by exercising the CreateStakeholder choice on an Issuer contract
 */
export async function createStakeholder(
  client: LedgerJsonApiClient,
  params: CreateStakeholderParams
): Promise<CreateStakeholderResult> {
  const { command, disclosedContracts } = buildCreateStakeholderCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId,
    response
  };
}

export function buildCreateStakeholderCommand(params: CreateStakeholderParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStakeholder = {
    stakeholder_data: stakeholderDataToDaml(params.stakeholderData)
  } as any;

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStakeholder',
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
