import { damlDocumentDataToNative, damlStakeholderDataToNative, OcpValidationError } from '../../src';

const minimalStakeholder = {
  id: 'stakeholder-read-1',
  name: { legal_name: 'Ada Lovelace', first_name: 'Ada', last_name: 'Lovelace' },
  stakeholder_type: 'OcfStakeholderTypeIndividual',
  issuer_assigned_id: null,
  current_relationships: [],
  current_status: null,
  primary_contact: null,
  contact_info: null,
  addresses: [],
  tax_ids: [],
  comments: [],
};

const minimalDocument = {
  id: 'document-read-1',
  path: null,
  uri: 'https://example.com/document.pdf',
  md5: 'd7acc4c968bdff9bc9369b0c34703814',
  related_objects: [],
  comments: [],
};

function asDamlStakeholder(value: object): Parameters<typeof damlStakeholderDataToNative>[0] {
  return value as unknown as Parameters<typeof damlStakeholderDataToNative>[0];
}

function asDamlDocument(value: object): Parameters<typeof damlDocumentDataToNative>[0] {
  return value as unknown as Parameters<typeof damlDocumentDataToNative>[0];
}

describe('core DAML read converter required fields', () => {
  test('returns complete canonical stakeholder and document objects', () => {
    const stakeholder = damlStakeholderDataToNative(asDamlStakeholder(minimalStakeholder));
    const document = damlDocumentDataToNative(asDamlDocument(minimalDocument));

    expect(stakeholder).toMatchObject({
      object_type: 'STAKEHOLDER',
      id: minimalStakeholder.id,
      name: { legal_name: minimalStakeholder.name.legal_name },
    });
    expect(document).toMatchObject({ object_type: 'DOCUMENT', id: minimalDocument.id });
  });

  test.each([
    ['stakeholder id', () => damlStakeholderDataToNative(asDamlStakeholder({ ...minimalStakeholder, id: '' }))],
    [
      'stakeholder legal name',
      () =>
        damlStakeholderDataToNative(
          asDamlStakeholder({ ...minimalStakeholder, name: { ...minimalStakeholder.name, legal_name: '' } })
        ),
    ],
    ['document id', () => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, id: '' }))],
  ])('rejects a missing %s instead of synthesizing an empty required field', (_field, convert) => {
    expect(convert).toThrow(OcpValidationError);
  });

  test.each([
    ['neither location', { ...minimalDocument, path: null, uri: null }],
    ['both locations', { ...minimalDocument, path: './document.pdf', uri: 'https://example.com/document.pdf' }],
  ])('rejects a document with %s', (_case, document) => {
    expect(() => damlDocumentDataToNative(asDamlDocument(document))).toThrow(OcpValidationError);
  });
});
