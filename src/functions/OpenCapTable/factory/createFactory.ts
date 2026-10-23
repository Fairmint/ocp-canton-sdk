import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { submitObservedTransaction, type CommandObservabilityOptions } from '../../../observability';
import type { CreateFactoryResult } from '../../../types/setup';
import { requireSetupParty, validateFactoryId } from './factoryIdentity';

export type { CreateFactoryResult } from '../../../types/setup';

export interface CreateFactoryParams extends CommandObservabilityOptions {
  /** Party that signs the factory: the transaction is submitted as this party. */
  systemOperator: string;
  /**
   * The factory's `factory_id`: non-empty with no `:`. A cap table's ID is `<factoryId>-<n>`, so uniqueness across
   * factories is the system operator's to keep.
   */
  factoryId: string;
  /**
   * Override when your ledger uses a different `OcpFactory` template ID than this SDK's bundled default
   * (`OCP_TEMPLATES.ocpFactory`).
   */
  templateId?: string;
}

/**
 * Create an `OcpFactory` that gives each cap table its ID from a counter, starting at 1.
 *
 * Use this when setting up a stack that has no factory yet (LocalNet, staging). Each `OcpFactory_AuthorizeIssuer`
 * consumes the factory and recreates it with the next number, so keep the factory's identity (`factoryId` and
 * `systemOperator`) rather than its contract ID, and find the live contract with `findFactory`.
 *
 * @throws OcpValidationError when the system operator or factory ID is invalid
 */
export async function createFactory(
  client: LedgerJsonApiClient,
  params: CreateFactoryParams
): Promise<CreateFactoryResult> {
  requireSetupParty(params.systemOperator, 'systemOperator');
  validateFactoryId(params.factoryId);

  const templateId = params.templateId ?? OCP_TEMPLATES.ocpFactory;
  const createArguments: Fairmint.OpenCapTable.OcpFactory.OcpFactory = {
    system_operator: params.systemOperator,
    factory_id: params.factoryId,
    next_cap_table_number: '1',
  };

  const response = await submitObservedTransaction(
    client,
    {
      commands: [{ CreateCommand: { templateId, createArguments } }],
      actAs: [params.systemOperator],
    },
    params,
    { operation: 'createFactory', templateId, choice: 'Create' }
  );

  const created = findCreatedEventByTemplateId(response, templateId);
  if (!created) {
    throw new OcpContractError('Expected CreatedEvent not found for OcpFactory', {
      templateId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  return {
    contractId: created.contractId,
    templateId: created.templateId,
    factoryId: params.factoryId,
    systemOperator: params.systemOperator,
    updateId: response.transaction.updateId,
  };
}
