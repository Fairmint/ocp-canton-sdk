import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  buildRestateCommand,
  CapTableRestate,
  readRestateResult,
} from '../../src/functions/OpenCapTable/capTable/restate';
import type { RestateOperation, StateRestatement } from '../../src/types/register';
import { baseBook, stakeholder } from '../register/bookFixtures';
import {
  ANCHOR,
  anchorExercise,
  asClient,
  DAML_INPUTS,
  decodeChoice,
  exerciseOf,
  INPUTS,
  issuance,
  mockLedger,
  STAKEHOLDER,
  transaction,
  TRANSFER_AGENT,
} from './capTableFixtures';

const PARAMS = { capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, inputs: INPUTS };

const RESTATED: StateRestatement = {
  security_id: 'S-A1',
  issue_date: '2024-01-01',
  last_event_date: '2025-02-01',
  origin_transaction_id: 'ISS-S-A1',
  quantity: '900.0',
  stakeholder_id: 'SH-A',
  stock_class_id: 'CLS-A',
  vesting: { kind: 'on_terms', vesting_terms_id: 'VT-4Y' },
  snapshot: { as_of: '2025-01-01', vested: '300' },
  accelerated_since_snapshot: '25',
};

function restateArgument(command: { command: unknown }): Fairmint.OpenCapTable.CapTable.CapTable_Restate {
  return decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Restate, exerciseOf(command).choiceArgument);
}

describe('CapTableRestate', () => {
  it('builds CapTable_Restate as the transfer agent with every operation kind', () => {
    const corrected = issuance({ quantity: '900' });
    const command = new CapTableRestate(PARAMS)
      .edit('stockIssuance', corrected)
      .setState(RESTATED)
      .setState({
        ...RESTATED,
        security_id: 'S-A9',
        vesting: { kind: 'tranches', tranches: [{ date: '2025-01-01', amount: '10' }] },
        snapshot: null,
        accelerated_since_snapshot: null,
        seq: 4,
      })
      .delete('SH-OLD')
      .endState('S-A3')
      .build();

    expect(command.actAs).toEqual([TRANSFER_AGENT]);
    expect(exerciseOf(command)).toMatchObject({
      templateId: OCP_TEMPLATES.capTable,
      contractId: ANCHOR,
      choice: 'CapTable_Restate',
    });
    const argument = restateArgument(command);
    expect(argument.inputs).toEqual(DAML_INPUTS);
    expect(argument.operations).toEqual([
      { tag: 'RestateEdit', value: convertToDaml('stockIssuance', corrected) },
      {
        tag: 'RestateSetState',
        value: {
          security_id: 'S-A1',
          issue_date: '2024-01-01',
          last_event_date: '2025-02-01',
          origin_transaction_id: 'ISS-S-A1',
          quantity: '900',
          stakeholder_id: 'SH-A',
          stock_class_id: 'CLS-A',
          vesting: { tag: 'StockVestingOnTerms', value: 'VT-4Y' },
          snapshot: { as_of: '2025-01-01', vested: '300' },
          accelerated_since_snapshot: '25',
          seq: null,
        },
      },
      {
        tag: 'RestateSetState',
        value: expect.objectContaining({
          security_id: 'S-A9',
          vesting: { tag: 'StockVestingTranches', value: [{ amount: '10', date: '2025-01-01' }] },
          snapshot: null,
          accelerated_since_snapshot: null,
          seq: '4',
        }),
      },
      { tag: 'RestateDelete', value: 'SH-OLD' },
      { tag: 'RestateEndState', value: 'S-A3' },
    ]);
  });

  it('requires accelerated_since_snapshot to be stated and a recreating seq to be non-negative', () => {
    const { accelerated_since_snapshot: _, ...unstated } = RESTATED;
    expect(() => new CapTableRestate(PARAMS).setState(unstated as StateRestatement)).toThrow(
      'A restated state states the shares accelerated since its snapshot (null for none)'
    );
    expect(() => new CapTableRestate(PARAMS).setState({ ...RESTATED, seq: -1 })).toThrow(
      "a state's seq is not negative"
    );
  });

  it('refuses a record edited or deleted twice, an empty restatement and one over 500 operations', () => {
    const restatement = new CapTableRestate(PARAMS).edit('stakeholder', STAKEHOLDER);
    expect(() => restatement.delete('SH-B')).toThrow(
      'record SH-B is edited or deleted more than once in one restatement'
    );
    expect(() => new CapTableRestate(PARAMS).build()).toThrow('CapTable_Restate needs at least one operation');
    const large = new CapTableRestate(PARAMS);
    for (let index = 0; index <= 500; index++) large.endState(`S-${index}`);
    expect(() => large.build()).toThrow('CapTable_Restate touches at most 500 contracts');
  });

  it('refuses a hold record edit and an unknown operation', () => {
    const holdEdit = { kind: 'edit', type: 'stockHold', data: {} } as unknown as RestateOperation;
    expect(() => new CapTableRestate(PARAMS).operation(holdEdit)).toThrow('hold records are never restated');
    expect(() => new CapTableRestate(PARAMS).operation({ kind: 'rename' } as unknown as RestateOperation)).toThrow(
      'Unknown CapTable_Restate operation kind'
    );
    expect(() =>
      new CapTableRestate(PARAMS).operation({ kind: 'delete', objectId: 'X', type: 'stakeholder' } as RestateOperation)
    ).toThrow('Unexpected delete operation field type');
  });

  it('builds from a list, keeps metadata and submits through the client', async () => {
    const operations: RestateOperation[] = [
      { kind: 'edit', type: 'stakeholder', data: STAKEHOLDER },
      { kind: 'setState', state: RESTATED },
    ];
    const built = buildRestateCommand(PARAMS, operations);
    expect(restateArgument(built).operations).toHaveLength(2);

    const ledger = mockLedger();
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([
        anchorExercise('CapTable_Restate', {
          records: [['SH-B', { tag: 'OcfRecordCidStakeholder', value: 'cid-SH-B-2' }]],
          states: [['S-A1', 'state-S-A1-2']],
          epochs: [],
          shards: [],
        }),
      ])
    );
    const restatement = new CapTableRestate(PARAMS, asClient(ledger));
    for (const operation of operations) restatement.operation(operation);
    expect(restatement.getDetailedSummary()).toEqual([
      { index: 0, kind: 'edit', entityType: 'stakeholder', id: 'SH-B' },
      { index: 1, kind: 'setState', securityId: 'S-A1' },
    ]);
    const result = await restatement.execute();
    expect(result.records.get('SH-B')).toEqual({ entityType: 'stakeholder', contractId: 'cid-SH-B-2' });
    expect(result.states.get('S-A1')).toBe('state-S-A1-2');
    expect(ledger.submitAndWaitForTransaction.mock.calls[0]?.[0]).toMatchObject({ actAs: [TRANSFER_AGENT] });
    expect(restatement.clear().isEmpty).toBe(true);
  });

  it('resolves the inputs from a key index when none are given', () => {
    const index = baseBook().index();
    const built = new CapTableRestate({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, index })
      .edit('stakeholder', { ...stakeholder('SH-B'), comments: ['Renamed'] })
      .build();
    expect(restateArgument(built).inputs).toEqual({
      states: [],
      epochs: [],
      shards: [],
      records: [{ tag: 'OcfRecordCidStakeholder', value: 'cid-SH-B' }],
    });
    expect(() =>
      new CapTableRestate({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, index }).delete('SH-X').build()
    ).toThrow('record SH-X is not in this write');
    expect(() =>
      new CapTableRestate({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT }).delete('SH-OLD').build()
    ).toThrow('Give the restatement its inputs, or a key index to resolve them from');
  });

  it('refuses to execute without a client', async () => {
    await expect(new CapTableRestate(PARAMS).delete('SH-OLD').execute()).rejects.toThrow(
      'Cannot execute without a client'
    );
  });
});

describe('readRestateResult', () => {
  it('reads the result from the anchor exercise', () => {
    const response = transaction([
      anchorExercise('CapTable_Restate', {
        records: [],
        states: [],
        epochs: [['CLS-A', 'epoch-2']],
        shards: [['00000001', 'shard-2']],
      }),
    ]);
    const result = readRestateResult(response, { capTableContractId: ANCHOR });
    expect(result.epochs.get('CLS-A')).toBe('epoch-2');
    expect(result.shards.get('00000001')).toBe('shard-2');
  });
});
