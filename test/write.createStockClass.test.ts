import { OcpClient } from '../src';
// Import the mocked SDK via its module name to share the same module instance as source code
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LedgerJsonApiClient } = require('@fairmint/canton-node-sdk');

describe('write: createStockClass', () => {
  test('submits expected network message and includes auth token', async () => {
    const getAuthToken = jest.fn().mockResolvedValue('test-token');
    const client = new OcpClient({ network: 'devnet' } as any);

    // Grab the underlying mocked ledger client instance
    const ledger = (LedgerJsonApiClient as any).__instances?.slice(-1)[0] as InstanceType<typeof LedgerJsonApiClient> & { __setSubmitResponse: Function; __setAuthTokenProvider: Function; lastAuthToken?: string; submitAndWaitForTransactionTree: jest.Mock };
    ledger.__setAuthTokenProvider(getAuthToken);

    // Prepare a CreatedTreeEvent for StockClass
    ledger.__setSubmitResponse({
      transactionTree: {
        updateId: 'u-1',
        synchronizerId: 'sync-1',
        eventsById: {
          '1': {
            CreatedTreeEvent: {
              value: {
                contractId: 'stockclass-1',
                templateId: 'pkg:Fairmint.OpenCapTable.StockClass.StockClass'
              }
            }
          }
        }
      }
    } as any);

    const featured = {
      contractId: 'featured-1',
      createdEventBlob: 'blob-1',
      synchronizerId: 'sync-1',
      templateId: 'pkg:Fairmint.OpenCapTable.FeaturedAppRight.FeaturedAppRight'
    };

    const result = await client.stockClass.createStockClass({
      issuerContractId: 'issuer-1',
      featuredAppRightContractDetails: featured,
      issuerParty: 'party::issuer',
      stockClassData: {
        id: 'sc-1',
        name: 'Series A Preferred',
        class_type: 'PREFERRED',
        default_id_prefix: 'SA-',
        initial_shares_authorized: '1000',
        votes_per_share: '1',
        seniority: '1',
        comments: [],
        conversion_rights: []
      }
    });

    expect(result.contractId).toBe('stockclass-1');
    expect(result.updateId).toBe('u-1');

    // Assert auth was requested
    expect(getAuthToken).toHaveBeenCalled();
    expect(ledger.lastAuthToken).toBe('test-token');

    // Assert network message shape
    const call = ledger.submitAndWaitForTransactionTree.mock.calls[0][0];
    expect(call.actAs).toEqual(['party::issuer']);
    expect(call.commands[0].ExerciseCommand.choice).toBe('CreateStockClass');
    expect(call.disclosedContracts?.[0]).toMatchObject({
      contractId: featured.contractId,
      createdEventBlob: featured.createdEventBlob,
      synchronizerId: featured.synchronizerId,
      templateId: featured.templateId
    });
  });
});


