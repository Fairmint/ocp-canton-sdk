import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpValidationError } from '../../src/errors';
import { getPositions } from '../../src/functions/OpenCapTable/positions/getPositions';
import {
  activeContract,
  capTablePayload,
  CONTEXT,
  damlLot,
  damlStockPosition,
  mockLedger,
  OFFSET,
  TEMPLATE_IDS,
} from './positionFixtures';

jest.mock('@fairmint/canton-node-sdk');

const ISSUER = CONTEXT.issuer;

describe('getPositions', () => {
  it('returns null when the issuer has no CapTable', async () => {
    const client = mockLedger({ activeByTemplate: { [TEMPLATE_IDS.capTable]: [] } });

    await expect(getPositions(client as unknown as LedgerJsonApiClient, ISSUER)).resolves.toBeNull();
  });

  it('reads a 0.0.3 CapTable as no positions without querying StockPosition', async () => {
    const client = mockLedger({
      activeByTemplate: { [TEMPLATE_IDS.capTable]: [activeContract('ct-1', TEMPLATE_IDS.capTable, capTablePayload())] },
    });

    const result = await getPositions(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(result).toEqual({
      enabled: false,
      registries: new Map(),
      migratedSecurityIds: new Map(),
      ancestorSecurityIds: new Map(),
      capTableContractId: 'ct-1',
      offset: OFFSET,
      positions: [],
    });
    expect(client.getActiveContracts).toHaveBeenCalledTimes(1);
  });

  it('reads root fields and positions at one offset', async () => {
    const otherContextPosition = damlStockPosition([damlLot('X1')], {
      context: { issuer: ISSUER, system_operator: 'other-sysop::party' },
    });
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({
              positionRegistries: [['CLASS-MANAGED', 'registry-cid']],
              migrated: [['S1', 'SH-SELLER']],
              ancestors: [],
            })
          ),
        ],
        [TEMPLATE_IDS.stockPosition]: [
          activeContract(
            'pos-1',
            TEMPLATE_IDS.stockPosition,
            damlStockPosition([
              damlLot('S1', {
                holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '30' }],
              }),
            ])
          ),
          activeContract('pos-other', TEMPLATE_IDS.stockPosition, otherContextPosition),
        ],
      },
    });

    const result = await getPositions(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(result?.enabled).toBe(true);
    expect(result?.offset).toBe(OFFSET);
    expect([...(result?.registries ?? [])]).toEqual([['CLASS-MANAGED', 'registry-cid']]);
    expect(result?.positions.map((p) => p.contractId)).toEqual(['pos-1']);
    expect(result?.positions[0]?.totals).toEqual({ total: '100', held: '30', vested: '100', drawable: '70' });
    for (const call of client.getActiveContracts.mock.calls) {
      expect(call[0]).toMatchObject({ parties: [ISSUER], activeAtOffset: OFFSET });
    }
    expect(client.getActiveContracts.mock.calls.map((call) => call[0].templateIds)).toEqual([
      [TEMPLATE_IDS.capTable],
      [TEMPLATE_IDS.stockPosition],
    ]);
  });

  it('computes vested and drawable quantities as of the instant asked, by default the read', async () => {
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({ positionRegistries: [['CLASS-MANAGED', 'registry-cid']] })
          ),
        ],
        [TEMPLATE_IDS.stockPosition]: [
          activeContract(
            'pos-1',
            TEMPLATE_IDS.stockPosition,
            damlStockPosition([
              damlLot('S1', {
                issuance: { vesting_terms_id: 'VT-1' },
                vestingSnapshot: { vested_quantity: '45.0000000000', as_of: '2026-01-01T00:00:00Z' },
                holds: [{ purpose: 'HoldPurposeRegisterSettlement', reference: 'T-1', quantity: '30.0000000000' }],
              }),
            ])
          ),
        ],
      },
    });
    const read = async (options?: { asOf?: Date | string }) =>
      (await getPositions(client as unknown as LedgerJsonApiClient, ISSUER, options))?.positions[0];

    const before = await read({ asOf: '2025-12-31T23:59:59.999999Z' });
    expect(before?.asOf).toBe('2025-12-31T23:59:59.999999Z');
    expect(before?.lots).toEqual([
      { securityId: 'S1', stopped: false, total: '100', held: '30', vested: '0', drawable: '0' },
    ]);

    const after = await read({ asOf: new Date('2026-06-01T00:00:00Z') });
    expect(after?.asOf).toBe('2026-06-01T00:00:00.000000Z');
    expect(after?.buckets[0]).toMatchObject({ total: '100', held: '30', vested: '45', drawable: '15' });

    const start = Date.now();
    const now = await read();
    expect(now?.totals).toEqual({ total: '100', held: '30', vested: '45', drawable: '15' });
    const readAt = Date.parse(now?.asOf ?? '');
    expect(readAt).toBeGreaterThanOrEqual(start);
    expect(readAt).toBeLessThanOrEqual(Date.now());
  });

  it('rejects an invalid instant before reading the ledger', async () => {
    const client = mockLedger({ activeByTemplate: {} });

    await expect(
      getPositions(client as unknown as LedgerJsonApiClient, ISSUER, { asOf: '2026-10-15' })
    ).rejects.toThrow(OcpValidationError);
    expect(client.getLedgerEnd).not.toHaveBeenCalled();
  });

  it('rejects rows that are not the StockPosition template', async () => {
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({ positionRegistries: [['CLASS-MANAGED', 'registry-cid']] })
          ),
        ],
        [TEMPLATE_IDS.stockPosition]: [
          activeContract('pos-1', '#OpenCapTable-v34:Fairmint.OpenCapTable.Positions:PositionRegistry', {}),
        ],
      },
    });

    await expect(getPositions(client as unknown as LedgerJsonApiClient, ISSUER)).rejects.toThrow(OcpContractError);
  });

  it('fails when the issuer has several CapTables', async () => {
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract('ct-1', TEMPLATE_IDS.capTable, capTablePayload()),
          activeContract('ct-2', TEMPLATE_IDS.capTable, capTablePayload()),
        ],
      },
    });

    await expect(getPositions(client as unknown as LedgerJsonApiClient, ISSUER)).rejects.toThrow(
      'Multiple active CapTable contracts for issuer'
    );
  });
});
