import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { findCreatedEventByTemplateId } from '../../../types/common';

export interface CreateFactoryParams {
  /** Party ID that will own the factory (submits the create as this party). */
  systemOperator: string;
}

export interface CreateFactoryResult {
  contractId: string;
  templateId: string;
  updateId: string;
}

/**
 * Deploy a new OCP Factory contract on the ledger.
 *
 * Use this when setting up a custom Canton network (localnet, staging, or any deployment
 * that is not mainnet or devnet). After creating the factory, pass the result as
 * `factory` to `new OcpClient({ ledger, factory: result })`.
 *
 * On mainnet and devnet the factory is already deployed — you do not need to call this.
 */
export async function createFactory(
  client: LedgerJsonApiClient,
  params: CreateFactoryParams
): Promise<CreateFactoryResult> {
  const templateId = OCP_TEMPLATES.ocpFactory;
  const createArguments: Fairmint.OpenCapTable.OcpFactory.OcpFactory = {
    system_operator: params.systemOperator,
  };

  const response = await client.submitAndWaitForTransactionTree({
    commands: [
      {
        CreateCommand: {
          templateId,
          createArguments,
        },
      },
    ],
    actAs: [params.systemOperator],
  });

  const created = findCreatedEventByTemplateId(response, templateId);
  if (!created) {
    throw new OcpContractError('Expected CreatedTreeEvent not found for OcpFactory', {
      templateId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { contractId: createdContractId, templateId: createdTemplateId } = created.CreatedTreeEvent.value;

  return {
    contractId: createdContractId,
    templateId: createdTemplateId,
    updateId: response.transactionTree.updateId,
  };
}
