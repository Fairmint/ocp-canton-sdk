import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError } from '../../src/errors';
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
    expect(result?.positions[0]?.totals).toEqual({ total: '100', held: '30', free: '70' });
    for (const call of client.getActiveContracts.mock.calls) {
      expect(call[0]).toMatchObject({ parties: [ISSUER], activeAtOffset: OFFSET });
    }
    expect(client.getActiveContracts.mock.calls.map((call) => call[0].templateIds)).toEqual([
      [TEMPLATE_IDS.capTable],
      [TEMPLATE_IDS.stockPosition],
    ]);
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
