import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable';
import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import { getDocumentAsOcf } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import type { OcfDocument } from '../../src/types';

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function requireDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

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
      operation: 'create',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-create-path',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: './agreement.pdf',
      expectedUri: null,
    },
    {
      operation: 'edit',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-edit-uri',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        uri: 'https://example.com/agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: null,
      expectedUri: 'https://example.com/agreement.pdf',
    },
  ] as const)(
    'encodes a canonical document through CapTableBatch.$operation',
    ({ operation, document, expectedPath, expectedUri }) => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      if (operation === 'create') {
        batch.create('document', document);
      } else {
        batch.edit('document', document);
      }

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');
      const choiceArgument = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ value: Record<string, unknown> }>;
        edits: Array<{ value: Record<string, unknown> }>;
      };
      const convertedOperation = requireDefined(
        operation === 'create' ? choiceArgument.creates[0] : choiceArgument.edits[0],
        `Expected one ${operation} operation`
      );

      expect(convertedOperation.value).toMatchObject({
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
  ])('rejects a document with %s through CapTableBatch.create', (_case, locations) => {
    const batch = new CapTableBatch({
      capTableContractId: 'cap-table-123',
      actAs: ['party-1'],
    });
    const invalidDocument = {
      object_type: 'DOCUMENT',
      id: 'document-invalid',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      ...locations,
    } as unknown as OcfDocument;

    expect(() => batch.create('document', invalidDocument)).toThrow(OcpValidationError);
    expect(batch.size).toBe(0);
  });

  it('dedicated reader rejects unknown document fields losslessly', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            document_data: {
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
