/**
 * Unit tests for remaining OCF type converters.
 *
 * Tests the OCF→DAML conversion for:
 * - Retraction types (stock, warrant, convertible, equity compensation)
 * - Equity compensation events (release, repricing)
 * - Stock plan events (return to pool)
 * - Stakeholder change events (relationship change, status change)
 */

import { CapTableBatch, ENTITY_TAG_MAP } from '../../src/functions/OpenCapTable/capTable';
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
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfStockRetraction = {
        id: 'sr-123',
        date: '2024-01-15',
        security_id: 'sec-001',
        reason_text: 'Issued in error',
        comments: ['Admin correction'],
      };

      batch.create('stockRetraction', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateStockRetraction');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('sr-123');
      expect(value.date).toBe('2024-01-15T00:00:00.000Z');
      expect(value.security_id).toBe('sec-001');
      expect(value.reason_text).toBe('Issued in error');
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.stockRetraction).toEqual({
        create: 'OcfCreateStockRetraction',
        edit: 'OcfEditStockRetraction',
        delete: 'OcfDeleteStockRetraction',
      });
    });
  });

  describe('warrantRetraction', () => {
    it('should convert warrant retraction to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfWarrantRetraction = {
        id: 'wr-123',
        date: '2024-02-20',
        security_id: 'warrant-001',
        reason_text: 'Duplicate issuance',
      };

      batch.create('warrantRetraction', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateWarrantRetraction');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('wr-123');
      expect(value.security_id).toBe('warrant-001');
      expect(value.reason_text).toBe('Duplicate issuance');
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.warrantRetraction).toEqual({
        create: 'OcfCreateWarrantRetraction',
        edit: 'OcfEditWarrantRetraction',
        delete: 'OcfDeleteWarrantRetraction',
      });
    });
  });

  describe('convertibleRetraction', () => {
    it('should convert convertible retraction to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfConvertibleRetraction = {
        id: 'cr-123',
        date: '2024-03-10',
        security_id: 'conv-001',
        reason_text: 'Terms renegotiated',
        comments: ['Replaced with new SAFE'],
      };

      batch.create('convertibleRetraction', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateConvertibleRetraction');
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.convertibleRetraction).toEqual({
        create: 'OcfCreateConvertibleRetraction',
        edit: 'OcfEditConvertibleRetraction',
        delete: 'OcfDeleteConvertibleRetraction',
      });
    });
  });

  describe('equityCompensationRetraction', () => {
    it('should convert equity compensation retraction to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfEquityCompensationRetraction = {
        id: 'ecr-123',
        date: '2024-04-05',
        security_id: 'option-001',
        reason_text: 'Grant voided due to termination',
      };

      batch.create('equityCompensationRetraction', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateEquityCompensationRetraction');
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.equityCompensationRetraction).toEqual({
        create: 'OcfCreateEquityCompensationRetraction',
        edit: 'OcfEditEquityCompensationRetraction',
        delete: 'OcfDeleteEquityCompensationRetraction',
      });
    });
  });
});

describe('Equity Compensation Event Converters', () => {
  describe('equityCompensationRelease', () => {
    it('should convert equity compensation release to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfEquityCompensationRelease = {
        id: 'rel-123',
        date: '2024-05-15',
        security_id: 'rsu-001',
        quantity: '1000',
        resulting_security_ids: ['stock-001'],
        settlement_date: '2024-05-20',
        consideration_text: 'RSU vesting release',
      };

      batch.create('equityCompensationRelease', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateEquityCompensationRelease');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('rel-123');
      expect(value.quantity).toBe('1000');
      expect(value.resulting_security_ids).toEqual(['stock-001']);
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.equityCompensationRelease).toEqual({
        create: 'OcfCreateEquityCompensationRelease',
        edit: 'OcfEditEquityCompensationRelease',
        delete: 'OcfDeleteEquityCompensationRelease',
      });
    });
  });

  describe('equityCompensationRepricing', () => {
    it('should convert equity compensation repricing to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfEquityCompensationRepricing = {
        id: 'rep-123',
        date: '2024-06-01',
        security_id: 'option-underwater-001',
        resulting_security_ids: ['option-repriced-001'],
        comments: ['Underwater option repricing program'],
      };

      batch.create('equityCompensationRepricing', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateEquityCompensationRepricing');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('rep-123');
      expect(value.resulting_security_ids).toEqual(['option-repriced-001']);
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.equityCompensationRepricing).toEqual({
        create: 'OcfCreateEquityCompensationRepricing',
        edit: 'OcfEditEquityCompensationRepricing',
        delete: 'OcfDeleteEquityCompensationRepricing',
      });
    });
  });
});

describe('Stock Plan Event Converters', () => {
  describe('stockPlanReturnToPool', () => {
    it('should convert stock plan return to pool to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfStockPlanReturnToPool = {
        id: 'rtp-123',
        date: '2024-07-10',
        stock_plan_id: 'plan-2024',
        quantity: '5000',
        reason_text: 'Employee termination - unvested shares returned',
        comments: ['Auto-returned per plan terms'],
      };

      batch.create('stockPlanReturnToPool', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateStockPlanReturnToPool');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('rtp-123');
      expect(value.stock_plan_id).toBe('plan-2024');
      expect(value.quantity).toBe('5000');
      expect(value.reason_text).toBe('Employee termination - unvested shares returned');
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.stockPlanReturnToPool).toEqual({
        create: 'OcfCreateStockPlanReturnToPool',
        edit: 'OcfEditStockPlanReturnToPool',
        delete: 'OcfDeleteStockPlanReturnToPool',
      });
    });
  });
});

describe('Stakeholder Change Event Converters', () => {
  describe('stakeholderRelationshipChangeEvent', () => {
    it('should convert stakeholder relationship change event to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfStakeholderRelationshipChangeEvent = {
        id: 'rce-123',
        date: '2024-08-01',
        stakeholder_id: 'sh-001',
        new_relationships: ['EMPLOYEE', 'BOARD_MEMBER'],
        comments: ['Promoted to board while remaining employee'],
      };

      batch.create('stakeholderRelationshipChangeEvent', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateStakeholderRelationshipChangeEvent');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('rce-123');
      expect(value.stakeholder_id).toBe('sh-001');
      expect(value.new_relationships).toEqual(['OcfRelEmployee', 'OcfRelBoardMember']);
    });

    it('should convert all relationship types correctly', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfStakeholderRelationshipChangeEvent = {
        id: 'rce-456',
        date: '2024-08-15',
        stakeholder_id: 'sh-002',
        new_relationships: ['FOUNDER', 'INVESTOR', 'ADVISOR', 'OFFICER', 'OTHER'],
      };

      batch.create('stakeholderRelationshipChangeEvent', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.new_relationships).toEqual([
        'OcfRelFounder',
        'OcfRelInvestor',
        'OcfRelAdvisor',
        'OcfRelOfficer',
        'OcfRelOther',
      ]);
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.stakeholderRelationshipChangeEvent).toEqual({
        create: 'OcfCreateStakeholderRelationshipChangeEvent',
        edit: 'OcfEditStakeholderRelationshipChangeEvent',
        delete: 'OcfDeleteStakeholderRelationshipChangeEvent',
      });
    });
  });

  describe('stakeholderStatusChangeEvent', () => {
    it('should convert stakeholder status change event to DAML format', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const data: OcfStakeholderStatusChangeEvent = {
        id: 'sce-123',
        date: '2024-09-01',
        stakeholder_id: 'sh-001',
        new_status: 'LEAVE_OF_ABSENCE',
        comments: ['Medical leave'],
      };

      batch.create('stakeholderStatusChangeEvent', data);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateStakeholderStatusChangeEvent');

      const value = choiceArg.creates[0].value as Record<string, unknown>;
      expect(value.id).toBe('sce-123');
      expect(value.stakeholder_id).toBe('sh-001');
      expect(value.new_status).toBe('OcfStakeholderStatusLeaveOfAbsence');
    });

    it('should convert all status types correctly', () => {
      const statuses: Array<{
        input: OcfStakeholderStatusChangeEvent['new_status'];
        expected: string;
      }> = [
        { input: 'ACTIVE', expected: 'OcfStakeholderStatusActive' },
        { input: 'LEAVE_OF_ABSENCE', expected: 'OcfStakeholderStatusLeaveOfAbsence' },
        { input: 'TERMINATION_VOLUNTARY_OTHER', expected: 'OcfStakeholderStatusTerminationVoluntaryOther' },
        { input: 'TERMINATION_VOLUNTARY_GOOD_CAUSE', expected: 'OcfStakeholderStatusTerminationVoluntaryGoodCause' },
        { input: 'TERMINATION_VOLUNTARY_RETIREMENT', expected: 'OcfStakeholderStatusTerminationVoluntaryRetirement' },
        { input: 'TERMINATION_INVOLUNTARY_OTHER', expected: 'OcfStakeholderStatusTerminationInvoluntaryOther' },
        { input: 'TERMINATION_INVOLUNTARY_DEATH', expected: 'OcfStakeholderStatusTerminationInvoluntaryDeath' },
        {
          input: 'TERMINATION_INVOLUNTARY_DISABILITY',
          expected: 'OcfStakeholderStatusTerminationInvoluntaryDisability',
        },
        {
          input: 'TERMINATION_INVOLUNTARY_WITH_CAUSE',
          expected: 'OcfStakeholderStatusTerminationInvoluntaryWithCause',
        },
      ];

      for (const { input, expected } of statuses) {
        const batch = new CapTableBatch({
          capTableContractId: 'cap-table-123',
          actAs: ['party-1'],
        });

        const data: OcfStakeholderStatusChangeEvent = {
          id: `sce-${input}`,
          date: '2024-09-01',
          stakeholder_id: 'sh-001',
          new_status: input,
        };

        batch.create('stakeholderStatusChangeEvent', data);

        const { command } = batch.build();
        if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

        const choiceArg = command.ExerciseCommand.choiceArgument as {
          creates: Array<{ tag: string; value: unknown }>;
        };

        const value = choiceArg.creates[0].value as Record<string, unknown>;
        expect(value.new_status).toBe(expected);
      }
    });

    it('should have correct ENTITY_TAG_MAP entry', () => {
      expect(ENTITY_TAG_MAP.stakeholderStatusChangeEvent).toEqual({
        create: 'OcfCreateStakeholderStatusChangeEvent',
        edit: 'OcfEditStakeholderStatusChangeEvent',
        delete: 'OcfDeleteStakeholderStatusChangeEvent',
      });
    });
  });
});

describe('Batch operations with remaining types', () => {
  it('should support mixed batch with retraction and event types', () => {
    const batch = new CapTableBatch({
      capTableContractId: 'cap-table-123',
      actAs: ['party-1'],
    });

    batch
      .create('stockRetraction', {
        id: 'sr-1',
        date: '2024-01-01',
        security_id: 'sec-1',
        reason_text: 'Error correction',
      })
      .create('equityCompensationRelease', {
        id: 'rel-1',
        date: '2024-01-02',
        security_id: 'rsu-1',
        quantity: '100',
        resulting_security_ids: ['stock-1'],
      })
      .create('stockPlanReturnToPool', {
        id: 'rtp-1',
        date: '2024-01-03',
        stock_plan_id: 'plan-1',
        quantity: '500',
        reason_text: 'Termination',
      })
      .create('stakeholderStatusChangeEvent', {
        id: 'sce-1',
        date: '2024-01-04',
        stakeholder_id: 'sh-1',
        new_status: 'ACTIVE',
      });

    expect(batch.size).toBe(4);

    const { command } = batch.build();
    if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

    const choiceArg = command.ExerciseCommand.choiceArgument as {
      creates: Array<{ tag: string; value: unknown }>;
    };

    expect(choiceArg.creates).toHaveLength(4);

    const tags = choiceArg.creates.map((c) => c.tag);
    expect(tags).toContain('OcfCreateStockRetraction');
    expect(tags).toContain('OcfCreateEquityCompensationRelease');
    expect(tags).toContain('OcfCreateStockPlanReturnToPool');
    expect(tags).toContain('OcfCreateStakeholderStatusChangeEvent');
  });
});
