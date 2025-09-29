import { OcpClient } from '../../src';

describe('get: getDocumentAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.document.getDocumentAsOcf({ contractId: 'document-minimal' });
    expect(res).toEqual({
      document: {
        object_type: 'DOCUMENT',
        id: 'doc-1',
        path: '/files/doc.pdf',
        md5: 'abc123',
        related_objects: [],
        comments: []
      },
      contractId: 'document-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.document.getDocumentAsOcf({ contractId: 'document-full' });
    expect(res).toEqual({
      document: {
        object_type: 'DOCUMENT',
        id: '6d86e6c0-4aef-4756-93f5-2895492239e5',
        uri: 's3://series-private/s3_dev/portal/028fc334-d093-4618-b95f-6035ad336a8e/0687b5ccbb3d2a1178bf187682dbf7450fa4beb9',
        md5: '5ed9abcb64985d40c1417d278d3a7262',
        related_objects: [],
        comments: [
          'filename: The_source_Contractors_X_Contis_Test_Equity_Grant_Agreement_-_Signed_October_18,_2024.pdf'
        ]
      },
      contractId: 'document-full'
    });
  });
});


