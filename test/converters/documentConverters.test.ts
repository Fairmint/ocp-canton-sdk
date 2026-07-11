import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import type { OcfDocument } from '../../src/types';

describe('Document converters', () => {
  it.each([
    {
      location: 'path',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-path',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
        uri: null,
      } satisfies OcfDocument,
      expectedPath: './agreement.pdf',
      expectedUri: null,
    },
    {
      location: 'uri',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-uri',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: null,
        uri: 'https://example.com/agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: null,
      expectedUri: 'https://example.com/agreement.pdf',
    },
  ])('accepts a $location location with a null inactive optional', ({ document, expectedPath, expectedUri }) => {
    expect(documentDataToDaml(document)).toMatchObject({
      path: expectedPath,
      uri: expectedUri,
    });
  });
});
