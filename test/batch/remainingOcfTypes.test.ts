/**
 * Unit tests for remaining OCF type converters.
 *
 * Tests the OCF→DAML conversion for:
 * - Retraction types (stock, warrant, convertible, equity compensation)
 * - Equity compensation events (release, repricing)
 * - Stock plan events (return to pool)
 * - Stakeholder change events (relationship change, status change)
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable';
import { stakeholderRelationshipChangeEventDataToDaml } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import type {
  OcfConvertibleRetraction,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfEquityCompensationRetraction,
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  OcfStockPlanReturnToPool,
  OcfStockRetraction,
  OcfWarrantRetraction,
} from '../../src/types';

describe('Retraction Type Converters', () => {
  describe('stockRetraction', () => {
    it('should convert stock retraction to DAML format', () => {
      const data: OcfStockRetraction = {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'sr-123',
        date: '2024-01-15',
        security_id: 'sec-001',
        reason_text: 'Issued in error',
        comments: ['Admin correction'],
      };

      const value = convertToDamlData('stockRetraction', data);

      expect(value.id).toBe('sr-123');
      expect(value.date).toBe('2024-01-15');
      expect(value.security_id).toBe('sec-001');
      expect(value.reason_text).toBe('Issued in error');
    });
  });

  describe('warrantRetraction', () => {
    it('should convert warrant retraction to DAML format', () => {
      const data: OcfWarrantRetraction = {
        object_type: 'TX_WARRANT_RETRACTION',
        id: 'wr-123',
        date: '2024-02-20',
        security_id: 'warrant-001',
        reason_text: 'Duplicate issuance',
      };

      const value = convertToDamlData('warrantRetraction', data);

      expect(value.id).toBe('wr-123');
      expect(value.security_id).toBe('warrant-001');
      expect(value.reason_text).toBe('Duplicate issuance');
    });
  });

  describe('convertibleRetraction', () => {
    it('should convert convertible retraction to DAML format', () => {
      const data: OcfConvertibleRetraction = {
        object_type: 'TX_CONVERTIBLE_RETRACTION',
        id: 'cr-123',
        date: '2024-03-10',
        security_id: 'conv-001',
        reason_text: 'Terms renegotiated',
        comments: ['Replaced with new SAFE'],
      };

      const value = convertToDamlData('convertibleRetraction', data);

      expect(value.id).toBe('cr-123');
      expect(value.security_id).toBe('conv-001');
      expect(value.reason_text).toBe('Terms renegotiated');
      expect(value.comments).toEqual(['Replaced with new SAFE']);
    });
  });

  describe('equityCompensationRetraction', () => {
    it('should convert equity compensation retraction to DAML format', () => {
      const data: OcfEquityCompensationRetraction = {
        object_type: 'TX_EQUITY_COMPENSATION_RETRACTION',
        id: 'ecr-123',
        date: '2024-04-05',
        security_id: 'option-001',
        reason_text: 'Grant voided due to termination',
      };

      const value = convertToDamlData('equityCompensationRetraction', data);

      expect(value.id).toBe('ecr-123');
      expect(value.security_id).toBe('option-001');
      expect(value.reason_text).toBe('Grant voided due to termination');
    });
  });
});

describe('Equity Compensation Event Converters', () => {
  describe('equityCompensationRelease', () => {
    it('should convert equity compensation release to DAML format', () => {
      const data: OcfEquityCompensationRelease = {
        object_type: 'TX_EQUITY_COMPENSATION_RELEASE',
        id: 'rel-123',
        date: '2024-05-15',
        security_id: 'rsu-001',
        quantity: '1000',
        resulting_security_ids: ['stock-001'],
        settlement_date: '2024-05-20',
        release_price: { amount: '0.00', currency: 'USD' },
        consideration_text: 'RSU vesting release',
      };

      const value = convertToDamlData('equityCompensationRelease', data);

      expect(value.id).toBe('rel-123');
      expect(value.quantity).toBe('1000');
      expect(value.resulting_security_ids).toEqual(['stock-001']);
      expect(value.settlement_date).toBe('2024-05-20');
      expect(value.release_price).toEqual({
        amount: '0',
        currency: 'USD',
      });
    });
  });

  describe('equityCompensationRepricing', () => {
    it('should convert equity compensation repricing to DAML format', () => {
      const data: OcfEquityCompensationRepricing = {
        object_type: 'TX_EQUITY_COMPENSATION_REPRICING',
        id: 'rep-123',
        date: '2024-06-01',
        security_id: 'option-underwater-001',
        new_exercise_price: { amount: '0.20', currency: 'USD' },
        comments: ['Underwater option repricing program'],
      };

      const value = convertToDamlData('equityCompensationRepricing', data);

      expect(value.id).toBe('rep-123');
      expect(value.new_exercise_price).toEqual({
        amount: '0.2',
        currency: 'USD',
      });
    });
  });
});

describe('Stock Plan Event Converters', () => {
  describe('stockPlanReturnToPool', () => {
    it('should convert stock plan return to pool to DAML format', () => {
      const data: OcfStockPlanReturnToPool = {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'rtp-123',
        date: '2024-07-10',
        security_id: 'sec-123',
        stock_plan_id: 'plan-2024',
        quantity: '5000',
        reason_text: 'Employee termination - unvested shares returned',
        comments: ['Auto-returned per plan terms'],
      };

      const value = convertToDamlData('stockPlanReturnToPool', data);

      expect(value.id).toBe('rtp-123');
      expect(value.security_id).toBe('sec-123');
      expect(value.stock_plan_id).toBe('plan-2024');
      expect(value.quantity).toBe('5000');
      expect(value.reason_text).toBe('Employee termination - unvested shares returned');
    });
  });
});

describe('Stakeholder Change Event Converters', () => {
  describe('stakeholderRelationshipChangeEvent', () => {
    it('should convert a relationship_started-only event to DAML format', () => {
      const data: OcfStakeholderRelationshipChangeEvent = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'rce-123',
        date: '2024-08-01',
        stakeholder_id: 'sh-001',
        relationship_started: 'EMPLOYEE',
        comments: ['Initial relationship assignment'],
      };

      const value = convertToDamlData('stakeholderRelationshipChangeEvent', data);

      expect(value.id).toBe('rce-123');
      expect(value.stakeholder_id).toBe('sh-001');
      expect(value.relationship_started).toBe('OcfStakeholderRelationshipTypeEmployee');
      expect(value.relationship_ended).toBeNull();
    });

    it('should convert canonical relationship_started and relationship_ended fields', () => {
      const data: OcfStakeholderRelationshipChangeEvent = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'rce-456',
        date: '2024-08-15',
        stakeholder_id: 'sh-002',
        relationship_started: 'FOUNDER',
        relationship_ended: 'INVESTOR',
      };

      const value = convertToDamlData('stakeholderRelationshipChangeEvent', data);

      expect(value.relationship_started).toBe('OcfStakeholderRelationshipTypeFounder');
      expect(value.relationship_ended).toBe('OcfStakeholderRelationshipTypeInvestor');
    });

    it('direct writer requires at least one relationship change', () => {
      const input = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'rce-neither',
        date: '2024-08-15',
        stakeholder_id: 'sh-002',
      } as unknown as OcfStakeholderRelationshipChangeEvent;

      expect(() => stakeholderRelationshipChangeEventDataToDaml(input)).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stakeholderRelationshipChangeEvent',
        })
      );
    });

    it.each(['relationship_started', 'relationship_ended'] as const)(
      'direct writer rejects explicit null %s with an exact field path',
      (field) => {
        const input = {
          object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
          id: 'rce-null',
          date: '2024-08-15',
          stakeholder_id: 'sh-002',
          relationship_started: field === 'relationship_started' ? null : 'FOUNDER',
          ...(field === 'relationship_ended' ? { relationship_ended: null } : {}),
        } as unknown as OcfStakeholderRelationshipChangeEvent;

        expect(() => stakeholderRelationshipChangeEventDataToDaml(input)).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_TYPE,
            fieldPath: `stakeholderRelationshipChangeEvent.${field}`,
          })
        );
      }
    );

    it('should reject the non-schema relationship list field', () => {
      const data = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'rce-invalid',
        date: '2024-08-20',
        stakeholder_id: 'sh-003',
        new_relationships: ['FOUNDER', 'INVESTOR'],
      } as unknown as OcfStakeholderRelationshipChangeEvent;

      expect(() => convertToDamlData('stakeholderRelationshipChangeEvent', data)).toThrow('new_relationships');
    });
  });

  describe('stakeholderStatusChangeEvent', () => {
    it('should convert stakeholder status change event to DAML format', () => {
      const data: OcfStakeholderStatusChangeEvent = {
        object_type: 'CE_STAKEHOLDER_STATUS',
        id: 'sce-123',
        date: '2024-09-01',
        stakeholder_id: 'sh-001',
        new_status: 'LEAVE_OF_ABSENCE',
        comments: ['Medical leave'],
      };

      const value = convertToDamlData('stakeholderStatusChangeEvent', data);

      expect(value.id).toBe('sce-123');
      expect(value.stakeholder_id).toBe('sh-001');
      expect(value.new_status).toBe('OcfStakeholderStatusTypeLeaveOfAbsence');
    });

    it('should convert all status types correctly', () => {
      const statuses: Array<{
        input: OcfStakeholderStatusChangeEvent['new_status'];
        expected: string;
      }> = [
        { input: 'ACTIVE', expected: 'OcfStakeholderStatusTypeActive' },
        { input: 'LEAVE_OF_ABSENCE', expected: 'OcfStakeholderStatusTypeLeaveOfAbsence' },
        { input: 'TERMINATION_VOLUNTARY_OTHER', expected: 'OcfStakeholderStatusTypeTerminationVoluntaryOther' },
        {
          input: 'TERMINATION_VOLUNTARY_GOOD_CAUSE',
          expected: 'OcfStakeholderStatusTypeTerminationVoluntaryGoodCause',
        },
        {
          input: 'TERMINATION_VOLUNTARY_RETIREMENT',
          expected: 'OcfStakeholderStatusTypeTerminationVoluntaryRetirement',
        },
        { input: 'TERMINATION_INVOLUNTARY_OTHER', expected: 'OcfStakeholderStatusTypeTerminationInvoluntaryOther' },
        { input: 'TERMINATION_INVOLUNTARY_DEATH', expected: 'OcfStakeholderStatusTypeTerminationInvoluntaryDeath' },
        {
          input: 'TERMINATION_INVOLUNTARY_DISABILITY',
          expected: 'OcfStakeholderStatusTypeTerminationInvoluntaryDisability',
        },
        {
          input: 'TERMINATION_INVOLUNTARY_WITH_CAUSE',
          expected: 'OcfStakeholderStatusTypeTerminationInvoluntaryWithCause',
        },
      ];

      for (const { input, expected } of statuses) {
        const data: OcfStakeholderStatusChangeEvent = {
          object_type: 'CE_STAKEHOLDER_STATUS',
          id: `sce-${input}`,
          date: '2024-09-01',
          stakeholder_id: 'sh-001',
          new_status: input,
        };

        const value = convertToDamlData('stakeholderStatusChangeEvent', data);

        expect(value.new_status).toBe(expected);
      }
    });
  });
});
