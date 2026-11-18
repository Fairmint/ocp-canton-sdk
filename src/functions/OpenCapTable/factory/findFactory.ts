import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import { moduleEntityOf } from '../../../register/templates';
import type { LiveOcpFactory } from '../../../types/setup';
import { decodeGeneratedDaml, generatedCodec } from '../../../utils/generatedDamlValidation';
import { requireSetupParty, validateFactoryId } from './factoryIdentity';

export type { LiveOcpFactory } from '../../../types/setup';

export interface FindFactoryParams {
  /** The party that signs the factory; the query runs as this party's view */
  systemOperator: string;
  factoryId: string;
  /** Override when your ledger uses a different `OcpFactory` template ID than this SDK's bundled default. */
  templateId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The created events of an active-contracts response, leaving out entries that carry no contract. */
function activeCreatedEvents(items: readonly unknown[]): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const [index, item] of items.entries()) {
    const entry = isRecord(item) ? item.contractEntry : undefined;
    if (!isRecord(entry)) {
      throw new OcpParseError('Active contracts item has a malformed contractEntry', {
        source: `activeContracts[${index}]`,
        code: OcpErrorCodes.INVALID_RESPONSE,
      });
    }
    const active = entry.JsActiveContract;
    if (!isRecord(active)) continue;
    if (!isRecord(active.createdEvent)) {
      throw new OcpParseError('Active contract has no created event', {
        source: `activeContracts[${index}]`,
        code: OcpErrorCodes.INVALID_RESPONSE,
      });
    }
    events.push(active.createdEvent);
  }
  return events;
}

/**
 * Find the live `OcpFactory` of an identity.
 *
 * Every authorization consumes the factory and recreates it, so no contract ID is stable. The live contract is the
 * one active `OcpFactory` whose `system_operator` and `factory_id` are the identity's.
 *
 * @throws OcpContractError (`CONTRACT_NOT_FOUND`) when no active factory has the identity
 * @throws OcpContractError (`SCHEMA_MISMATCH`, `ambiguous_factory`) when more than one does
 */
export async function findFactory(client: LedgerJsonApiClient, params: FindFactoryParams): Promise<LiveOcpFactory> {
  requireSetupParty(params.systemOperator, 'systemOperator');
  validateFactoryId(params.factoryId);

  const templateId = params.templateId ?? OCP_TEMPLATES.ocpFactory;
  const expectedModuleEntity = moduleEntityOf(templateId);
  const items: readonly unknown[] = await client.getActiveContracts({
    parties: [params.systemOperator],
    templateIds: [templateId],
    includeCreatedEventBlob: false,
  });

  const matches: LiveOcpFactory[] = [];
  for (const [index, event] of activeCreatedEvents(items).entries()) {
    const { contractId, templateId: eventTemplateId } = event;
    if (typeof contractId !== 'string' || typeof eventTemplateId !== 'string') {
      throw new OcpParseError('Active factory has no contract ID or template ID', {
        source: `activeContracts[${index}]`,
        code: OcpErrorCodes.INVALID_RESPONSE,
      });
    }
    if (moduleEntityOf(eventTemplateId) !== expectedModuleEntity) continue;
    const factory = decodeGeneratedDaml(
      event.createArgument,
      generatedCodec(Fairmint.OpenCapTable.OcpFactory.OcpFactory),
      `factory ${contractId}.createArgument`
    );
    if (factory.system_operator !== params.systemOperator || factory.factory_id !== params.factoryId) continue;
    const nextCapTableNumber = Number(factory.next_cap_table_number);
    if (!Number.isSafeInteger(nextCapTableNumber) || nextCapTableNumber < 1) {
      throw new OcpParseError(
        `The factory's next cap table number is not a positive integer: ${factory.next_cap_table_number}`,
        {
          source: `factory ${contractId}.createArgument.next_cap_table_number`,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
        }
      );
    }
    matches.push({
      contractId,
      templateId: eventTemplateId,
      factoryId: factory.factory_id,
      systemOperator: factory.system_operator,
      nextCapTableNumber,
    });
  }

  const [factory, ...others] = matches;
  if (factory === undefined) {
    throw new OcpContractError(
      `No active OcpFactory for system operator ${params.systemOperator} and factory ID ${params.factoryId}`,
      {
        templateId,
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        classification: 'factory_not_found',
        context: { systemOperator: params.systemOperator, factoryId: params.factoryId },
      }
    );
  }
  if (others.length > 0) {
    throw new OcpContractError(
      `The OcpFactory for system operator ${params.systemOperator} and factory ID ${params.factoryId} is ambiguous: ${matches.length} active contracts`,
      {
        templateId,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'ambiguous_factory',
        context: {
          systemOperator: params.systemOperator,
          factoryId: params.factoryId,
          contractIds: matches.map((match) => match.contractId),
        },
      }
    );
  }
  return factory;
}
