import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { submitObservedTransactionTree, type CommandObservabilityOptions } from '../../../observability';
import {
  optionalCommandParameter,
  requiredCommandParameter,
  requiredPartyId,
  requiredTrimmedString,
} from '../../../utils/commandParameters';
import { commandCarrierKeys, snapshotExactCommandCarrier } from '../../../utils/observabilityConfig';

const CREATE_FACTORY_KEYS = commandCarrierKeys(['systemOperator', 'templateId']);

export interface CreateFactoryParams extends CommandObservabilityOptions {
  /** Party ID that will own the factory (submits the create as this party). */
  systemOperator: string;
  /**
   * Override when your ledger uses a different `OcpFactory` template id than this SDK's
   * bundled default (`OCP_TEMPLATES.ocpFactory`).
   */
  templateId?: string;
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
  const carrier = snapshotExactCommandCarrier(params, CREATE_FACTORY_KEYS, 'createFactory');
  const systemOperator = requiredPartyId(
    requiredCommandParameter(carrier.snapshot, 'systemOperator', 'createFactory'),
    'createFactory.systemOperator'
  );
  const templateIdValue = optionalCommandParameter(carrier.snapshot, 'templateId', 'createFactory');
  const templateId =
    templateIdValue === undefined
      ? OCP_TEMPLATES.ocpFactory
      : requiredTrimmedString(templateIdValue, 'createFactory.templateId');
  const createArguments: Fairmint.OpenCapTable.OcpFactory.OcpFactory = {
    system_operator: systemOperator,
  };

  const response = await submitObservedTransactionTree(
    client,
    {
      commands: [
        {
          CreateCommand: {
            templateId,
            createArguments,
          },
        },
      ],
      actAs: [systemOperator],
    },
    carrier.observability,
    { operation: 'createFactory', templateId, choice: 'Create' }
  );

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
