import { OcpClient } from '../src';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LedgerJsonApiClient } = require('@fairmint/canton-node-sdk');

describe('write: createDocument', () => {
  test('submits expected message and includes auth token', async () => {
    const getAuthToken = jest.fn().mockResolvedValue('bearer-123');
    const client = new OcpClient({ network: 'devnet', getAuthToken });
    const ledger = (LedgerJsonApiClient as any).__instances?.slice(-1)[0] as InstanceType<typeof LedgerJsonApiClient> & { __setSubmitResponse: Function; lastAuthToken?: string; submitAndWaitForTransactionTree: jest.Mock };

    ledger.__setSubmitResponse({
      transactionTree: {
        updateId: 'u-doc',
        synchronizerId: 'sync-1',
        eventsById: {
          '1': {
            CreatedTreeEvent: {
              value: {
                contractId: 'doc-1',
                templateId: 'pkg:Fairmint.OpenCapTable.Document.Document'
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

    const res = await client.document.createDocument({
      issuerContractId: 'issuer-1',
      featuredAppRightContractDetails: featured,
      issuerParty: 'party::issuer',
      documentData: {
        id: 'doc-ocf-1',
        uri: 'https://example.com/doc.pdf',
        md5: 'abc123',
        related_objects: [{ object_type: 'ISSUER', object_id: 'iss-1' }]
      }
    });

    expect(res.contractId).toBe('doc-1');
    expect(res.updateId).toBe('u-doc');

    expect(getAuthToken).toHaveBeenCalled();
    expect(ledger.lastAuthToken).toBe('bearer-123');

    const call = ledger.submitAndWaitForTransactionTree.mock.calls[0][0];
    expect(call.actAs).toEqual(['party::issuer']);
    expect(call.commands[0].ExerciseCommand.choice).toBe('CreateDocument');
    expect(call.disclosedContracts?.[0]).toMatchObject({ contractId: featured.contractId });
  });
});


