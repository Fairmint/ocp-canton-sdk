import { OcpParseError } from '../../src/errors';
import { decodeStockPosition } from '../../src/functions/OpenCapTable/positions/decodeStockPosition';
import {
  lotFreeQuantity,
  lotHeldQuantity,
  lotIsStopped,
  summarizeStockPosition,
} from '../../src/functions/OpenCapTable/positions/positionQuantities';
import type { PositionLot } from '../../src/functions/OpenCapTable/positions/positionTypes';
import { damlLot, damlStockPosition, TEMPLATE_IDS } from './positionFixtures';

function lotOf(rawLot: Record<string, unknown>): PositionLot {
  const position = decodeStockPosition(damlStockPosition([rawLot]), 'pos-1');
  const [lot] = position.lots.values();
  if (lot === undefined) throw new Error('fixture has no lot');
  return lot;
}

describe('decodeStockPosition', () => {
  it('decodes the payload field for field, with the lot issuance as OCF', () => {
    const position = decodeStockPosition(
      damlStockPosition([
        damlLot('S1', {
          ancestry: ['S0'],
          holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '10.0000000000' }],
          fullyVestedOn: '2024-06-01T00:00:00Z',
          issuance: { stock_legend_ids: ['L1'], vesting_terms_id: 'VT-1' },
        }),
      ]),
      'pos-1'
    );

    expect(position.context).toEqual({ issuer: 'issuer::party', system_operator: 'sysop::party' });
    expect(position.stock_class_id).toBe('CLASS-MANAGED');
    expect(position.stakeholder_id).toBe('SH-SELLER');
    expect(position.holder).toBe('seller::party');
    expect([...position.lots.keys()]).toEqual(['S1']);
    const lot = position.lots.get('S1');
    expect(lot).toEqual({
      issuance: expect.objectContaining({
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'ISS-S1',
        security_id: 'S1',
        quantity: '100',
        date: '2024-01-01',
        stock_legend_ids: ['L1'],
        vesting_terms_id: 'VT-1',
      }),
      origin_security_id: 'S0',
      origin_date: '2024-01-01T00:00:00Z',
      ancestry: ['S0'],
      holds: [
        {
          purpose: 'HoldPurposeRegisterSettlement',
          reference: 'T-1',
          quantity: '10',
          date: '2025-01-01T00:00:00Z',
        },
      ],
      fully_vested_on: '2024-06-01T00:00:00Z',
    });
  });

  it('reads absent Optional fields as null', () => {
    const raw = damlLot('S1', { holds: [{ purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null }] });
    delete raw.fully_vested_on;
    const holds = raw.holds as Array<Record<string, unknown>>;
    delete holds[0]?.quantity;

    const lot = lotOf(raw);

    expect(lot.fully_vested_on).toBeNull();
    expect(lot.holds[0]?.quantity).toBeNull();
  });

  it('rejects unknown hold purposes and mis-keyed lots', () => {
    expect(() =>
      decodeStockPosition(
        damlStockPosition([
          damlLot('S1', { holds: [{ purpose: 'HoldPurposeOther' as never, reference: 'x', quantity: null }] }),
        ]),
        'pos-1'
      )
    ).toThrow(/Unknown hold purpose HoldPurposeOther/);

    const misKeyed = damlStockPosition([damlLot('S1')]);
    misKeyed.lots = [['S2', damlLot('S1')]];
    expect(() => decodeStockPosition(misKeyed, 'pos-1')).toThrow(/keyed by S2 but its issuance is for S1/);
  });

  it('rejects a payload without lots or with a malformed context', () => {
    expect(() => decodeStockPosition({ ...damlStockPosition([]), lots: undefined }, 'pos-1')).toThrow(OcpParseError);
    expect(() => decodeStockPosition({ ...damlStockPosition([]), context: 'nope' }, 'pos-1')).toThrow(
      /StockPosition.context must be an object/
    );
  });
});

describe('lot quantities (OCP lotIsStopped / lotHeldQuantity / lotFreeQuantity)', () => {
  it('a lot without holds is all free', () => {
    const lot = lotOf(damlLot('S1'));

    expect(lotIsStopped(lot)).toBe(false);
    expect(lotHeldQuantity(lot)).toBe('0');
    expect(lotFreeQuantity(lot)).toBe('100');
  });

  it('quantity holds of both purposes reduce the free quantity exactly', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: { quantity: '100.0000000003' },
        holds: [
          { purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '0.1000000001' },
          { purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '0.2000000001' },
        ],
      })
    );

    expect(lotHeldQuantity(lot)).toBe('0.3000000002');
    expect(lotFreeQuantity(lot)).toBe('99.7000000001');
  });

  it('a stopped lot shows nothing free, and the stop holds no quantity', () => {
    const lot = lotOf(
      damlLot('S1', {
        holds: [
          { purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '25' },
          { purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null },
        ],
      })
    );

    expect(lotIsStopped(lot)).toBe(true);
    expect(lotHeldQuantity(lot)).toBe('25');
    expect(lotFreeQuantity(lot)).toBe('0');
  });
});

describe('summarizeStockPosition', () => {
  it('totals per lot, per restriction bucket (as sets) and for the position', () => {
    const exemptionA = { description: 'Reg D', jurisdiction: 'US' };
    const exemptionB = { description: 'Reg S', jurisdiction: 'US' };
    const position = decodeStockPosition(
      damlStockPosition([
        damlLot('S1', {
          issuance: {
            quantity: '60',
            stock_legend_ids: ['L2', 'L1'],
            security_law_exemptions: [exemptionB, exemptionA],
          },
          holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '10' }],
        }),
        damlLot('S2', {
          // Same bucket as S1: equal as sets despite order and duplicates.
          issuance: {
            quantity: '40',
            stock_legend_ids: ['L1', 'L2', 'L1'],
            security_law_exemptions: [exemptionA, exemptionB, exemptionA],
          },
          holds: [{ purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null }],
        }),
        damlLot('S3', { issuance: { quantity: '5.5', stock_legend_ids: ['L1'] } }),
      ]),
      'pos-1'
    );

    const state = summarizeStockPosition('pos-1', TEMPLATE_IDS.stockPosition, position);

    expect(state.contractId).toBe('pos-1');
    expect(state.templateId).toBe(TEMPLATE_IDS.stockPosition);
    expect(state.totals).toEqual({ total: '105.5', held: '10', free: '55.5' });
    expect(state.lots).toEqual([
      { securityId: 'S1', stopped: false, total: '60', held: '10', free: '50' },
      { securityId: 'S2', stopped: true, total: '40', held: '0', free: '0' },
      { securityId: 'S3', stopped: false, total: '5.5', held: '0', free: '5.5' },
    ]);
    expect(state.buckets).toEqual([
      {
        bucket: { stockLegendIds: ['L1', 'L2'], securityLawExemptions: [exemptionA, exemptionB] },
        securityIds: ['S1', 'S2'],
        total: '100',
        held: '10',
        free: '50',
      },
      {
        bucket: { stockLegendIds: ['L1'], securityLawExemptions: [] },
        securityIds: ['S3'],
        total: '5.5',
        held: '0',
        free: '5.5',
      },
    ]);
  });
});
