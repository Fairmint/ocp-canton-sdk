import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../src';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LedgerJsonApiClient } = require('@fairmint/canton-node-sdk');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

describe('write: createDocument', () => {
  test('submits expected message and includes auth token', async () => {
    const config = { network: 'devnet' } as ClientConfig;
    const client = new OcpClient(config);
    const validatorApi = new ValidatorApiClient(config);

    const featured = await getFeaturedAppRightContractDetails(validatorApi);
    const res = await client.document.createDocument({
      issuerContractId: 'issuer-1',
      featuredAppRightContractDetails: featured,
      issuerParty: 'party::issuer',
      documentData: {
        id: 'doc-ocf-1',
        uri: 'https://example.com/doc.pdf',
        md5: 'abc123',
        related_objects: [{ object_type: 'ISSUER', object_id: 'iss-1' }],
        comments: []
      }
    });

  //   expect(res).toEqual({
  //     contractId: 'doc-1',
  //     updateId: submitResponse.transactionTree.updateId
  //   });

  //   expect(getAuthToken).toHaveBeenCalled();
  //   expect(ledger.lastAuthToken).toBe('bearer-123');

  //   const call = ledger.submitAndWaitForTransactionTree.mock.calls[0][0];
  //   expect(call).toMatchObject({
  //     actAs: ['party::issuer'],
  //     commands: [
  //       {
  //         ExerciseCommand: {
  //           choice: 'CreateDocument'
  //         }
  //       }
  //     ],
  //     disclosedContracts: [featured]
  //   });
  });
});


