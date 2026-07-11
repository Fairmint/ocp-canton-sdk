import { OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable';
import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import type { OcfDocument } from '../../src/types';

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

  it.each([
    {
      operation: 'create',
      document: {
        object_type: 'DOCUMENT',
        id: 'document-create-path',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
        uri: null,
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
        path: null,
        uri: 'https://example.com/agreement.pdf',
      } satisfies OcfDocument,
      expectedPath: null,
      expectedUri: 'https://example.com/agreement.pdf',
    },
  ] as const)(
    'accepts a null inactive location through CapTableBatch.$operation',
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
});
