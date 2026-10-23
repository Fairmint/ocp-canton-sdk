import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../src/errors';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  buildSettleCommand,
  findSettleResults,
  readSettleResult,
} from '../../src/functions/OpenCapTable/capTable/settle';
import { planDraw } from '../../src/register/draw';
import type { SettleLot } from '../../src/types/register';
import { stockState } from '../register/registerFixtures';
import {
  ANCHOR,
  ANCHOR_TEMPLATE_ID,
  CONTEXT,
  DAML_INPUTS,
  INPUTS,
  STAKEHOLDER,
  TRANSFER_AGENT,
  anchorExercise,
  decodeChoice,
  exerciseOf,
  issuance,
  transaction,
} from './capTableFixtures';

const HOLD_ID = 'test-1:hold-S-A1';

// The worked example: 750 of lot S-A1's 1,000 shares on hold at 2.00 USD, on a 1,000.00 USD basis.
const PLANNED = planDraw({
  state: stockState({
    quantity: '1000',
    seq: 1,
    last_event_date: '2025-06-02',
    holds: [{ hold_id: HOLD_ID, hold_type: 'REGISTER_SETTLEMENT', reference: 'T-1', split_epoch: 0, quantity: '1000' }],
  }),
  epochSplits: [],
  settlementId: 'T-1',
  holdId: HOLD_ID,
  quantity: '750',
  sharePrice: { amount: '2.00', currency: 'USD' },
  customId: 'BUY-S-A1',
  originIssuance: { contractId: 'cid-ISS-S-A1', data: issuance({ id: 'ISS-A1' }) },
  date: '2025-06-02',
  capTableId: CONTEXT.cap_table_id,
});

const CANCEL_LOT: SettleLot = {
  kind: 'cancel',
  hold: { security_id: 'S-A3', hold_id: 'test-1:hold-S-A3', reason_text: 'undrawn' },
};

function settle(lots: SettleLot[], settlementId = 'T-1') {
  return buildSettleCommand({
    capTableContractId: ANCHOR,
    transferAgent: TRANSFER_AGENT,
    inputs: INPUTS,
    settlementId,
    date: '2025-06-02',
    buyer: { kind: 'existing', contractId: 'cid-SH-B' },
    lots,
  });
}

// The SettleResult of the worked example's settlement, as the Ledger API encodes it.
function settleResultJson(context = CONTEXT): unknown {
  const { delivered } = PLANNED;
  return {
    context,
    settlement_id: 'T-1',
    seller_stakeholder_id: 'SH-A',
    buyer_stakeholder_id: 'SH-B',
    stock_class_id: 'CLS-A',
    lots: [
      {
        tag: 'SettleDrawResult',
        value: {
          security_id: 'S-A1',
          hold_id: HOLD_ID,
          quantity: '750.0000000000',
          share_price: { amount: '2.0000000000', currency: 'USD' },
          transfer_id: delivered.transfer_id,
          buyer_issuance_id: delivered.buyer_issuance_id,
          buyer_security_id: delivered.buyer_security_id,
          buyer_state: 'state-buyer',
          balance_issuance_id: delivered.balance_issuance_id,
          balance_security_id: delivered.balance_security_id,
          balance_state: 'state-balance',
          stock_legend_ids: ['LEGEND-1'],
          security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
        },
      },
      {
        tag: 'SettleCancelResult',
        value: {
          security_id: 'S-A3',
          hold_id: 'test-1:hold-S-A3',
          hold_cancellation_id: 'test-1:cancel-S-A3',
          state: 'state-S-A3',
        },
      },
    ],
    quantity: '750.0000000000',
  };
}

// A trade desk's settlement: TradeDesk_Settle at the root, CapTable_Settle and the cash leg beneath it.
function deskTransaction(settleEvent = anchorExercise('CapTable_Settle', settleResultJson(), { nodeId: 1 })) {
  return transaction([
    {
      ExercisedEvent: {
        offset: 42,
        nodeId: 0,
        contractId: 'desk-1',
        templateId: 'deadbeef:Fairmint.TradeSettlement.TradeDesk:TradeDesk',
        packageName: 'TradeSettlement-v01',
        choice: 'TradeDesk_Settle',
        choiceArgument: {},
        actingParties: [TRANSFER_AGENT, 'ta-cash::1220'],
        consuming: false,
        lastDescendantNodeId: 9,
        exerciseResult: { settled: true },
      },
    },
    settleEvent,
    { CreatedEvent: { contractId: 'state-buyer', templateId: 'x:Fairmint.OpenCapTable.State:StockSecurity' } },
    {
      ExercisedEvent: {
        nodeId: 8,
        contractId: 'allocation-1',
        templateId: 'cafe:Splice.Api.Token.AllocationV2:Allocation',
        packageName: 'splice-api-token-allocation-v2',
        choice: 'Allocation_ExecuteTransfer',
        actingParties: ['ta-cash::1220'],
        consuming: true,
        exerciseResult: {},
      },
    },
  ]);
}

describe('buildSettleCommand', () => {
  it('builds CapTable_Settle as the transfer agent with the planned draw and a cancellation', () => {
    const command = settle([{ kind: 'draw', lot: PLANNED.lot }, CANCEL_LOT]);
    expect(command.actAs).toEqual([TRANSFER_AGENT]);
    expect(exerciseOf(command)).toMatchObject({ contractId: ANCHOR, choice: 'CapTable_Settle' });
    expect(decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Settle, exerciseOf(command).choiceArgument)).toEqual({
      inputs: DAML_INPUTS,
      settlement_id: 'T-1',
      date: '2025-06-02',
      buyer: { tag: 'SettleBuyerExisting', value: 'cid-SH-B' },
      lots: [
        {
          tag: 'SettleDraw',
          value: {
            security_id: 'S-A1',
            hold_id: HOLD_ID,
            quantity: '750',
            custom_id: 'BUY-S-A1',
            share_price: { amount: '2', currency: 'USD' },
            buyer_cost_basis: { amount: '1500', currency: 'USD' },
            balance_cost_basis: { amount: '250', currency: 'USD' },
            balance_vestings: [],
            origin_issuance: 'cid-ISS-S-A1',
          },
        },
        { tag: 'SettleCancel', value: { security_id: 'S-A3', hold_id: 'test-1:hold-S-A3', reason_text: 'undrawn' } },
      ],
    });
  });

  it('creates a new buyer stakeholder in its generated shape', () => {
    const command = buildSettleCommand({
      capTableContractId: ANCHOR,
      transferAgent: TRANSFER_AGENT,
      inputs: INPUTS,
      settlementId: 'T-1',
      date: '2025-06-02',
      buyer: { kind: 'new', stakeholder: STAKEHOLDER },
      lots: [{ kind: 'draw', lot: PLANNED.lot }],
    });
    const argument = decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Settle, exerciseOf(command).choiceArgument);
    expect(argument.buyer).toEqual({ tag: 'SettleBuyerNew', value: convertToDamlData('stakeholder', STAKEHOLDER) });
  });

  it('refuses what the ledger refuses before it reads a lot', () => {
    const draw: SettleLot = { kind: 'draw', lot: PLANNED.lot };
    expect(() => settle([draw], '')).toThrow('a settlement needs its reference');
    expect(() => settle([])).toThrow('CapTable_Settle needs at least one lot');
    const many = Array.from({ length: 51 }, (_, index): SettleLot => ({
      kind: 'draw',
      lot: { ...PLANNED.lot, security_id: `S-${index}` },
    }));
    expect(() => settle(many)).toThrow('CapTable_Settle takes at most 50 lots');
    expect(() => settle([draw, { kind: 'cancel', hold: { ...CANCEL_LOT.hold, security_id: 'S-A1' } }])).toThrow(
      'each lot appears once'
    );
    expect(() => settle([CANCEL_LOT])).toThrow(
      'a settlement draws at least one lot; release a trade with CapTable_CancelHolds'
    );
    expect(() => settle([draw, { kind: 'cancel', hold: { ...CANCEL_LOT.hold, reason_text: '' } }])).toThrow(
      'a hold cancellation needs a reason'
    );
    const badLot = { ...PLANNED.lot, quantity: 'many' };
    expect(() => settle([{ kind: 'draw', lot: badLot }])).toThrow('Expected a decimal string');
  });
});

describe('readSettleResult', () => {
  it('reads the delivered terms of the settlement the TA submitted', () => {
    const terms = readSettleResult(transaction([anchorExercise('CapTable_Settle', settleResultJson())]), {
      capTableContractId: ANCHOR,
    });
    expect(terms).toMatchObject({
      context: CONTEXT,
      settlement_id: 'T-1',
      seller_stakeholder_id: 'SH-A',
      buyer_stakeholder_id: 'SH-B',
      stock_class_id: 'CLS-A',
      quantity: '750',
    });
    expect(terms.lots[1]).toEqual({
      kind: 'cancel',
      security_id: 'S-A3',
      hold_id: 'test-1:hold-S-A3',
      hold_cancellation_id: 'test-1:cancel-S-A3',
      state: 'state-S-A3',
    });
  });
});

describe('findSettleResults', () => {
  it('finds CapTable_Settle nested under TradeDesk_Settle, its draw as planDraw planned it', () => {
    const found = findSettleResults(deskTransaction().transaction);

    expect(found).toHaveLength(1);
    const [settlement] = found;
    expect(settlement).toMatchObject({ capTableContractId: ANCHOR, templateId: ANCHOR_TEMPLATE_ID, nodeId: 1 });
    expect(settlement?.terms.seller_stakeholder_id).toBe(PLANNED.seller_stakeholder_id);
    expect(settlement?.terms.stock_class_id).toBe(PLANNED.stock_class_id);
    expect(settlement?.terms.lots[0]).toEqual({
      ...PLANNED.delivered,
      buyer_state: 'state-buyer',
      balance_state: 'state-balance',
    });
  });

  it('leaves out an exercise of another package with the same module and choice', () => {
    const forged = anchorExercise('CapTable_Settle', settleResultJson(), {
      packageName: 'OpenCapTable-forged',
      templateId: 'f00d:Fairmint.OpenCapTable.CapTable:CapTable',
    });
    expect(findSettleResults(deskTransaction(forged).transaction)).toEqual([]);
    const byName = anchorExercise('CapTable_Settle', settleResultJson(), {
      packageName: undefined,
      templateId: '#OpenCapTable-v35:Fairmint.OpenCapTable.CapTable:CapTable',
      nodeId: undefined,
    });
    expect(findSettleResults(deskTransaction(byName).transaction)[0]?.nodeId).toBeNull();
  });

  it('refuses a settlement read without its result, or exercised by another party', () => {
    const missing = anchorExercise('CapTable_Settle', undefined);
    expect(() => findSettleResults(deskTransaction(missing).transaction)).toThrow(OcpContractError);
    expect(() => findSettleResults(deskTransaction(missing).transaction)).toThrow(
      expect.objectContaining({ code: OcpErrorCodes.RESULT_NOT_FOUND })
    );
    const actedByIssuer = anchorExercise('CapTable_Settle', settleResultJson(), { actingParties: [CONTEXT.issuer] });
    expect(() => findSettleResults(deskTransaction(actedByIssuer).transaction)).toThrow(
      'CapTable_Settle was not exercised by the transfer agent its result names'
    );
    expect(() => findSettleResults({ events: 'none' } as unknown as { events: unknown[] })).toThrow(OcpParseError);
  });

  it('refuses a result that does not decode', () => {
    const broken = anchorExercise('CapTable_Settle', { ...(settleResultJson() as object), quantity: 750 });
    expect(() => findSettleResults(deskTransaction(broken).transaction)).toThrow(OcpParseError);
  });
});
