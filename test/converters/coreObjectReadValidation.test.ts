import { OcpErrorCodes, OcpValidationError } from '../../src';
import { damlDocumentDataToNative } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import { damlStakeholderDataToNative } from '../../src/functions/OpenCapTable/stakeholder/getStakeholderAsOcf';

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
    ['OcfObjTxPlanSecurityAcceptance', 'TX_EQUITY_COMPENSATION_ACCEPTANCE'],
    ['OcfObjTxPlanSecurityCancellation', 'TX_EQUITY_COMPENSATION_CANCELLATION'],
    ['OcfObjTxPlanSecurityExercise', 'TX_EQUITY_COMPENSATION_EXERCISE'],
    ['OcfObjTxPlanSecurityIssuance', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
    ['OcfObjTxPlanSecurityRelease', 'TX_EQUITY_COMPENSATION_RELEASE'],
    ['OcfObjTxPlanSecurityRetraction', 'TX_EQUITY_COMPENSATION_RETRACTION'],
    ['OcfObjTxPlanSecurityTransfer', 'TX_EQUITY_COMPENSATION_TRANSFER'],
  ] as const)('canonicalizes legacy DAML document reference %s on read', (damlObjectType, canonicalObjectType) => {
    const document = damlDocumentDataToNative(
      asDamlDocument({
        ...minimalDocument,
        related_objects: [{ object_type: damlObjectType, object_id: 'legacy-reference-1' }],
      })
    );

    expect(document.related_objects).toEqual([{ object_type: canonicalObjectType, object_id: 'legacy-reference-1' }]);
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
    ['an empty path', { ...minimalDocument, path: '', uri: null }],
    ['an empty uri', { ...minimalDocument, path: null, uri: '' }],
  ])('rejects a document with %s', (_case, document) => {
    expect(() => damlDocumentDataToNative(asDamlDocument(document))).toThrow(OcpValidationError);
  });

  test.each([
    ['numeric path', 'document.path', { ...minimalDocument, path: 42 }],
    ['object uri', 'document.uri', { ...minimalDocument, path: './document.pdf', uri: {} }],
    ['array path', 'document.path', { ...minimalDocument, path: [], uri: 'https://example.com/document.pdf' }],
  ])('rejects a malformed %s instead of treating it as absent', (_case, fieldPath, document) => {
    try {
      damlDocumentDataToNative(asDamlDocument(document));
      throw new Error('Expected malformed document location to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath,
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
  });
});
