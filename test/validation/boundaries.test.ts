/**
 * Tests for boundary conditions and edge cases.
 *
 * These tests verify that the SDK handles boundary conditions correctly, including maximum values, minimum values, and
 * special edge cases.
 */

import { OcpValidationError } from '../../src/errors';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import type { OcfStakeholder } from '../../src/types';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../src/utils/enumConversions';
import { requireFirst } from '../../src/utils/requireDefined';
import { normalizeNumericString, optionalString } from '../../src/utils/typeConversions';

function getDashboardPrimaryRelationshipFromDb(stakeholder: OcfStakeholder): string {
  const relationships = stakeholder.current_relationships ?? [];
  if (relationships.length > 0) {
    return requireFirst(relationships, 'stakeholder relationship');
  }
  return stakeholder.current_relationship ?? 'OTHER';
}

function getDashboardPrimaryRelationshipFromDaml(damlRelationships: DamlStakeholderRelationshipType[]): string {
  if (damlRelationships.length === 0) {
    return 'OTHER';
  }
  return damlStakeholderRelationshipToNative(requireFirst(damlRelationships, 'DAML stakeholder relationship'));
}

describe('Boundary Condition Tests', () => {
  describe('Numeric Boundaries', () => {
    test('normalizeNumericString handles various precision levels', () => {
      // Standard precision
      expect(normalizeNumericString('1234.5600')).toBe('1234.56');

      // High precision (common in blockchain)
      expect(normalizeNumericString('1234.567890123456789000')).toBe('1234.567890123456789');

      // Whole numbers represented with many trailing zeros
      expect(normalizeNumericString('1000000.00000000000000')).toBe('1000000');
    });

    test('normalizeNumericString rejects invalid inputs', () => {
      // Scientific notation (not supported)
      expect(() => normalizeNumericString('1.5e10')).toThrow();

      // Multiple decimal points
      expect(() => normalizeNumericString('1.2.3')).toThrow();

      // Letters mixed with numbers
      expect(() => normalizeNumericString('123abc')).toThrow();

      // Empty string
      expect(() => normalizeNumericString('')).toThrow();
    });
  });

  describe('String Boundaries', () => {
    test('optionalString handles various empty-like values', () => {
      expect(optionalString('')).toBeNull();
      expect(optionalString(null)).toBeNull();
      expect(optionalString(undefined)).toBeNull();
    });

    test('optionalString preserves whitespace-only strings', () => {
      // Whitespace-only strings are NOT considered empty
      // This matches DAML's text handling
      expect(optionalString(' ')).toBe(' ');
      expect(optionalString('  ')).toBe('  ');
      expect(optionalString('\t')).toBe('\t');
      expect(optionalString('\n')).toBe('\n');
    });

    test('handles Unicode strings correctly', () => {
      const unicodeData: OcfStakeholder = {
        id: 'sh-unicode',
        object_type: 'STAKEHOLDER',
        name: { legal_name: '日本語の名前' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const result = stakeholderDataToDaml(unicodeData);
      expect(result.name.legal_name).toBe('日本語の名前');
    });

    test('handles emoji in names correctly', () => {
      const emojiData: OcfStakeholder = {
        id: 'sh-emoji',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test 🚀 Corp' },
        stakeholder_type: 'INSTITUTION',
      };

      const result = stakeholderDataToDaml(emojiData);
      expect(result.name.legal_name).toBe('Test 🚀 Corp');
    });
  });

  describe('Array Boundaries', () => {
    test('stakeholder handles empty arrays correctly', () => {
      const dataWithEmptyArrays: OcfStakeholder = {
        id: 'sh-empty-arrays',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        addresses: [],
        tax_ids: [],
        current_relationships: [],
        comments: [],
      };

      const result = stakeholderDataToDaml(dataWithEmptyArrays);
      expect(result.addresses).toEqual([]);
      expect(result.tax_ids).toEqual([]);
      expect(result.current_relationships).toEqual([]);
      expect(result.comments).toEqual([]);
    });

    test('stakeholder handles undefined arrays correctly', () => {
      const dataWithUndefinedArrays: OcfStakeholder = {
        id: 'sh-undefined-arrays',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        // Arrays intentionally not provided
      };

      const result = stakeholderDataToDaml(dataWithUndefinedArrays);
      expect(result.addresses).toEqual([]);
      expect(result.tax_ids).toEqual([]);
      expect(result.current_relationships).toEqual([]);
      expect(result.comments).toEqual([]);
    });

    test('maps legacy current_relationship when current_relationships is missing', () => {
      const legacyRelationshipData: OcfStakeholder = {
        id: 'sh-legacy-relationship',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Legacy Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'FOUNDER',
      };

      const result = stakeholderDataToDaml(legacyRelationshipData);
      expect(result.current_relationships).toEqual(['OcfRelFounder']);
    });

    test('uses current_relationships when both relationship fields are present', () => {
      const bothFieldsData: OcfStakeholder = {
        id: 'sh-both-relationship-fields',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Both Fields Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'FOUNDER',
        current_relationships: ['ADVISOR'],
      };

      const result = stakeholderDataToDaml(bothFieldsData);
      expect(result.current_relationships).toEqual(['OcfRelAdvisor']);
    });

    test('preserves explicit empty current_relationships when both fields are present', () => {
      const bothFieldsWithExplicitEmptyArray: OcfStakeholder = {
        id: 'sh-both-empty-relationships',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Explicit Empty Relationships' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'FOUNDER',
        current_relationships: [],
      };

      const result = stakeholderDataToDaml(bothFieldsWithExplicitEmptyArray);
      expect(result.current_relationships).toEqual([]);
    });

    test('comments array filters out empty strings', () => {
      const dataWithComments: OcfStakeholder = {
        id: 'sh-comments',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        comments: ['Valid comment', '', 'Another comment', '  '],
      };

      const result = stakeholderDataToDaml(dataWithComments);
      // Empty strings and null should be filtered, but whitespace-only preserved if trimmed
      expect(result.comments).toContain('Valid comment');
      expect(result.comments).toContain('Another comment');
    });
  });

  describe('Null vs Undefined Handling', () => {
    test('OCF inputs reject explicit undefined while omitted DAML optionals use null', () => {
      const explicitUndefined: OcfStakeholder = {
        id: 'sh-null-test',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        issuer_assigned_id: undefined,
      };
      expect(() => stakeholderDataToDaml(explicitUndefined)).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          fieldPath: 'stakeholder.issuer_assigned_id',
        })
      );

      const omitted: OcfStakeholder = {
        id: 'sh-null-test',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
      };
      const result = stakeholderDataToDaml(omitted);
      expect(result.issuer_assigned_id).toBeNull();
    });

    test('optionalString returns null for undefined', () => {
      expect(optionalString(undefined)).toBeNull();
      expect(optionalString(null)).toBeNull();
    });
  });

  describe('Enum Edge Cases', () => {
    test('stakeholder type handles both enum values', () => {
      const individual: OcfStakeholder = {
        id: 'sh-individual',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const institution: OcfStakeholder = {
        id: 'sh-institution',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Acme Corp' },
        stakeholder_type: 'INSTITUTION',
      };

      expect(stakeholderDataToDaml(individual).stakeholder_type).toBe('OcfStakeholderTypeIndividual');
      expect(stakeholderDataToDaml(institution).stakeholder_type).toBe('OcfStakeholderTypeInstitution');
    });

    test('relationship types are normalized correctly', () => {
      const dataWithRelationships: OcfStakeholder = {
        id: 'sh-relationships',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['EMPLOYEE', 'INVESTOR', 'FOUNDER', 'BOARD_MEMBER', 'ADVISOR', 'OFFICER', 'OTHER'],
      };

      const result = stakeholderDataToDaml(dataWithRelationships);
      expect(result.current_relationships).toContain('OcfRelEmployee');
      expect(result.current_relationships).toContain('OcfRelInvestor');
      expect(result.current_relationships).toContain('OcfRelFounder');
      expect(result.current_relationships).toContain('OcfRelBoardMember');
      expect(result.current_relationships).toContain('OcfRelAdvisor');
      expect(result.current_relationships).toContain('OcfRelOfficer');
      expect(result.current_relationships).toContain('OcfRelOther');
    });

    test('fails fast for invalid current_relationships values', () => {
      const invalidRelationshipArrayData: OcfStakeholder = {
        id: 'sh-invalid-array-relationship',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Invalid Relationship Array' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVALID_RELATIONSHIP' as never],
      };

      expect(() => stakeholderDataToDaml(invalidRelationshipArrayData)).toThrow();
      expect(() => stakeholderDataToDaml(invalidRelationshipArrayData)).toThrow('current_relationships[0]');
    });

    test('fails fast for invalid legacy current_relationship values', () => {
      const invalidLegacyRelationshipData: OcfStakeholder = {
        id: 'sh-invalid-legacy-relationship',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Invalid Legacy Relationship' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: '' as never,
      };

      expect(() => stakeholderDataToDaml(invalidLegacyRelationshipData)).toThrow();
      expect(() => stakeholderDataToDaml(invalidLegacyRelationshipData)).toThrow('current_relationship');
    });
  });

  describe('Relationship Parity Checks', () => {
    test('legacy DB relationship resolves to same dashboard bucket after conversion', () => {
      const legacyDbStakeholder: OcfStakeholder = {
        id: 'sh-parity-legacy',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Parity Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'ADVISOR',
      };

      const expectedDbBucket = getDashboardPrimaryRelationshipFromDb(legacyDbStakeholder);
      const daml = stakeholderDataToDaml(legacyDbStakeholder);
      const actualDamlBucket = getDashboardPrimaryRelationshipFromDaml(daml.current_relationships);

      expect(actualDamlBucket).toBe(expectedDbBucket);
    });

    test('missing relationship stays OTHER bucket after conversion', () => {
      const noRelationshipStakeholder: OcfStakeholder = {
        id: 'sh-parity-empty',
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'No Relationship Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const expectedDbBucket = getDashboardPrimaryRelationshipFromDb(noRelationshipStakeholder);
      const daml = stakeholderDataToDaml(noRelationshipStakeholder);
      const actualDamlBucket = getDashboardPrimaryRelationshipFromDaml(daml.current_relationships);

      expect(actualDamlBucket).toBe(expectedDbBucket);
      expect(actualDamlBucket).toBe('OTHER');
    });
  });
});
