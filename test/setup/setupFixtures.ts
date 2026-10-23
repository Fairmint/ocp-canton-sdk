/**
 * Shared fixtures of the three-step setup tests: the parties, canned ledger transactions and active-contract items.
 */
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { JsGetActiveContractsResponseItem } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/state';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { INITIAL_SHARD_PREFIXES } from '../../src/register/ids';
import type { SubmitAndWaitForTransactionResponse } from '../../src/types/common';
import type { OcfIssuer } from '../../src/types/native';
import type { IssuerAuthorizationRef } from '../../src/types/setup';

export const SYSTEM_OPERATOR = 'system-operator::1220aaaa';
export const ISSUER = 'issuer::1220bbbb';
export const TRANSFER_AGENT = 'transfer-agent::1220cccc';
export const FACTORY_ID = 'acme';
export const CAP_TABLE_ID = `${FACTORY_ID}-1`;

export const FACTORY_TEMPLATE_ID = Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateIdWithPackageId;
export const AUTHORIZATION_TEMPLATE_ID =
  Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateIdWithPackageId;
export const FACTORY_TEMPLATE_NAME = Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId;
export const AUTHORIZATION_TEMPLATE_NAME = Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId;

export const ISSUER_DATA: OcfIssuer = {
  object_type: 'ISSUER',
  id: 'issuer-001',
  legal_name: 'Acme Inc.',
  formation_date: '2024-01-15',
  country_of_formation: 'US',
};

export function context(overrides: Partial<Record<'issuer' | 'system_operator' | 'transfer_agent', string>> = {}) {
  return {
    cap_table_id: CAP_TABLE_ID,
    issuer: ISSUER,
    system_operator: SYSTEM_OPERATOR,
    transfer_agent: TRANSFER_AGENT,
    ...overrides,
  };
}

export function transaction(
  events: unknown[],
  overrides: Record<string, unknown> = {}
): SubmitAndWaitForTransactionResponse {
  return {
    transaction: {
      updateId: 'update-1',
      commandId: 'command-1',
      workflowId: '',
      effectiveAt: '2026-10-22T00:00:00Z',
      offset: 42,
      events,
      synchronizerId: 'synchronizer-1',
      recordTime: '2026-10-22T00:00:00Z',
      ...overrides,
    },
  } as unknown as SubmitAndWaitForTransactionResponse;
}

export function createdEvent(contractId: string, templateId: string, createArgument: unknown, extra: object = {}) {
  return { CreatedEvent: { contractId, templateId, createArgument, ...extra } };
}

export function exercisedEvent(
  contractId: string,
  templateId: string,
  choice: string,
  exerciseResult: unknown,
  consuming = true
) {
  return {
    ExercisedEvent: { contractId, templateId, choice, choiceArgument: {}, consuming, exerciseResult },
  };
}

/** A factory's create argument as the ledger reports it. */
export function factoryArgument(
  overrides: Partial<Record<'system_operator' | 'factory_id' | 'next_cap_table_number', string>> = {}
) {
  return {
    system_operator: SYSTEM_OPERATOR,
    factory_id: FACTORY_ID,
    next_cap_table_number: '1',
    ...overrides,
  };
}

/** An active-contracts item holding one factory. */
export function factoryItem(
  contractId: string,
  createArgument: unknown = factoryArgument(),
  templateId = FACTORY_TEMPLATE_ID
): JsGetActiveContractsResponseItem {
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: { contractId, templateId, createArgument },
        synchronizerId: 'synchronizer-1',
        reassignmentCounter: 0,
      },
    },
  } as unknown as JsGetActiveContractsResponseItem;
}

/** A ledger client whose active contracts and events are scripted per test. */
export function mockLedger(): jest.Mocked<
  Pick<LedgerJsonApiClient, 'submitAndWaitForTransaction' | 'getActiveContracts' | 'getEventsByContractId'>
> {
  return {
    submitAndWaitForTransaction: jest.fn(),
    getActiveContracts: jest.fn(),
    getEventsByContractId: jest.fn(),
  };
}

/** The authorization `acceptIssuerAuthorization` returns, for the builder tests. */
export function authorizationRef(overrides: Partial<IssuerAuthorizationRef> = {}): IssuerAuthorizationRef {
  return {
    contractId: 'authorization-accepted',
    templateId: AUTHORIZATION_TEMPLATE_ID,
    createdEventBlob: 'blob-accepted',
    synchronizerId: 'synchronizer-1',
    capTableId: CAP_TABLE_ID,
    issuer: ISSUER,
    systemOperator: SYSTEM_OPERATOR,
    transferAgent: TRANSFER_AGENT,
    ...overrides,
  };
}

/** The 256 initial shards of a created cap table, as the ledger encodes the `Map Text (ContractId OcfIdShard)`. */
export function initialShardEntries(): Array<[string, string]> {
  return INITIAL_SHARD_PREFIXES.map((prefix) => [prefix, `shard-${prefix}`]);
}
