/**
 * Unit tests for Issuer type converters.
 *
 * Tests OCF to DAML conversion for:
 * - Canonical issuer array normalization
 * - Canonical typed issuer input acceptance
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  buildCreateIssuerCommand,
  issuerDataToDaml,
  normalizeIssuerData,
} from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { damlIssuerDataToNative } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import type { OcfIssuer } from '../../src/types/native';

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

  describe('initial shares Numeric(10) boundary', () => {
    const baseIssuerData: OcfIssuer = {
      object_type: 'ISSUER',
      id: 'issuer-initial-shares',
      legal_name: 'Initial Shares Corp',
      formation_date: '2020-01-01',
      country_of_formation: 'US',
      tax_ids: [],
    };

    test('public Issuer writer accepts and canonicalizes a leading plus', () => {
      expect(issuerDataToDaml({ ...baseIssuerData, initial_shares_authorized: '+1' })).toMatchObject({
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1' },
      });
    });

    test.each([
      ['eleven fractional digits', '1.00000000000'],
      ['twenty-nine integral digits', '1'.repeat(29)],
    ])('public Issuer writer rejects %s with exact diagnostics', (_case, value) => {
      const error = captureValidationError(() =>
        issuerDataToDaml({ ...baseIssuerData, initial_shares_authorized: value })
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'issuer.initial_shares_authorized',
        receivedValue: value,
      });
    });

    test('public Issuer writer rejects negative initial shares as out of range', () => {
      const error = captureValidationError(() =>
        issuerDataToDaml({ ...baseIssuerData, initial_shares_authorized: '-1' })
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'issuer.initial_shares_authorized',
        receivedValue: '-1',
      });
    });

    test('public Issuer writer rejects a non-string with the exact type diagnostic before schema parsing', () => {
      const value = 42;
      const error = captureValidationError(() =>
        issuerDataToDaml({
          ...baseIssuerData,
          initial_shares_authorized: value,
        } as unknown as OcfIssuer)
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'issuer.initial_shares_authorized',
        receivedValue: value,
      });
    });

    test('public Issuer reader accepts and canonicalizes a leading plus', () => {
      const daml = issuerDataToDaml(baseIssuerData, { skipSchemaParse: true });
      expect(
        damlIssuerDataToNative({
          ...daml,
          initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '+1' },
        }).initial_shares_authorized
      ).toBe('1');
    });

    test.each([
      ['eleven fractional digits', '1.00000000000'],
      ['twenty-nine integral digits', '1'.repeat(29)],
    ])('public Issuer reader rejects %s with exact diagnostics', (_case, value) => {
      const daml = issuerDataToDaml(baseIssuerData, { skipSchemaParse: true });
      const error = captureValidationError(() =>
        damlIssuerDataToNative({
          ...daml,
          initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value },
        })
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'issuer.initial_shares_authorized.value',
        receivedValue: value,
      });
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

    test('command builder preserves exact initial-shares diagnostics from the default public writer', () => {
      const value = '1.00000000000';
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          object_type: 'ISSUER' as const,
          initial_shares_authorized: value,
        },
      };

      expect(captureValidationError(() => buildCreateIssuerCommand(params))).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'issuer.initial_shares_authorized',
        receivedValue: value,
      });
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
  });
});
