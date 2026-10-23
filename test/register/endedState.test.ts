/**
 * Reading the state a record ended back from the ledger: the consumed `StockSecurity` of the transaction that wrote the
 * record, advanced by the operations before the record in the same `CapTable_Apply`, through any restatement of the
 * record since, and the failures.
 */

import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { applyOperationToDaml } from '../../src/functions/OpenCapTable/capTable/choiceArguments';
import { readEndedState } from '../../src/register/replication/endedState';
import type { ApplyOperation, RegisterRecord } from '../../src/types/register';
import { anchorExercise } from '../capTable/capTableFixtures';
import { stockAcceptance, stockTransfer } from './bookFixtures';
import { FakeLedger } from './fakeLedger';
import { CONTEXT } from './registerFixtures';
import { damlData, packageIdForm, recordEvent, stateEvent } from './registerLedgerFixtures';

const TRANSFER = stockTransfer({ quantity: '600', resulting_security_ids: ['S-B1'] });

function exercised(choice: string, operations: ApplyOperation[] | null): Record<string, unknown> {
  const choiceArgument =
    operations === null
      ? { inputs: { states: [], epochs: [], shards: [], records: [] }, operations: [] }
      : {
          inputs: { states: [], epochs: [], shards: [], records: [] },
          operations: operations.map((operation, index) => applyOperationToDaml(operation, `operations[${index}]`)),
        };
  return anchorExercise(choice, {}, { choiceArgument: JSON.parse(JSON.stringify(choiceArgument)) as unknown })
    .ExercisedEvent as Record<string, unknown>;
}

function consumer(contractId: string, createdOffset: number): RegisterRecord {
  return {
    contractId,
    templateId: packageIdForm(ENTITY_REGISTRY.stockTransfer.templateId),
    createdOffset,
    entityType: 'stockTransfer',
    objectId: 'TR-1',
    objectType: 'TX_STOCK_TRANSFER',
    securityIds: ['S-A1', 'S-B1'],
    data: TRANSFER,
  };
}

/** A ledger where S-A1's state (seq 3) is consumed by TR-1, after an acceptance on it in the same Apply. */
function ledgerWithTransfer(): { ledger: FakeLedger; transferOffset: number } {
  const ledger = new FakeLedger(0);
  ledger.commit({ created: [stateEvent('state-1', { security_id: 'S-A1', seq: '3', holds: [] })] });
  const acceptance = stockAcceptance('ACC-1', 'S-A1', '2024-02-01');
  const { offset } = ledger.commit({
    archived: ['state-1'],
    created: [recordEvent('cid-TR-1', 'stockTransfer', damlData('stockTransfer', { ...TRANSFER }))],
    exercised: [
      exercised('CapTable_Apply', [
        { kind: 'record', type: 'stockAcceptance', data: acceptance },
        {
          kind: 'stockTransfer',
          transfer: TRANSFER,
          resulting: [],
          balance: null,
        },
      ]),
    ],
  });
  return { ledger, transferOffset: offset };
}

const options = (record: RegisterRecord) => ({
  context: CONTEXT,
  consumer: record,
  securityId: 'S-A1',
  readAs: CONTEXT.transfer_agent,
});

describe('readEndedState', () => {
  it('reads the consumed state and adds the operations before the record that advanced it', async () => {
    const { ledger, transferOffset } = ledgerWithTransfer();
    const ended = await readEndedState(ledger.asClient(), options(consumer('cid-TR-1', transferOffset)));
    expect(ended.seq).toBe(4);
    expect(ended.state).toMatchObject({ security_id: 'S-A1', seq: 3 });
    expect(ledger.getUpdateByOffset).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: transferOffset,
        updateFormat: {
          includeTransactions: expect.objectContaining({
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
          }) as unknown,
        },
      })
    );
  });

  it('follows a record a restatement edited back to the transaction that ended the state', async () => {
    const { ledger } = ledgerWithTransfer();
    const edited = { ...TRANSFER, comments: ['corrected'] };
    const { offset } = ledger.commit({
      archived: ['cid-TR-1'],
      created: [recordEvent('cid-TR-1b', 'stockTransfer', damlData('stockTransfer', edited))],
      exercised: [exercised('CapTable_Restate', null)],
    });
    const ended = await readEndedState(ledger.asClient(), options(consumer('cid-TR-1b', offset)));
    expect(ended.seq).toBe(4);
  });

  it('refuses a transaction that ended no state of the security', async () => {
    const ledger = new FakeLedger(0);
    const { offset } = ledger.commit({
      created: [recordEvent('cid-TR-1', 'stockTransfer', damlData('stockTransfer', { ...TRANSFER }))],
    });
    await expect(readEndedState(ledger.asClient(), options(consumer('cid-TR-1', offset)))).rejects.toMatchObject({
      name: 'OcpContractError',
      classification: 'ended_state_not_found',
    });
    const restated = ledger.commit({ exercised: [exercised('CapTable_Restate', null)] });
    await expect(
      readEndedState(ledger.asClient(), options(consumer('cid-TR-1', restated.offset)))
    ).rejects.toMatchObject({ classification: 'ended_state_not_found' });
  });

  it('surfaces a failed read', async () => {
    const { ledger, transferOffset } = ledgerWithTransfer();
    ledger.getUpdateByOffset.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(
      readEndedState(ledger.asClient(), options(consumer('cid-TR-1', transferOffset)))
    ).rejects.toMatchObject({
      name: 'OcpNetworkError',
      classification: 'ended_state_read_failed',
    });
    ledger.getUpdateByOffset.mockResolvedValueOnce({ update: { Reassignment: { value: {} } } } as never);
    await expect(
      readEndedState(ledger.asClient(), options(consumer('cid-TR-1', transferOffset)))
    ).rejects.toMatchObject({
      name: 'OcpNetworkError',
      message: expect.stringContaining('is not a transaction') as unknown,
    });
    ledger.getEventsByContractId.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(
      readEndedState(ledger.asClient(), options(consumer('cid-TR-1', transferOffset)))
    ).rejects.toMatchObject({
      name: 'OcpNetworkError',
    });
  });
});
