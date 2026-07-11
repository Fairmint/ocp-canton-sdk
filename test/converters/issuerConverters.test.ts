/**
 * Unit tests for Issuer type converters.
 *
 * Tests OCF to DAML conversion for:
 * - Canonical issuer array normalization
 * - Canonical typed issuer input acceptance
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  buildCreateIssuerCommand,
  issuerDataToDaml,
  normalizeIssuerData,
} from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { damlIssuerDataToNative, getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import type { OcfIssuer } from '../../src/types/native';

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
}

describe('Issuer Converters', () => {
  describe('normalizeIssuerData', () => {
    const baseIssuerData = {
      id: 'issuer-001',
      legal_name: 'Test Corporation',
      formation_date: '2020-01-01',
      country_of_formation: 'US',
    };

    test('normalizes undefined tax_ids to empty array', () => {
      const input = {
        ...baseIssuerData,
        // tax_ids is undefined
        object_type: 'ISSUER' as const,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toEqual([]);
    });

    test('preserves existing tax_ids array', () => {
      const taxIds = [{ country: 'US', tax_id: '12-3456789' }];
      const input = {
        ...baseIssuerData,
        tax_ids: taxIds,
        object_type: 'ISSUER' as const,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toBe(taxIds);
    });

    test('preserves empty tax_ids array', () => {
      const taxIds: OcfIssuer['tax_ids'] = [];
      const input = {
        ...baseIssuerData,
        tax_ids: taxIds,
        object_type: 'ISSUER' as const,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toBe(taxIds);
    });

    test('preserves all other fields unchanged', () => {
      const input = {
        ...baseIssuerData,
        tax_ids: [],
        dba: 'Test DBA',
        country_subdivision_of_formation: 'DE',
        comments: ['comment 1'],
        object_type: 'ISSUER' as const,
      };

      const result = normalizeIssuerData(input);

      expect(result.id).toBe(input.id);
      expect(result.legal_name).toBe(input.legal_name);
      expect(result.formation_date).toBe(input.formation_date);
      expect(result.country_of_formation).toBe(input.country_of_formation);
      expect(result.dba).toBe(input.dba);
      expect(result.country_subdivision_of_formation).toBe(input.country_subdivision_of_formation);
      expect(result.comments).toBe(input.comments);
    });
  });

  describe('buildCreateIssuerCommand', () => {
    const mockDisclosedContract: DisclosedContract = {
      templateId: 'test:IssuerAuthorization:1.0.0',
      contractId: 'contract-123',
      createdEventBlob: 'blob',
      synchronizerId: 'sync-1',
    };

    const baseIssuerData = {
      id: 'issuer-001',
      legal_name: 'Test Corporation',
      formation_date: '2020-01-01',
      country_of_formation: 'US',
    };

    test('rejects explicit null tax_ids at the typed boundary', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          tax_ids: null,
          object_type: 'ISSUER' as const,
        } as unknown as OcfIssuer,
      };

      expect(() => buildCreateIssuerCommand(params)).toThrow();
    });

    test('accepts issuer data with undefined tax_ids', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          // tax_ids is undefined
          object_type: 'ISSUER' as const,
        },
      };

      // Should not throw
      const result = buildCreateIssuerCommand(params);

      expect(result.command).toBeDefined();
      expect(result.disclosedContracts).toBeDefined();
    });

    test('accepts issuer data with empty tax_ids array', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          tax_ids: [],
          object_type: 'ISSUER' as const,
        },
      };

      // Should not throw
      const result = buildCreateIssuerCommand(params);

      expect(result.command).toBeDefined();
      expect(result.disclosedContracts).toBeDefined();
    });

    test('accepts issuer data with populated tax_ids array', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          tax_ids: [{ country: 'US', tax_id: '12-3456789' }],
          object_type: 'ISSUER' as const,
        },
      };

      // Should not throw
      const result = buildCreateIssuerCommand(params);

      expect(result.command).toBeDefined();
      expect(result.disclosedContracts).toBeDefined();
    });
  });

  describe('issuerDataToDaml subdivision boundary', () => {
    const baseIssuerData: OcfIssuer = {
      object_type: 'ISSUER',
      id: 'issuer-001',
      legal_name: 'Test Corporation',
      formation_date: '2020-01-01',
      country_of_formation: 'US',
      tax_ids: [],
    };

    it('allows subdivision omission and encodes both DAML optionals as null', () => {
      expect(issuerDataToDaml(baseIssuerData, { skipSchemaParse: true })).toMatchObject({
        country_subdivision_of_formation: null,
        country_subdivision_name_of_formation: null,
      });
    });

    it.each([
      ['empty subdivision code', 'country_subdivision_of_formation', '', OcpErrorCodes.INVALID_FORMAT],
      ['blank subdivision code', 'country_subdivision_of_formation', '   ', OcpErrorCodes.INVALID_FORMAT],
      ['null subdivision code', 'country_subdivision_of_formation', null, OcpErrorCodes.INVALID_TYPE],
      ['numeric subdivision code', 'country_subdivision_of_formation', 42, OcpErrorCodes.INVALID_TYPE],
      ['empty subdivision name', 'country_subdivision_name_of_formation', '', OcpErrorCodes.INVALID_FORMAT],
      ['blank subdivision name', 'country_subdivision_name_of_formation', '\t', OcpErrorCodes.INVALID_FORMAT],
      ['null subdivision name', 'country_subdivision_name_of_formation', null, OcpErrorCodes.INVALID_TYPE],
      ['numeric subdivision name', 'country_subdivision_name_of_formation', 42, OcpErrorCodes.INVALID_TYPE],
    ] as const)('classifies %s before DAML optional-string normalization', (_case, field, subdivision, code) => {
      const input = { ...baseIssuerData, [field]: subdivision } as unknown as OcfIssuer;
      const error = captureValidationError(() => issuerDataToDaml(input, { skipSchemaParse: true }));
      expect(error).toMatchObject({
        code,
        expectedType: 'non-blank string or omitted',
        fieldPath: `issuer.${field}`,
        receivedValue: subdivision,
      });
    });

    it.each([
      ['subdivision code', 'country_subdivision_of_formation', 'DE'],
      ['subdivision name', 'country_subdivision_name_of_formation', 'Delaware'],
    ] as const)('preserves a valid %s', (_case, field, subdivision) => {
      const input = { ...baseIssuerData, [field]: subdivision } as OcfIssuer;
      expect(issuerDataToDaml(input, { skipSchemaParse: true })).toMatchObject({ [field]: subdivision });
    });

    it('canonicalizes schema-valid signed initial shares within Numeric 10 bounds', () => {
      expect(
        issuerDataToDaml(
          { ...baseIssuerData, initial_shares_authorized: '+0001.2300000000' },
          { skipSchemaParse: true }
        )
      ).toMatchObject({
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1.23' },
      });
    });
  });

  describe('damlIssuerDataToNative', () => {
    const baseDamlIssuer = {
      id: 'issuer-read-1',
      legal_name: 'Invalid Issuer',
      country_of_formation: 'US',
      dba: null,
      formation_date: '2026-01-01T00:00:00.000Z',
      country_subdivision_of_formation: null,
      country_subdivision_name_of_formation: null,
      tax_ids: [],
      email: null,
      phone: null,
      address: null,
      initial_shares_authorized: null,
      comments: [],
    };

    test('rejects a ledger issuer with both subdivision representations', () => {
      const damlIssuer = {
        ...baseDamlIssuer,
        id: 'issuer-read-1',
        country_subdivision_of_formation: 'DE',
        country_subdivision_name_of_formation: 'Delaware',
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow('both subdivision code and subdivision name');
    });

    test.each([
      ['subdivision code', { country_subdivision_of_formation: '' }, 'country_subdivision_of_formation'],
      ['subdivision name', { country_subdivision_name_of_formation: '' }, 'country_subdivision_name_of_formation'],
      [
        'both subdivisions',
        { country_subdivision_of_formation: '', country_subdivision_name_of_formation: '' },
        'country_subdivision_of_formation',
      ],
    ])('rejects empty ledger %s', (_case, subdivisionFields, expectedField) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        ...subdivisionFields,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(OcpParseError);
      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(expectedField);
    });

    test.each(['abcd', 'de', 'D-', ' ', '\t', 'ABCD'])('rejects invalid ledger subdivision code %p', (code) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        country_subdivision_of_formation: code,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      try {
        damlIssuerDataToNative(damlIssuer);
        throw new Error('Expected subdivision parsing to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          source: 'getIssuerAsOcf.country_subdivision_of_formation',
          context: expect.objectContaining({ receivedValue: code }),
        });
      }
    });

    test.each(['A', 'D3', 'USA'])('accepts exact ledger subdivision code %p', (code) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        country_subdivision_of_formation: code,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(damlIssuerDataToNative(damlIssuer).country_subdivision_of_formation).toBe(code);
    });

    test.each([' ', '\t', '\n'])('rejects blank ledger subdivision name %p', (name) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        country_subdivision_name_of_formation: name,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.INVALID_FORMAT,
          source: 'getIssuerAsOcf.country_subdivision_name_of_formation',
        })
      );
    });

    test.each([
      ['legacy primitive string', '1000', 'getIssuerAsOcf.initial_shares_authorized', OcpErrorCodes.SCHEMA_MISMATCH],
      ['legacy primitive number', 1000, 'getIssuerAsOcf.initial_shares_authorized', OcpErrorCodes.SCHEMA_MISMATCH],
      ['missing tag', { value: '1000' }, 'getIssuerAsOcf.initial_shares_authorized.tag', OcpErrorCodes.SCHEMA_MISMATCH],
      [
        'unknown tag',
        { tag: 'OcfInitialSharesMystery', value: '1000' },
        'getIssuerAsOcf.initial_shares_authorized.tag',
        OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      ],
      [
        'malformed numeric value',
        { tag: 'OcfInitialSharesNumeric', value: 1000 },
        'getIssuerAsOcf.initial_shares_authorized.value',
        OcpErrorCodes.SCHEMA_MISMATCH,
      ],
      [
        'unknown enum value',
        { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesSurprise' },
        'getIssuerAsOcf.initial_shares_authorized.value',
        OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      ],
      [
        'malformed enum value',
        { tag: 'OcfInitialSharesEnum', value: 0 },
        'getIssuerAsOcf.initial_shares_authorized.value',
        OcpErrorCodes.SCHEMA_MISMATCH,
      ],
      [
        'unexpected variant field',
        { tag: 'OcfInitialSharesNumeric', value: '1000', legacy: true },
        'getIssuerAsOcf.initial_shares_authorized.legacy',
        OcpErrorCodes.SCHEMA_MISMATCH,
      ],
    ] as const)('rejects %s instead of omitting or defaulting it', (_case, initialShares, source, code) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        initial_shares_authorized: initialShares,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(
        expect.objectContaining({ name: OcpParseError.name, source, code })
      );
    });

    test.each([
      [{ tag: 'OcfInitialSharesNumeric', value: '1000.0000000000' }, '1000'],
      [{ tag: 'OcfInitialSharesNumeric', value: '+0001.2300000000' }, '1.23'],
      [{ tag: 'OcfInitialSharesNumeric', value: '0000000001' }, '1'],
      [{ tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesUnlimited' }, 'UNLIMITED'],
      [{ tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesNotApplicable' }, 'NOT APPLICABLE'],
    ] as const)('accepts the exact generated initial-shares variant %o', (initialShares, expected) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        initial_shares_authorized: initialShares,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(damlIssuerDataToNative(damlIssuer).initial_shares_authorized).toBe(expected);
    });

    test.each([
      ['eleven decimal places', '1.12345678901'],
      ['twenty-nine integer digits', '1'.repeat(29)],
    ])('rejects initial shares with %s at the exact Numeric 10 path', (_case, value) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value },
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code: OcpErrorCodes.INVALID_FORMAT,
          source: 'getIssuerAsOcf.initial_shares_authorized.value',
        })
      );
    });

    test.each([
      ['unknown root field', { unexpected: true }, 'getIssuerAsOcf.unexpected'],
      ['malformed comments', { comments: 42 }, 'getIssuerAsOcf.comments'],
    ])('rejects %s without returning an unsound issuer', (_case, fields, source) => {
      const damlIssuer = {
        ...baseDamlIssuer,
        ...fields,
      } as unknown as Parameters<typeof damlIssuerDataToNative>[0];

      expect(() => damlIssuerDataToNative(damlIssuer)).toThrow(
        expect.objectContaining({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source })
      );
    });

    test('dedicated reader rejects an unknown initial-shares enum instead of defaulting it', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
            createArgument: {
              context: GENERATED_CONTEXT,
              issuer_data: {
                ...baseDamlIssuer,
                initial_shares_authorized: {
                  tag: 'OcfInitialSharesEnum',
                  value: 'OcfAuthorizedSharesSurprise',
                },
              },
            },
          },
        },
      });

      await expect(
        getIssuerAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
          contractId: 'issuer-unknown-initial-shares',
        })
      ).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: 'getIssuerAsOcf.initial_shares_authorized.value',
      });
    });

    test('dedicated reader rejects malformed comments at the exact issuer path', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
            createArgument: {
              context: GENERATED_CONTEXT,
              issuer_data: { ...baseDamlIssuer, comments: 42 },
            },
          },
        },
      });

      await expect(
        getIssuerAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
          contractId: 'issuer-malformed-comments',
        })
      ).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'getIssuerAsOcf.comments',
      });
    });
  });
});
