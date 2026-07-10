/**
 * Unit tests for Issuer type converters.
 *
 * Tests OCF to DAML conversion for:
 * - Canonical issuer array normalization
 * - Canonical typed issuer input acceptance
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpParseError } from '../../src/errors';
import { buildCreateIssuerCommand, normalizeIssuerData } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { damlIssuerDataToNative } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import type { OcfIssuer } from '../../src/types/native';

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
