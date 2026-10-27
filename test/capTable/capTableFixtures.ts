/**
 * Shared fixtures of the anchor choice tests: the cap table's parties and anchor, book inputs, a few native OCF
 * records, canned ledger-effects transactions and the JSON-wire form of choice results.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { SubmitAndWaitForTransactionResponse } from '../../src/types/common';
import type { OcfStakeholder, OcfStockIssuance, OcfStockTransfer } from '../../src/types/native';
import type { BookInputs } from '../../src/types/register';
import { decodeGeneratedDaml, generatedCodec } from '../../src/utils/generatedDamlValidation';
import { CONTEXT } from '../register/registerFixtures';

export { CONTEXT };

export const TRANSFER_AGENT = CONTEXT.transfer_agent;
export const SYSTEM_OPERATOR = CONTEXT.system_operator;
export const ANCHOR = 'cap-table-anchor-1';
/** The anchor's template ID as the Ledger API reports it (package-id form). */
export const ANCHOR_TEMPLATE_ID = Fairmint.OpenCapTable.CapTable.CapTable.templateIdWithPackageId;
/** The anchor's template ID as the SDK names it by default (package-name form). */
export const ANCHOR_TEMPLATE_NAME = Fairmint.OpenCapTable.CapTable.CapTable.templateId;

export const INPUTS: BookInputs = {
  states: ['state-S-A1'],
  epochs: ['epoch-CLS-A'],
  shards: ['shard-00000000'],
  records: [{ entityType: 'stakeholder', contractId: 'cid-SH-B' }],
};

/** The inputs as the generated `BookInputs` encodes them. */
export const DAML_INPUTS = {
  states: ['state-S-A1'],
  epochs: ['epoch-CLS-A'],
  shards: ['shard-00000000'],
  records: [{ tag: 'OcfRecordCidStakeholder', value: 'cid-SH-B' }],
};

export const STAKEHOLDER: OcfStakeholder = {
  object_type: 'STAKEHOLDER',
  id: 'SH-B',
  name: { legal_name: 'Buyer B' },
  stakeholder_type: 'INDIVIDUAL',
};

export function issuance(overrides: Partial<OcfStockIssuance> = {}): OcfStockIssuance {
  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id: 'ISS-S-A1',
    date: '2024-01-01',
    security_id: 'S-A1',
    custom_id: 'CS-A1',
    stakeholder_id: 'SH-A',
    stock_class_id: 'CLS-A',
    share_price: { amount: '1', currency: 'USD' },
    quantity: '1000',
    cost_basis: { amount: '1000', currency: 'USD' },
    stock_legend_ids: ['LEGEND-1'],
    security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
    ...overrides,
  };
}

export const TRANSFER: OcfStockTransfer = {
  object_type: 'TX_STOCK_TRANSFER',
  id: 'TR-1',
  date: '2025-03-01',
  security_id: 'S-A1',
  quantity: '400',
  resulting_security_ids: ['S-B1'],
  balance_security_id: 'S-A2',
};

/** A ledger client whose submissions are scripted per test. */
export function mockLedger(): jest.Mocked<Pick<LedgerJsonApiClient, 'submitAndWaitForTransaction'>> {
  return { submitAndWaitForTransaction: jest.fn() };
}

export function asClient(ledger: ReturnType<typeof mockLedger>): LedgerJsonApiClient {
  return ledger as unknown as LedgerJsonApiClient;
}

export function transaction(events: unknown[]): SubmitAndWaitForTransactionResponse {
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
    },
  } as unknown as SubmitAndWaitForTransactionResponse;
}

/** An exercised event of an anchor choice, as a ledger-effects transaction carries it. */
export function anchorExercise(
  choice: string,
  exerciseResult: unknown,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ExercisedEvent: {
      offset: 42,
      nodeId: 0,
      contractId: ANCHOR,
      templateId: ANCHOR_TEMPLATE_ID,
      packageName: 'OpenCapTable-v35',
      interfaceId: null,
      choice,
      choiceArgument: {},
      actingParties: [TRANSFER_AGENT],
      consuming: false,
      witnessParties: [TRANSFER_AGENT],
      lastDescendantNodeId: 0,
      exerciseResult,
      implementedInterfaces: [],
      acsDelta: true,
      ...extra,
    },
  };
}

/** The `ExerciseCommand` of a built command. */
export function exerciseOf(command: { command: unknown }): {
  templateId: string;
  contractId: string;
  choice: string;
  choiceArgument: unknown;
} {
  const wrapper = command.command as { ExerciseCommand?: unknown };
  if (wrapper.ExerciseCommand === undefined) throw new Error('expected an ExerciseCommand');
  return wrapper.ExerciseCommand as { templateId: string; contractId: string; choice: string; choiceArgument: unknown };
}

/**
 * Decode a built choice argument through its generated choice codec. `decodeGeneratedDaml` also proves the argument is
 * exactly the codec's JSON: re-encoding the decoded value gives it back.
 */
export function decodeChoice<T>(
  codec: { decoder: { runWithException(input: unknown): T }; encode(value: T): unknown },
  choiceArgument: unknown
): T {
  return decodeGeneratedDaml(choiceArgument, generatedCodec(codec), 'choiceArgument');
}
