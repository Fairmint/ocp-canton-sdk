import { OcpParseError, OcpValidationError } from '../../src/errors';
import { decodeStockPosition } from '../../src/functions/OpenCapTable/positions/decodeStockPosition';
import {
  drawableQuantity,
  heldQuantity,
  lotIsStopped,
  summarizeStockPosition,
  vestedQuantity,
} from '../../src/functions/OpenCapTable/positions/positionQuantities';
import type { PositionLot } from '../../src/functions/OpenCapTable/positions/positionTypes';
import { damlLot, damlStockPosition, TEMPLATE_IDS } from './positionFixtures';

function lotOf(rawLot: Record<string, unknown>): PositionLot {
  const position = decodeStockPosition(damlStockPosition([rawLot]), 'pos-1');
  const [lot] = position.lots.values();
  if (lot === undefined) throw new Error('fixture has no lot');
  return lot;
}

/** OCP `OcfVesting` as the ledger encodes it. */
function tranche(date: string, amount: string): Record<string, unknown> {
  return { date, amount };
}

/** vested and drawable of one lot as of one instant. */
function vestingOf(asOf: Date | string, lot: PositionLot): { vested: string; drawable: string } {
  return { vested: vestedQuantity(asOf, lot), drawable: drawableQuantity(asOf, lot) };
}

describe('decodeStockPosition', () => {
  it('decodes the payload field for field, with the lot issuance as OCF', () => {
    const position = decodeStockPosition(
      damlStockPosition([
        damlLot('S1', {
          holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '10.0000000000' }],
          vestingSnapshot: { vested_quantity: '45.5000000000', as_of: '2026-01-01T00:00:00Z' },
          issuance: {
            stock_legend_ids: ['L1'],
            vesting_terms_id: 'VT-1',
            vestings: [tranche('2024-06-01T12:30:00.000001Z', '20.0000000000')],
          },
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
        // OCF keeps the calendar date of a tranche only.
        vestings: [{ date: '2024-06-01', amount: '20' }],
      }),
      // The ledger's tranche, with its whole Time.
      ledgerVestings: [{ date: '2024-06-01T12:30:00.000001Z', amount: '20' }],
      holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '10' }],
      vesting_snapshot: { vested_quantity: '45.5', as_of: '2026-01-01T00:00:00Z' },
    });
  });

  it('reads absent Optional fields as null', () => {
    const raw = damlLot('S1', { holds: [{ purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null }] });
    delete raw.vesting_snapshot;
    const holds = raw.holds as Array<Record<string, unknown>>;
    delete holds[0]?.quantity;

    const lot = lotOf(raw);

    expect(lot.vesting_snapshot).toBeNull();
    expect(lot.ledgerVestings).toEqual([]);
    expect(lot.holds[0]?.quantity).toBeNull();
  });

  it('rejects a snapshot or a tranche whose Time or Decimal is malformed', () => {
    const badAsOf = damlLot('S1', {
      issuance: { vesting_terms_id: 'VT-1' },
      vestingSnapshot: { vested_quantity: '1', as_of: '2026-01-01' },
    });
    expect(() => lotOf(badAsOf)).toThrow(/StockPosition.lots\[S1\].vesting_snapshot.as_of must be a DAML Time/);

    const badQuantity = damlLot('S1', {
      issuance: { vesting_terms_id: 'VT-1' },
      vestingSnapshot: { vested_quantity: 'many', as_of: '2026-01-01T00:00:00Z' },
    });
    expect(() => lotOf(badQuantity)).toThrow(OcpParseError);

    // A tranche Time that is not RFC 3339 with an offset.
    const badTranche = damlLot('S1', { issuance: { vestings: [tranche('2024-06-01T00:00:00', '1')] } });
    expect(() => lotOf(badTranche)).toThrow(OcpParseError);
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

describe('lot quantities (OCP lotIsStopped / heldQuantity / vestedQuantity / drawableQuantity)', () => {
  const NOW = '2026-10-15T00:00:00Z';

  it('a lot without tranches or vesting terms is vested and, without holds, drawable in full', () => {
    const lot = lotOf(damlLot('S1'));

    expect(lotIsStopped(lot)).toBe(false);
    expect(heldQuantity(lot)).toBe('0');
    expect(vestingOf(NOW, lot)).toEqual({ vested: '100', drawable: '100' });
  });

  it('quantity holds of both purposes reduce the drawable quantity exactly', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: { quantity: '100.0000000003' },
        holds: [
          { purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '0.1000000001' },
          { purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '0.2000000001' },
        ],
      })
    );

    expect(heldQuantity(lot)).toBe('0.3000000002');
    expect(vestingOf(NOW, lot)).toEqual({ vested: '100.0000000003', drawable: '99.7000000001' });
  });

  it('a stopped lot has nothing drawable, and the stop holds no quantity', () => {
    const lot = lotOf(
      damlLot('S1', {
        holds: [
          { purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '25' },
          { purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null },
        ],
      })
    );

    expect(lotIsStopped(lot)).toBe(true);
    expect(heldQuantity(lot)).toBe('25');
    expect(vestingOf(NOW, lot)).toEqual({ vested: '100', drawable: '0' });
  });

  it('tranches vest when their whole Time is on or before the instant, compared to the microsecond', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: {
          vestings: [
            tranche('2024-01-01T00:00:00Z', '30.0000000001'),
            tranche('2025-01-01T12:00:00Z', '30'),
            tranche('2026-01-01T00:00:00Z', '39.9999999999'),
          ],
        },
      })
    );

    expect(vestingOf('2023-12-31T23:59:59.999999Z', lot)).toEqual({ vested: '0', drawable: '0' });
    expect(vestingOf('2024-01-01T00:00:00Z', lot)).toEqual({ vested: '30.0000000001', drawable: '30.0000000001' });
    // The OCF date of the second tranche is 2025-01-01, but it vests at noon.
    expect(vestedQuantity('2025-01-01T11:59:59.999999Z', lot)).toBe('30.0000000001');
    expect(vestedQuantity('2025-01-01T12:00:00Z', lot)).toBe('60.0000000001');
    // The same instant written with an offset, and as a Date.
    expect(vestedQuantity('2025-01-01T13:00:00+01:00', lot)).toBe('60.0000000001');
    expect(vestedQuantity(new Date('2025-01-01T11:59:59.999Z'), lot)).toBe('30.0000000001');
    expect(vestedQuantity(NOW, lot)).toBe('100');
  });

  it('tranches vest only what they list, capped at the lot quantity', () => {
    // 40 of 100 in tranches: the rest never vests by tranches.
    const partial = lotOf(damlLot('S1', { issuance: { vestings: [tranche('2024-01-01T00:00:00Z', '40')] } }));
    expect(vestingOf(NOW, partial)).toEqual({ vested: '40', drawable: '40' });

    // Tranches above the quantity (a migrated lot's root tranches after a reverse split): capped at the quantity.
    const over = lotOf(
      damlLot('S1', {
        issuance: {
          quantity: '50',
          vestings: [tranche('2024-01-01T00:00:00Z', '30'), tranche('2024-06-01T00:00:00Z', '30')],
        },
      })
    );
    expect(vestingOf('2024-03-01T00:00:00Z', over)).toEqual({ vested: '30', drawable: '30' });
    expect(vestingOf(NOW, over)).toEqual({ vested: '50', drawable: '50' });
  });

  it('a lot on vesting terms vests only what a snapshot dated on or before the instant records', () => {
    const unrecorded = lotOf(damlLot('S1', { issuance: { vesting_terms_id: 'VT-1' } }));
    expect(vestingOf(NOW, unrecorded)).toEqual({ vested: '0', drawable: '0' });

    const recorded = lotOf(
      damlLot('S1', {
        issuance: { vesting_terms_id: 'VT-1' },
        vestingSnapshot: { vested_quantity: '45.0000000001', as_of: '2026-01-01T00:00:00Z' },
      })
    );
    // A snapshot dated after the instant proves nothing about it.
    expect(vestingOf('2025-12-31T23:59:59.999999Z', recorded)).toEqual({ vested: '0', drawable: '0' });
    expect(vestingOf('2026-01-01T00:00:00Z', recorded)).toEqual({ vested: '45.0000000001', drawable: '45.0000000001' });
    expect(vestingOf(NOW, recorded)).toEqual({ vested: '45.0000000001', drawable: '45.0000000001' });
  });

  it('a lot with tranches and vesting terms vests the lesser of the two', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: {
          vesting_terms_id: 'VT-1',
          vestings: [tranche('2024-01-01T00:00:00Z', '25'), tranche('2025-01-01T00:00:00Z', '75')],
        },
        vestingSnapshot: { vested_quantity: '60', as_of: '2024-06-01T00:00:00Z' },
      })
    );

    expect(vestedQuantity('2024-03-01T00:00:00Z', lot)).toBe('0'); // before the snapshot
    expect(vestedQuantity('2024-06-01T00:00:00Z', lot)).toBe('25'); // tranches bound it
    expect(vestedQuantity(NOW, lot)).toBe('60'); // the snapshot bounds it
  });

  it('holds count against vested shares first, and drawable never goes below zero', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: { vesting_terms_id: 'VT-1' },
        vestingSnapshot: { vested_quantity: '45', as_of: '2026-01-01T00:00:00Z' },
        holds: [
          { purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '30' },
          { purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '10.5' },
        ],
      })
    );

    expect(heldQuantity(lot)).toBe('40.5');
    expect(vestingOf(NOW, lot)).toEqual({ vested: '45', drawable: '4.5' });
    // Before the snapshot nothing is vested, so the holds exceed the vested quantity.
    expect(vestingOf('2025-06-01T00:00:00Z', lot)).toEqual({ vested: '0', drawable: '0' });
  });

  it('a stop locks a partially vested lot too', () => {
    const lot = lotOf(
      damlLot('S1', {
        issuance: { vesting_terms_id: 'VT-1' },
        vestingSnapshot: { vested_quantity: '45', as_of: '2026-01-01T00:00:00Z' },
        holds: [{ purpose: 'HoldPurposeStopTransfer', reference: 'STOP-1', quantity: null }],
      })
    );

    expect(vestingOf(NOW, lot)).toEqual({ vested: '45', drawable: '0' });
  });

  it('rejects an instant that is not a valid Date or DAML Time', () => {
    const lot = lotOf(damlLot('S1'));

    for (const asOf of ['2026-10-15', '2026-10-15T00:00:00', '2026-02-29T00:00:00Z', 'soon', new Date('nope')]) {
      expect(() => vestedQuantity(asOf, lot)).toThrow(OcpValidationError);
    }
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

    const state = summarizeStockPosition('pos-1', TEMPLATE_IDS.stockPosition, position, '2026-10-15T00:00:00Z');

    expect(state.contractId).toBe('pos-1');
    expect(state.templateId).toBe(TEMPLATE_IDS.stockPosition);
    expect(state.asOf).toBe('2026-10-15T00:00:00.000000Z');
    expect(state.totals).toEqual({ total: '105.5', held: '10', vested: '105.5', drawable: '55.5' });
    expect(state.lots).toEqual([
      { securityId: 'S1', stopped: false, total: '60', held: '10', vested: '60', drawable: '50' },
      { securityId: 'S2', stopped: true, total: '40', held: '0', vested: '40', drawable: '0' },
      { securityId: 'S3', stopped: false, total: '5.5', held: '0', vested: '5.5', drawable: '5.5' },
    ]);
    expect(state.buckets).toEqual([
      {
        bucket: { stockLegendIds: ['L1', 'L2'], securityLawExemptions: [exemptionA, exemptionB] },
        securityIds: ['S1', 'S2'],
        total: '100',
        held: '10',
        vested: '100',
        drawable: '50',
      },
      {
        bucket: { stockLegendIds: ['L1'], securityLawExemptions: [] },
        securityIds: ['S3'],
        total: '5.5',
        held: '0',
        vested: '5.5',
        drawable: '5.5',
      },
    ]);
  });

  it('sums vested and drawable quantities of partially vested lots per bucket, as of the instant', () => {
    const position = decodeStockPosition(
      damlStockPosition([
        // Tranches: 30 vested on 2025-01-01, 70 on 2027-01-01; 20 held.
        damlLot('S1', {
          issuance: {
            vestings: [tranche('2025-01-01T00:00:00Z', '30'), tranche('2027-01-01T00:00:00Z', '70')],
          },
          holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '20' }],
        }),
        // Terms with a 45-of-60 snapshot dated after the instant, and a 40 hold placed after that snapshot: as of the
        // instant nothing of it is vested, so its holds exceed its vested quantity.
        damlLot('S2', {
          issuance: { quantity: '60', vesting_terms_id: 'VT-1' },
          vestingSnapshot: { vested_quantity: '45', as_of: '2026-11-01T00:00:00Z' },
          holds: [{ purpose: 'HoldPurposeScripMint', reference: 'SCRIP-1', quantity: '40' }],
        }),
        // Terms without a snapshot.
        damlLot('S3', { issuance: { quantity: '10', vesting_terms_id: 'VT-1' } }),
      ]),
      'pos-1'
    );

    const state = summarizeStockPosition(
      'pos-1',
      TEMPLATE_IDS.stockPosition,
      position,
      new Date('2026-10-15T08:30:00.123Z')
    );

    expect(state.asOf).toBe('2026-10-15T08:30:00.123000Z');
    expect(state.lots).toEqual([
      { securityId: 'S1', stopped: false, total: '100', held: '20', vested: '30', drawable: '10' },
      { securityId: 'S2', stopped: false, total: '60', held: '40', vested: '0', drawable: '0' },
      { securityId: 'S3', stopped: false, total: '10', held: '0', vested: '0', drawable: '0' },
    ]);
    // One bucket (no legends, no exemptions): the drawable sum is the sum of the lots', not vested less held.
    expect(state.buckets).toEqual([
      {
        bucket: { stockLegendIds: [], securityLawExemptions: [] },
        securityIds: ['S1', 'S2', 'S3'],
        total: '170',
        held: '60',
        vested: '30',
        drawable: '10',
      },
    ]);
    expect(state.totals).toEqual({ total: '170', held: '60', vested: '30', drawable: '10' });
  });
});
