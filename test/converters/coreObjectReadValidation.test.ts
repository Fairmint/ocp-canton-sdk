import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src';
import type { ReadonlyDamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
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

function asDamlStakeholder(value: object): ReadonlyDamlDataTypeFor<'stakeholder'> {
  return value as unknown as ReadonlyDamlDataTypeFor<'stakeholder'>;
}

function asDamlDocument(value: object): Parameters<typeof damlDocumentDataToNative>[0] {
  return value;
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

  test('returns a detached, deeply frozen stakeholder snapshot with ordered duplicate relationships', () => {
    const input = {
      ...minimalStakeholder,
      current_relationships: ['OcfRelInvestor', 'OcfRelAdvisor', 'OcfRelInvestor'],
      primary_contact: {
        name: { legal_name: 'Ada Lovelace', first_name: 'Ada', last_name: 'Lovelace' },
        phone_numbers: [{ phone_type: 'OcfPhoneMobile', phone_number: '+12025550123' }],
        emails: [{ email_type: 'OcfEmailTypeBusiness', email_address: 'ada@example.com' }],
      },
      contact_info: {
        phone_numbers: [{ phone_type: 'OcfPhoneHome', phone_number: '+12025550124' }],
        emails: [],
      },
      addresses: [
        {
          address_type: 'OcfAddressTypeLegal',
          country: 'US',
          city: 'New York',
          country_subdivision: 'NY',
          postal_code: '10001',
          street_suite: '1 Main St',
        },
      ],
      tax_ids: [{ country: 'US', tax_id: '12-3456789' }],
      comments: ['canonical snapshot'],
    };

    const stakeholder = damlStakeholderDataToNative(asDamlStakeholder(input));

    expect(stakeholder.current_relationships).toEqual(['INVESTOR', 'ADVISOR', 'INVESTOR']);
    expect(Object.isFrozen(stakeholder)).toBe(true);
    expect(Object.isFrozen(stakeholder.name)).toBe(true);
    expect(Object.isFrozen(stakeholder.current_relationships)).toBe(true);
    expect(Object.isFrozen(stakeholder.primary_contact)).toBe(true);
    expect(Object.isFrozen(stakeholder.primary_contact?.name)).toBe(true);
    expect(Object.isFrozen(stakeholder.primary_contact?.phone_numbers)).toBe(true);
    expect(Object.isFrozen(stakeholder.primary_contact?.phone_numbers?.[0])).toBe(true);
    expect(Object.isFrozen(stakeholder.contact_info?.emails)).toBe(true);
    expect(Object.isFrozen(stakeholder.addresses)).toBe(true);
    expect(Object.isFrozen(stakeholder.addresses?.[0])).toBe(true);
    expect(Object.isFrozen(stakeholder.tax_ids)).toBe(true);
    expect(Object.isFrozen(stakeholder.tax_ids?.[0])).toBe(true);
    expect(Object.isFrozen(stakeholder.comments)).toBe(true);

    input.current_relationships[0] = 'OcfRelFounder';
    input.comments[0] = 'mutated source';
    expect(stakeholder.current_relationships).toEqual(['INVESTOR', 'ADVISOR', 'INVESTOR']);
    expect(stakeholder.comments).toEqual(['canonical snapshot']);
    expect(() => (stakeholder.current_relationships as string[]).push('FOUNDER')).toThrow(TypeError);
  });

  test('rejects a proxied stakeholder before invoking any trap', () => {
    const traps = {
      get: jest.fn(() => {
        throw new Error('stakeholder get trap invoked');
      }),
      getPrototypeOf: jest.fn(() => {
        throw new Error('stakeholder getPrototypeOf trap invoked');
      }),
      ownKeys: jest.fn(() => {
        throw new Error('stakeholder ownKeys trap invoked');
      }),
    };
    const stakeholder = new Proxy(minimalStakeholder, traps);

    expect(() => damlStakeholderDataToNative(asDamlStakeholder(stakeholder))).toThrow(
      expect.objectContaining({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source: 'stakeholder' })
    );
    expect(Object.values(traps).every((trap) => trap.mock.calls.length === 0)).toBe(true);
  });

  test('bounds oversized stakeholder relationship arrays before direct or dispatched decoding', () => {
    const oversizedRelationships = Array.from({ length: 100_001 }, () => 'OcfRelInvestor');
    const stakeholder = asDamlStakeholder({ ...minimalStakeholder, current_relationships: oversizedRelationships });
    const expectedError = expect.objectContaining({
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'stakeholder.current_relationships',
    });

    expect(() => damlStakeholderDataToNative(stakeholder)).toThrow(expectedError);
    expect(() => convertToOcf('stakeholder', stakeholder)).toThrow(expectedError);
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
    [null, OcpErrorCodes.SCHEMA_MISMATCH],
    [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
  ] as const)('classifies a nullish stakeholder root %p', (value, code) => {
    expect(() => damlStakeholderDataToNative(value)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code,
        source: 'stakeholder',
      })
    );
  });

  test('validates nested stakeholder semantics after generated conversion', () => {
    expect(() =>
      damlStakeholderDataToNative({
        ...minimalStakeholder,
        primary_contact: {
          name: { legal_name: 'Primary Contact', first_name: null, last_name: null },
          phone_numbers: [],
          emails: [{ email_type: 'OcfEmailTypeBusiness', email_address: '' }],
        },
      })
    ).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        fieldPath: 'stakeholder.primary_contact.emails[0].email_address',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      })
    );
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

  test('rejects unknown document fields instead of dropping them', () => {
    expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, unexpected: true }))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.unexpected',
      })
    );
  });

  test('rejects malformed document comments at their exact path', () => {
    expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, comments: 42 }))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.comments',
      })
    );
  });

  test('rejects a malformed document MD5 checksum at its exact path', () => {
    expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, md5: 'not-an-md5' }))).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'document.md5',
      })
    );
  });

  test('rejects document accessors without invoking them', () => {
    const getter = jest.fn(() => './document.pdf');
    const document = { ...minimalDocument } as Record<string, unknown>;
    Object.defineProperty(document, 'path', { enumerable: true, get: getter });

    expect(() => damlDocumentDataToNative(asDamlDocument(document))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.path',
      })
    );
    expect(getter).not.toHaveBeenCalled();
  });

  test('rejects custom document prototypes', () => {
    const document = { ...minimalDocument } as Record<string, unknown>;
    Object.setPrototypeOf(document, { inherited: true });

    expect(() => damlDocumentDataToNative(asDamlDocument(document))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document',
      })
    );
  });

  test('rejects sparse generated arrays at the missing index', () => {
    const comments = new Array<string>(1);

    expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, comments }))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.comments[0]',
      })
    );
  });

  test('rejects a maximum-length sparse generated array without scanning its length', () => {
    const comments = new Array<string>(2 ** 32 - 1);

    expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, comments }))).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.comments[0]',
      })
    );
  });

  test('keeps structural diagnostics bounded for a maximum-length array', () => {
    const comments = new Array<string>(2 ** 32 - 1);
    Object.setPrototypeOf(comments, {});

    try {
      damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, comments }));
      throw new Error('Expected custom-prototype array to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'document.comments',
        context: { receivedValue: { containerType: 'array' } },
      });
      expect(JSON.stringify((error as OcpParseError).context).length).toBeLessThan(100);
    }
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite generated JSON number %p at its exact path',
    (path) => {
      expect(() => damlDocumentDataToNative(asDamlDocument({ ...minimalDocument, path }))).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'document.path',
        })
      );
    }
  );
});
