/**
 * Unit tests for Issuer type converters.
 *
 * Tests OCF to DAML conversion for:
 * - Issuer data normalization (tax_ids array normalization)
 * - IssuerDataInput type acceptance
 *
 * These tests ensure the SDK handles raw OCF data where optional array fields
 * may be null or undefined, normalizing them to empty arrays as required by DAML.
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { buildCreateIssuerCommand, normalizeIssuerData } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import type { OcfIssuer } from '../../src/types/native';

describe('Issuer Converters', () => {
  describe('normalizeIssuerData', () => {
    const baseIssuerData = {
      id: 'issuer-001',
      legal_name: 'Test Corporation',
      formation_date: '2020-01-01',
      country_of_formation: 'US',
    };

    test('normalizes null tax_ids to empty array', () => {
      const input = {
        ...baseIssuerData,
        tax_ids: null,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toEqual([]);
    });

    test('normalizes undefined tax_ids to empty array', () => {
      const input = {
        ...baseIssuerData,
        // tax_ids is undefined
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toEqual([]);
    });

    test('preserves existing tax_ids array', () => {
      const taxIds = [{ country: 'US', tax_id: '12-3456789' }];
      const input = {
        ...baseIssuerData,
        tax_ids: taxIds,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toBe(taxIds);
    });

    test('preserves empty tax_ids array', () => {
      const taxIds: OcfIssuer['tax_ids'] = [];
      const input = {
        ...baseIssuerData,
        tax_ids: taxIds,
      };

      const result = normalizeIssuerData(input);

      expect(result.tax_ids).toBe(taxIds);
    });

    test('preserves all other fields unchanged', () => {
      const input = {
        ...baseIssuerData,
        tax_ids: null,
        dba: 'Test DBA',
        country_subdivision_of_formation: 'DE',
        comments: ['comment 1'],
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

    test('accepts issuer data with null tax_ids', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          tax_ids: null,
        },
      };

      // Should not throw
      const result = buildCreateIssuerCommand(params);

      expect(result.command).toBeDefined();
      expect(result.disclosedContracts).toBeDefined();
    });

    test('accepts issuer data with undefined tax_ids', () => {
      const params = {
        issuerAuthorizationContractDetails: mockDisclosedContract,
        issuerParty: 'party-1',
        issuerData: {
          ...baseIssuerData,
          // tax_ids is undefined
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
        },
      };

      // Should not throw
      const result = buildCreateIssuerCommand(params);

      expect(result.command).toBeDefined();
      expect(result.disclosedContracts).toBeDefined();
    });
  });
});
