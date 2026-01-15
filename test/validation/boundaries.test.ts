/**
 * Tests for boundary conditions and edge cases.
 *
 * These tests verify that the SDK handles boundary conditions correctly, including maximum values, minimum values, and
 * special edge cases.
 */

import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import type { OcfStakeholder } from '../../src/types';
import { normalizeNumericString, numberToString, optionalString } from '../../src/utils/typeConversions';

describe('Boundary Condition Tests', () => {
  describe('Numeric Boundaries', () => {
    test('numberToString handles very large numbers', () => {
      // Maximum safe integer
      expect(numberToString(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991');

      // Large string numbers (beyond JavaScript safe integer)
      expect(numberToString('99999999999999999999')).toBe('99999999999999999999');
    });

    test('numberToString handles zero correctly', () => {
      expect(numberToString(0)).toBe('0');
      expect(numberToString('0')).toBe('0');
      expect(numberToString(-0)).toBe('0');
    });

    test('numberToString handles very small decimals', () => {
      expect(numberToString(0.0001)).toBe('0.0001');
      expect(numberToString(0.00000001)).toBe('1e-8'); // Note: JavaScript converts to scientific notation
    });

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
        name: { legal_name: '日本語の名前' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const result = stakeholderDataToDaml(unicodeData);
      expect(result.name.legal_name).toBe('日本語の名前');
    });

    test('handles emoji in names correctly', () => {
      const emojiData: OcfStakeholder = {
        id: 'sh-emoji',
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

    test('comments array filters out empty strings', () => {
      const dataWithComments: OcfStakeholder = {
        id: 'sh-comments',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        comments: ['Valid comment', '', 'Another comment', '  ', null as unknown as string],
      };

      const result = stakeholderDataToDaml(dataWithComments);
      // Empty strings and null should be filtered, but whitespace-only preserved if trimmed
      expect(result.comments).toContain('Valid comment');
      expect(result.comments).toContain('Another comment');
    });
  });

  describe('Null vs Undefined Handling', () => {
    test('DAML optional fields use null, not undefined', () => {
      const data: OcfStakeholder = {
        id: 'sh-null-test',
        name: { legal_name: 'Test' },
        stakeholder_type: 'INDIVIDUAL',
        issuer_assigned_id: undefined, // Should become null in DAML
      };

      const result = stakeholderDataToDaml(data);
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
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const institution: OcfStakeholder = {
        id: 'sh-institution',
        name: { legal_name: 'Acme Corp' },
        stakeholder_type: 'INSTITUTION',
      };

      expect(stakeholderDataToDaml(individual).stakeholder_type).toBe('OcfStakeholderTypeIndividual');
      expect(stakeholderDataToDaml(institution).stakeholder_type).toBe('OcfStakeholderTypeInstitution');
    });

    test('relationship types are normalized correctly', () => {
      const dataWithRelationships: OcfStakeholder = {
        id: 'sh-relationships',
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
  });
});
