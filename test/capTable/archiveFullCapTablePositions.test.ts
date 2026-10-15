import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError } from '../../src/errors';
import { archiveFullCapTable } from '../../src/functions/OpenCapTable/capTable/archiveFullCapTable';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { activeContract, capTablePayload, CONTEXT, mockLedger, TEMPLATE_IDS } from '../positions/positionFixtures';

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
});
