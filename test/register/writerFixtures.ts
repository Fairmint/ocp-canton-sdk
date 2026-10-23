/**
 * A register writer over the fake ledger for the off-ledger checks and the split procedure: the checks' book with its
 * anchor, a clock on the checks' ledger date, and the ledger effects of the anchor choices those tests commit.
 */

import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { InProcessLockProvider } from '../../src/register/locks';
import type { RegisterIndex } from '../../src/register/registerIndex';
import { RegisterWriter, type RegisterWriterOptions } from '../../src/register/writer';
import type { OcfStockClassSplit, OcfStockIssuance } from '../../src/types/native';
import { ANCHOR, ANCHOR_TEMPLATE_ID, anchorExercise } from '../capTable/capTableFixtures';
import type { TestBook } from './bookFixtures';
import { CONTEXT } from './bookFixtures';
import { TODAY } from './checkFixtures';
import { FakeLedger, steppingClock, type LedgerEffects } from './fakeLedger';
import { damlData, epochEvent, recordEvent, stateEvent } from './registerLedgerFixtures';

export const TA = CONTEXT.transfer_agent;

/** The writer clock's start: noon UTC on the checks' ledger date. */
export const NOON_TODAY = Date.parse(`${TODAY}T12:00:00Z`);

/** A book's index with the anchor, as a writer reads it. */
export function anchoredIndex(book: TestBook): RegisterIndex {
  const index = book.index();
  index.add({
    kind: 'anchor',
    context: CONTEXT,
    contract: { contractId: ANCHOR, templateId: ANCHOR_TEMPLATE_ID, createdOffset: 1, status: 'ACTIVE' },
  });
  return index;
}

export interface WriterHarness {
  ledger: FakeLedger;
  locks: InProcessLockProvider;
  writer: RegisterWriter;
}

export function writerHarness(index: RegisterIndex, options: Partial<RegisterWriterOptions> = {}): WriterHarness {
  const ledger = new FakeLedger();
  const locks = new InProcessLockProvider();
  const writer = new RegisterWriter({
    ledger: ledger.asClient(),
    context: CONTEXT,
    transferAgent: TA,
    index,
    locks,
    clock: steppingClock(NOON_TODAY),
    outcome: { timeoutMs: 5_000, pollMs: 1_000 },
    lockTimeoutMs: 5_000,
    ...options,
  });
  return { ledger, locks, writer };
}

function exercised(choice: string, result: unknown): Record<string, unknown> {
  return anchorExercise(choice, result).ExercisedEvent as Record<string, unknown>;
}

const numeric10 = (decimal: string): string => (decimal.includes('.') ? decimal : `${decimal}.0000000000`);

/** What `CapTable_Apply` of one primary stock issuance commits: the record and the security's state. */
export function issuanceEffects(issuance: OcfStockIssuance): LedgerEffects {
  const { id, security_id: securityId } = issuance;
  return {
    created: [
      recordEvent(`cid-${id}`, 'stockIssuance', damlData('stockIssuance', { ...issuance })),
      stateEvent(`state-${securityId}`, {
        security_id: securityId,
        issue_date: issuance.date,
        last_event_date: issuance.date,
        origin_transaction_id: id,
        quantity: numeric10(issuance.quantity),
        seq: '0',
        split_epoch: '0',
        stakeholder_id: issuance.stakeholder_id,
        stock_class_id: issuance.stock_class_id,
        holds: [],
        derived_ids: false,
      }),
    ],
    exercised: [
      exercised('CapTable_Apply', {
        records: [[id, { tag: ENTITY_REGISTRY.stockIssuance.cidTag, value: `cid-${id}` }]],
        states: [[securityId, `state-${securityId}`]],
        epochs: [],
        shards: [],
      }),
    ],
  };
}

function splitWire(split: OcfStockClassSplit): Record<string, unknown> {
  return {
    split_id: split.id,
    date: split.date,
    ratio: { numerator: numeric10(split.split_ratio.numerator), denominator: numeric10(split.split_ratio.denominator) },
  };
}

/** What `CapTable_FreezeClass` or `CapTable_UnfreezeClass` commits: the epoch archived and recreated. */
export function epochEffects(
  choice: 'CapTable_FreezeClass' | 'CapTable_UnfreezeClass',
  stockClassId: string,
  from: string,
  to: string,
  splits: readonly OcfStockClassSplit[] = []
): LedgerEffects {
  return {
    archived: [from],
    created: [epochEvent(to, stockClassId, splits.map(splitWire), { frozen: choice === 'CapTable_FreezeClass' })],
    exercised: [exercised(choice, to)],
  };
}

/** What `CapTable_Apply` of a split commits: its record, and the class's next epoch, still frozen. */
export function splitEffects(
  split: OcfStockClassSplit,
  from: string,
  to: string,
  earlier: readonly OcfStockClassSplit[] = []
): LedgerEffects {
  return {
    archived: [from],
    created: [
      recordEvent(`cid-${split.id}`, 'stockClassSplit', damlData('stockClassSplit', { ...split })),
      epochEvent(to, split.stock_class_id, [...earlier, split].map(splitWire), { frozen: true }),
    ],
    exercised: [
      exercised('CapTable_Apply', {
        records: [[split.id, { tag: ENTITY_REGISTRY.stockClassSplit.cidTag, value: `cid-${split.id}` }]],
        states: [],
        epochs: [[split.stock_class_id, to]],
        shards: [],
      }),
    ],
  };
}

/** The anchor choices a fake ledger was asked to exercise, in order. */
export function choicesOf(ledger: FakeLedger): string[] {
  return ledger.submitted.map((submission) => {
    const [command] = submission.commands as Array<{ ExerciseCommand?: { choice?: string } }>;
    return command?.ExerciseCommand?.choice ?? '';
  });
}
