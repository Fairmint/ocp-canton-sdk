import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError } from '../../src/errors';
import {
  archiveFullCapTable,
  getSystemOperatorPartyId,
} from '../../src/functions/OpenCapTable/capTable/archiveFullCapTable';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  activeContract,
  capTablePayload,
  CONTEXT,
  damlIssuance,
  mockLedger,
  NO_VESTING_RECORDS,
  TEMPLATE_IDS,
} from '../positions/positionFixtures';

jest.mock('@fairmint/canton-node-sdk');

describe('archiveFullCapTable on a CapTable with position registries', () => {
  it('refuses before deleting anything, since ArchiveCapTable requires no registries', async () => {
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({
              stockClasses: [['CLASS-M', 'class-m-cid']],
              positionRegistries: [['CLASS-M', 'registry-cid']],
            })
          ),
        ],
        [TEMPLATE_IDS.stockPosition]: [],
        [TEMPLATE_IDS.stockIssuance]: [],
        [TEMPLATE_IDS.stockTransfer]: [],
        ...NO_VESTING_RECORDS,
      },
      createArgumentsByContractId: { 'issuer-cid': { issuer_data: { id: 'ISSUER-1' } } },
    });
    const submitAndWaitForTransaction = jest.fn();
    const ledger = Object.assign(client, { submitAndWaitForTransaction }) as unknown as LedgerJsonApiClient;

    const archive = archiveFullCapTable(ledger, ledger, CONTEXT.issuer, {
      capTableContractId: 'ct-1',
      entities: new Map<OcfEntityType, Set<string>>([['stockClass', new Set(['CLASS-M'])]]),
    });

    await expect(archive).rejects.toThrow(OcpContractError);
    await expect(archive).rejects.toThrow('Cannot archive a CapTable with position registries');
    expect(submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('reads the system operator from the CapTable row alone', async () => {
    // Two registry issuances reuse one OCF ID: building the position state would only report it, and reading the
    // system operator does not build it at all.
    const registryIssuance = (contractId: string, securityId: string) =>
      activeContract(contractId, TEMPLATE_IDS.stockIssuance, {
        context: CONTEXT,
        issuance_data: damlIssuance(securityId, { id: 'REG-ISS-1', stock_class_id: 'CLASS-M' }),
      });
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({
              stockClasses: [['CLASS-M', 'class-m-cid']],
              positionRegistries: [['CLASS-M', 'registry-cid']],
            })
          ),
        ],
        [TEMPLATE_IDS.stockPosition]: [],
        [TEMPLATE_IDS.stockIssuance]: [registryIssuance('reg-1-cid', 'R1'), registryIssuance('reg-2-cid', 'R2')],
        [TEMPLATE_IDS.stockTransfer]: [],
        ...NO_VESTING_RECORDS,
      },
    });

    await expect(getSystemOperatorPartyId(client as unknown as LedgerJsonApiClient, CONTEXT.issuer)).resolves.toBe(
      CONTEXT.system_operator
    );
    expect(client.getActiveContracts.mock.calls.map((call) => call[0])).toEqual([
      { parties: [CONTEXT.issuer], templateIds: [TEMPLATE_IDS.capTable] },
    ]);
    expect(client.getEventsByContractId).not.toHaveBeenCalled();
  });

  it('reports a missing CapTable when reading the system operator', async () => {
    const client = mockLedger({ activeByTemplate: { [TEMPLATE_IDS.capTable]: [] } });

    await expect(getSystemOperatorPartyId(client as unknown as LedgerJsonApiClient, CONTEXT.issuer)).rejects.toThrow(
      'No CapTable contract found when reading archive context'
    );
  });
});
