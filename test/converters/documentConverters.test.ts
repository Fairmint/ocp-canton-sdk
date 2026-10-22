import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable';
import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import { getDocumentAsOcf } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import type { OcfDocument } from '../../src/types';

const GENERATED_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
  transfer_agent: 'transfer-agent::party',
  cap_table_id: 'cap-table-1',
} as const;

describe('Document converters', () => {
  it.each([
    {
      location: 'path',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-path',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
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
        uri: 'https://example.com/agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: null,
      expectedUri: 'https://example.com/agreement.pdf',
    },
  ])(
    'encodes a canonical $location document with a null DAML inactive optional',
    ({ document, expectedPath, expectedUri }) => {
      expect(documentDataToDaml(document)).toMatchObject({
        path: expectedPath,
        uri: expectedUri,
      });
    }
  );

  it.each([
    {
      location: 'path',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-dispatch-path',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: './agreement.pdf',
      expectedUri: null,
    },
    {
      location: 'uri',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-dispatch-uri',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        uri: 'https://example.com/agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: null,
      expectedUri: 'https://example.com/agreement.pdf',
    },
  ] as const)(
    'encodes a canonical $location document through the convertToDamlData dispatcher',
    ({ document, expectedPath, expectedUri }) => {
      expect(convertToDamlData('document', document)).toMatchObject({
        path: expectedPath,
        uri: expectedUri,
      });
    }
  );

  it.each([
    ['both locations omitted', {}],
    ['both locations null', { path: null, uri: null }],
    ['both locations populated', { path: './agreement.pdf', uri: 'https://example.com/agreement.pdf' }],
    ['null inactive uri', { path: './agreement.pdf', uri: null }],
    ['null inactive path', { path: null, uri: 'https://example.com/agreement.pdf' }],
  ])('rejects a document with %s through convertToDamlData', (_case, locations) => {
    const invalidDocument = {
      object_type: 'DOCUMENT',
      id: 'document-invalid',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      ...locations,
    } as unknown as OcfDocument;

    expect(() => convertToDamlData('document', invalidDocument)).toThrow(OcpValidationError);
  });

  it('dedicated reader rejects unknown document fields losslessly', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            ocf_data: {
              id: 'document-lossy',
              md5: 'd41d8cd98f00b204e9800998ecf8427e',
              path: './agreement.pdf',
              uri: null,
              related_objects: [],
              comments: [],
              unexpected: true,
            },
          },
        },
      },
    });

    await expect(
      getDocumentAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
        contractId: 'document-lossy',
      })
    ).rejects.toMatchObject({
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'document.unexpected',
    });
  });
});
