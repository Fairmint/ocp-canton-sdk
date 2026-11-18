import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildFreezeClassCommand,
  buildUnfreezeClassCommand,
  readFreezeClassResult,
  readUnfreezeClassResult,
} from '../../src/functions/OpenCapTable/capTable/classFreeze';
import {
  buildBeginTeardownCommand,
  buildCloseCommand,
  buildPurgeCommand,
  readBeginTeardownResult,
  readCloseResult,
} from '../../src/functions/OpenCapTable/capTable/teardown';
import type { PurgeTarget } from '../../src/types/register';
import {
  ANCHOR,
  SYSTEM_OPERATOR,
  TRANSFER_AGENT,
  anchorExercise,
  decodeChoice,
  exerciseOf,
  transaction,
} from './capTableFixtures';

describe('class freeze', () => {
  it('builds CapTable_FreezeClass and CapTable_UnfreezeClass on the epoch, as the transfer agent', () => {
    const params = { capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT, epochContractId: 'epoch-CLS-A' };
    const freeze = buildFreezeClassCommand(params);
    const unfreeze = buildUnfreezeClassCommand(params);
    expect(freeze.actAs).toEqual([TRANSFER_AGENT]);
    expect(exerciseOf(freeze).choice).toBe('CapTable_FreezeClass');
    expect(exerciseOf(unfreeze).choice).toBe('CapTable_UnfreezeClass');
    expect(
      decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_FreezeClass, exerciseOf(freeze).choiceArgument)
    ).toEqual({
      epoch: 'epoch-CLS-A',
    });
    expect(
      decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_UnfreezeClass, exerciseOf(unfreeze).choiceArgument)
    ).toEqual({ epoch: 'epoch-CLS-A' });
    expect(() => buildFreezeClassCommand({ ...params, epochContractId: '' })).toThrow(
      "Validation error at 'epochContractId'"
    );
  });

  it('reads the recreated epoch', () => {
    expect(readFreezeClassResult(transaction([anchorExercise('CapTable_FreezeClass', 'epoch-frozen')]))).toBe(
      'epoch-frozen'
    );
    expect(
      readUnfreezeClassResult(transaction([anchorExercise('CapTable_UnfreezeClass', 'epoch-open')]), {
        capTableContractId: ANCHOR,
      })
    ).toBe('epoch-open');
    expect(() => readFreezeClassResult(transaction([anchorExercise('CapTable_UnfreezeClass', 'epoch-open')]))).toThrow(
      'CapTable_FreezeClass result not found in transaction'
    );
    expect(() => readFreezeClassResult(transaction([anchorExercise('CapTable_FreezeClass', '')]))).toThrow(
      'Empty contract ID'
    );
  });
});

describe('teardown', () => {
  it('begins teardown as the transfer agent and closes as system_operator', () => {
    const begin = buildBeginTeardownCommand({ capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT });
    const close = buildCloseCommand({ capTableContractId: 'anchor-tearing-down', systemOperator: SYSTEM_OPERATOR });
    expect(begin.actAs).toEqual([TRANSFER_AGENT]);
    expect(exerciseOf(begin)).toMatchObject({
      contractId: ANCHOR,
      choice: 'CapTable_BeginTeardown',
      choiceArgument: {},
    });
    expect(close.actAs).toEqual([SYSTEM_OPERATOR]);
    expect(exerciseOf(close)).toMatchObject({
      contractId: 'anchor-tearing-down',
      choice: 'CapTable_Close',
      choiceArgument: {},
    });
    expect(
      readBeginTeardownResult(
        transaction([anchorExercise('CapTable_BeginTeardown', 'anchor-tearing-down', { consuming: true })])
      )
    ).toBe('anchor-tearing-down');
    expect(
      readCloseResult(
        transaction([
          anchorExercise('CapTable_Close', 'anchor-closed', { contractId: 'anchor-tearing-down', consuming: true }),
        ]),
        { capTableContractId: 'anchor-tearing-down' }
      )
    ).toBe('anchor-closed');
  });

  it('purges up to 500 contracts of every kind as system_operator', () => {
    const targets: PurgeTarget[] = [
      { kind: 'record', entityType: 'stockIssuance', contractId: 'cid-ISS' },
      { kind: 'state', contractId: 'state-1' },
      { kind: 'epoch', contractId: 'epoch-1' },
      { kind: 'shard', contractId: 'shard-1' },
    ];
    const command = buildPurgeCommand({ capTableContractId: ANCHOR, systemOperator: SYSTEM_OPERATOR, targets });
    expect(command.actAs).toEqual([SYSTEM_OPERATOR]);
    expect(decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Purge, exerciseOf(command).choiceArgument)).toEqual({
      targets: [
        { tag: 'PurgeRecord', value: { tag: 'OcfRecordCidStockIssuance', value: 'cid-ISS' } },
        { tag: 'PurgeState', value: 'state-1' },
        { tag: 'PurgeEpoch', value: 'epoch-1' },
        { tag: 'PurgeShard', value: 'shard-1' },
      ],
    });

    const purge = (list: PurgeTarget[]) => () =>
      buildPurgeCommand({ capTableContractId: ANCHOR, systemOperator: SYSTEM_OPERATOR, targets: list });
    const many = (count: number): PurgeTarget[] =>
      Array.from({ length: count }, (_, index) => ({ kind: 'state', contractId: `state-${index}` }));
    expect(purge(many(500))).not.toThrow();
    expect(purge(many(501))).toThrow('CapTable_Purge archives at most 500 contracts');
    expect(purge([])).toThrow('CapTable_Purge needs at least one contract');
    expect(purge([targets[1]!, targets[1]!])).toThrow('each contract is purged once');
    expect(purge([{ kind: 'record', entityType: 'nope', contractId: 'cid' } as unknown as PurgeTarget])).toThrow(
      'Unknown OCF entity type'
    );
    expect(purge([{ kind: 'anchor', contractId: 'cid' } as unknown as PurgeTarget])).toThrow(
      'Unknown purge target kind'
    );
  });
});
