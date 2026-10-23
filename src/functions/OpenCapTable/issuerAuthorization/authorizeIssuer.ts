import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { submitObservedTransaction, type CommandObservabilityOptions } from '../../../observability';
import type { AuthorizeIssuerResult } from '../../../types/setup';
import { decodeGeneratedDaml, generatedCodec } from '../../../utils/generatedDamlValidation';
import { requireSetupParty, validateFactoryId } from '../factory/factoryIdentity';
import { findFactory } from '../factory/findFactory';
import { requireExerciseResult } from '../shared/exerciseResult';

export type { AuthorizeIssuerResult } from '../../../types/setup';

const AUTHORIZE_ISSUER_CHOICE = 'OcpFactory_AuthorizeIssuer';

export interface AuthorizeIssuerParams extends CommandObservabilityOptions {
  /** The factory's `system_operator`: the transaction is submitted as this party. */
  systemOperator: string;
  /** The factory's `factory_id`. */
  factoryId: string;
  /** The party that will own the cap table. */
  issuer: string;
  /** The issuer's transfer agent, pinned by the authorization: a party other than the issuer and `systemOperator`. */
  transferAgent: string;
  /**
   * The live factory contract, when the caller holds it (the previous authorization's `factoryContractId`). When
   * omitted, the factory is found by `findFactory`.
   */
  factoryContractId?: string;
  /** Override when your ledger uses a different `OcpFactory` template ID than this SDK's bundled default. */
  templateId?: string;
}

/**
 * Step 1 of the cap table setup: `system_operator` takes the next cap table ID from the factory and creates the
 * `IssuerAuthorization` that pins the issuer's transfer agent. The authorization is not usable until the transfer
 * agent accepts it (`acceptIssuerAuthorization`).
 *
 * The factory is consumed and recreated, so authorizations through one factory are submitted one at a time.
 *
 * @throws OcpValidationError when the issuer, the system operator and the transfer agent are not three distinct
 * parties (the ledger refuses the choice too: without a distinct pinned transfer agent the issuer could name itself)
 * @throws OcpContractError when the factory is not found or the transaction carries no result
 */
export async function authorizeIssuer(
  client: LedgerJsonApiClient,
  params: AuthorizeIssuerParams
): Promise<AuthorizeIssuerResult> {
  requireSetupParty(params.systemOperator, 'systemOperator');
  requireSetupParty(params.issuer, 'issuer');
  requireSetupParty(params.transferAgent, 'transferAgent');
  validateFactoryId(params.factoryId);
  if (
    params.issuer === params.systemOperator ||
    params.issuer === params.transferAgent ||
    params.systemOperator === params.transferAgent
  ) {
    throw new OcpValidationError(
      'transferAgent',
      'The issuer, the system operator and the transfer agent must be three distinct parties',
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: {
          issuer: params.issuer,
          systemOperator: params.systemOperator,
          transferAgent: params.transferAgent,
        },
      }
    );
  }

  let factoryRef: { contractId: string; templateId: string };
  if (params.factoryContractId === undefined) {
    const factory = await findFactory(client, {
      systemOperator: params.systemOperator,
      factoryId: params.factoryId,
      ...(params.templateId !== undefined ? { templateId: params.templateId } : {}),
    });
    factoryRef = { contractId: factory.contractId, templateId: factory.templateId };
  } else if (params.factoryContractId === '') {
    throw new OcpValidationError('factoryContractId', 'The factory contract ID, when given, must be non-empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  } else {
    factoryRef = {
      contractId: params.factoryContractId,
      templateId: params.templateId ?? OCP_TEMPLATES.ocpFactory,
    };
  }
  const { contractId: factoryContractId, templateId } = factoryRef;

  const choiceArgument: Fairmint.OpenCapTable.OcpFactory.OcpFactory_AuthorizeIssuer = {
    issuer: params.issuer,
    transfer_agent: params.transferAgent,
  };
  const response = await submitObservedTransaction(
    client,
    {
      commands: [
        {
          ExerciseCommand: {
            templateId,
            contractId: factoryContractId,
            choice: AUTHORIZE_ISSUER_CHOICE,
            choiceArgument,
          },
        },
      ],
      actAs: [params.systemOperator],
    },
    params,
    { operation: 'authorizeIssuer', templateId, choice: AUTHORIZE_ISSUER_CHOICE }
  );

  const result = decodeGeneratedDaml(
    requireExerciseResult(response, { templateId, choice: AUTHORIZE_ISSUER_CHOICE, contractId: factoryContractId }),
    generatedCodec(Fairmint.OpenCapTable.OcpFactory.OcpFactory_AuthorizeIssuerResult),
    `${AUTHORIZE_ISSUER_CHOICE}.exerciseResult`
  );
  const authorizationCreated = findCreatedEventByTemplateId(response, OCP_TEMPLATES.issuerAuthorization);
  const authorizationTemplateId =
    authorizationCreated?.contractId === result.authorization
      ? authorizationCreated.templateId
      : OCP_TEMPLATES.issuerAuthorization;

  return {
    updateId: response.transaction.updateId,
    factoryContractId: result.factory,
    authorizationContractId: result.authorization,
    authorizationTemplateId,
    capTableId: result.cap_table_id,
    response,
  };
}
