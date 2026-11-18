import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  buildCancelHoldsCommand,
  buildPlaceHoldsCommand,
  readCancelHoldsResult,
  readPlaceHoldsResult,
} from '../../src/functions/OpenCapTable/capTable/holds';
import type { HoldType } from '../../src/types/native';
import type { CancelHold, PlaceHoldLot } from '../../src/types/register';
import {
  ANCHOR,
  DAML_INPUTS,
  INPUTS,
  TRANSFER_AGENT,
  anchorExercise,
  decodeChoice,
  exerciseOf,
  transaction,
} from './capTableFixtures';

const ANCHOR_REF = { capTableContractId: ANCHOR, transferAgent: TRANSFER_AGENT };

function placeHolds(lots: PlaceHoldLot[], holdType: HoldType = 'REGISTER_SETTLEMENT', reference = 'T-1') {
  return buildPlaceHoldsCommand({
    ...ANCHOR_REF,
    inputs: INPUTS,
    holdType,
    reference,
    date: '2025-06-02',
    reasonText: 'Trade T-1',
    lots,
  });
}

function cancelHolds(holds: CancelHold[]) {
  return buildCancelHoldsCommand({ ...ANCHOR_REF, inputs: INPUTS, date: '2025-06-02', holds });
}

const SETTLEMENT_LOT: PlaceHoldLot = { security_id: 'S-A1', quantity: '100.00', origin_issuance: 'cid-ISS-S-A1' };

describe('buildPlaceHoldsCommand', () => {
  it('builds settlement holds with quantities and origin issuances', () => {
    const command = placeHolds([
      SETTLEMENT_LOT,
      { security_id: 'S-A2', quantity: '5', origin_issuance: 'cid-ISS-S-A2' },
    ]);
    expect(command.actAs).toEqual([TRANSFER_AGENT]);
    expect(exerciseOf(command)).toMatchObject({ contractId: ANCHOR, choice: 'CapTable_PlaceHolds' });
    expect(
      decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_PlaceHolds, exerciseOf(command).choiceArgument)
    ).toEqual({
      inputs: DAML_INPUTS,
      hold_type: 'OcfHoldTypeRegisterSettlement',
      reference: 'T-1',
      date: '2025-06-02',
      reason_text: 'Trade T-1',
      lots: [
        { security_id: 'S-A1', quantity: '100', origin_issuance: 'cid-ISS-S-A1' },
        { security_id: 'S-A2', quantity: '5', origin_issuance: 'cid-ISS-S-A2' },
      ],
    });
  });

  it('builds a stop with no quantity or origin', () => {
    const command = placeHolds([{ security_id: 'S-A1' }], 'STOP_TRANSFER', 'CASE-1');
    const argument = decodeChoice(
      Fairmint.OpenCapTable.CapTable.CapTable_PlaceHolds,
      exerciseOf(command).choiceArgument
    );
    expect(argument.hold_type).toBe('OcfHoldTypeStopTransfer');
    expect(argument.lots).toEqual([{ security_id: 'S-A1', quantity: null, origin_issuance: null }]);
  });

  it('refuses what the ledger refuses before it reads a lot', () => {
    expect(() => placeHolds([])).toThrow('CapTable_PlaceHolds needs at least one lot');
    expect(() =>
      placeHolds(Array.from({ length: 51 }, (_, index) => ({ ...SETTLEMENT_LOT, security_id: `S-${index}` })))
    ).toThrow('CapTable_PlaceHolds takes at most 50 lots');
    expect(() => placeHolds([SETTLEMENT_LOT, SETTLEMENT_LOT])).toThrow('each lot appears once');
    expect(() => placeHolds([SETTLEMENT_LOT], 'REGISTER_SETTLEMENT', '')).toThrow('a hold needs a reference');
    expect(() => placeHolds([{ security_id: 'S-A1', origin_issuance: 'cid' }])).toThrow(
      'a settlement hold needs a quantity'
    );
    expect(() => placeHolds([{ security_id: 'S-A1', quantity: '1' }])).toThrow(
      "a settlement hold needs the security's origin issuance"
    );
    expect(() => placeHolds([{ security_id: 'S-A1', quantity: '1' }], 'STOP_TRANSFER')).toThrow(
      'a stop holds the whole security and takes no quantity'
    );
    expect(() => placeHolds([SETTLEMENT_LOT], 'LOCKUP' as HoldType)).toThrow('Unknown hold type');
    expect(() =>
      buildPlaceHoldsCommand({
        ...ANCHOR_REF,
        inputs: INPUTS,
        holdType: 'STOP_TRANSFER',
        reference: 'C',
        date: '2025-06-02',
        reasonText: 'r',
        lots: [{ security_id: 'S-A1' }],
        transferAgent: '',
      })
    ).toThrow('Required field is missing or empty');
  });
});

describe('readPlaceHoldsResult', () => {
  it('decodes one placed hold per lot', () => {
    const response = transaction([
      anchorExercise('CapTable_PlaceHolds', [
        {
          hold_id: 'test-1:hold',
          security_id: 'S-A1',
          stakeholder_id: 'SH-A',
          stock_class_id: 'CLS-A',
          split_epoch: '1',
          stock_legend_ids: ['LEGEND-1'],
          security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
          canceled_settlement_hold: null,
          state: 'state-S-A1-2',
        },
        {
          hold_id: 'test-1:stop',
          security_id: 'S-A2',
          stakeholder_id: 'SH-A',
          stock_class_id: 'CLS-A',
          split_epoch: '0',
          stock_legend_ids: [],
          security_law_exemptions: [],
          canceled_settlement_hold: { hold_id: 'test-1:old', reference: 'T-0', hold_cancellation_id: 'test-1:cancel' },
          state: 'state-S-A2-2',
        },
      ]),
    ]);
    expect(readPlaceHoldsResult(response, { capTableContractId: ANCHOR })).toEqual([
      {
        hold_id: 'test-1:hold',
        security_id: 'S-A1',
        stakeholder_id: 'SH-A',
        stock_class_id: 'CLS-A',
        split_epoch: 1,
        stock_legend_ids: ['LEGEND-1'],
        security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
        canceled_settlement_hold: null,
        state: 'state-S-A1-2',
      },
      {
        hold_id: 'test-1:stop',
        security_id: 'S-A2',
        stakeholder_id: 'SH-A',
        stock_class_id: 'CLS-A',
        split_epoch: 0,
        stock_legend_ids: [],
        security_law_exemptions: [],
        canceled_settlement_hold: { hold_id: 'test-1:old', reference: 'T-0', hold_cancellation_id: 'test-1:cancel' },
        state: 'state-S-A2-2',
      },
    ]);
  });

  it('refuses a result that is not a list', () => {
    expect(() => readPlaceHoldsResult(transaction([anchorExercise('CapTable_PlaceHolds', {})]))).toThrow(
      expect.objectContaining({ source: 'CapTable_PlaceHolds.exerciseResult' })
    );
  });
});

describe('buildCancelHoldsCommand', () => {
  it('builds whole-hold cancellations with their reasons', () => {
    const command = cancelHolds([
      { security_id: 'S-A1', hold_id: 'test-1:hold', reason_text: 'released' },
      { security_id: 'S-A2', hold_id: 'test-1:stop', reason_text: 'case closed' },
    ]);
    expect(exerciseOf(command).choice).toBe('CapTable_CancelHolds');
    expect(
      decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_CancelHolds, exerciseOf(command).choiceArgument)
    ).toEqual({
      inputs: DAML_INPUTS,
      date: '2025-06-02',
      holds: [
        { security_id: 'S-A1', hold_id: 'test-1:hold', reason_text: 'released' },
        { security_id: 'S-A2', hold_id: 'test-1:stop', reason_text: 'case closed' },
      ],
    });
  });

  it('refuses no hold, more than 50, a hold named twice and a cancellation without a reason', () => {
    const hold = { security_id: 'S-A1', hold_id: 'test-1:hold', reason_text: 'released' };
    expect(() => cancelHolds([])).toThrow('CapTable_CancelHolds needs at least one hold');
    expect(() => cancelHolds(Array.from({ length: 51 }, (_, index) => ({ ...hold, hold_id: `h-${index}` })))).toThrow(
      'CapTable_CancelHolds takes at most 50 holds'
    );
    expect(() => cancelHolds([hold, hold])).toThrow('each hold appears once');
    expect(() => cancelHolds([{ ...hold, reason_text: '' }])).toThrow('a hold cancellation needs a reason');
    expect(() => buildCancelHoldsCommand({ ...ANCHOR_REF, inputs: INPUTS, date: '2025/06/02', holds: [hold] })).toThrow(
      'Expected a Daml Date (YYYY-MM-DD)'
    );
  });
});

describe('readCancelHoldsResult', () => {
  it('decodes the canceled holds and the new states', () => {
    const response = transaction([
      anchorExercise('CapTable_CancelHolds', {
        canceled: [{ security_id: 'S-A1', hold_id: 'test-1:hold', hold_cancellation_id: 'test-1:cancel' }],
        states: [['S-A1', 'state-S-A1-3']],
      }),
    ]);
    const result = readCancelHoldsResult(response);
    expect(result.canceled).toEqual([
      { security_id: 'S-A1', hold_id: 'test-1:hold', hold_cancellation_id: 'test-1:cancel' },
    ]);
    expect([...result.states]).toEqual([['S-A1', 'state-S-A1-3']]);
  });
});
