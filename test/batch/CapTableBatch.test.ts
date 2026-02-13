/** Unit tests for CapTableBatch fluent builder. */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { buildUpdateCapTableCommand, CapTableBatch, ENTITY_TAG_MAP } from '../../src/functions/OpenCapTable/capTable';
import type { OcfStakeholder, OcfStockClass } from '../../src/types';

describe('CapTableBatch', () => {
  describe('fluent builder API', () => {
    it('should create an empty batch', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      expect(batch.isEmpty).toBe(true);
      expect(batch.size).toBe(0);
    });

    it('should add create operations', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const stakeholderData: OcfStakeholder = {
        id: 'sh-123',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      batch.create('stakeholder', stakeholderData);

      expect(batch.isEmpty).toBe(false);
      expect(batch.size).toBe(1);
    });

    it('should chain multiple operations', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const stakeholderData: OcfStakeholder = {
        id: 'sh-123',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const stockClassData: OcfStockClass = {
        id: 'sc-123',
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      };

      batch
        .create('stakeholder', stakeholderData)
        .create('stockClass', stockClassData)
        .edit('stakeholder', { ...stakeholderData, name: { legal_name: 'Jane Doe' } })
        .delete('document', 'doc-123');

      expect(batch.size).toBe(4);
    });

    it('should clear all operations', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const stakeholderData: OcfStakeholder = {
        id: 'sh-123',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      batch.create('stakeholder', stakeholderData);
      expect(batch.size).toBe(1);

      batch.clear();
      expect(batch.isEmpty).toBe(true);
    });

    it('should throw OcpValidationError when creating issuer via batch', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const issuerData = {
        id: 'issuer-123',
        legal_name: 'Test Corp',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
        tax_ids: [],
      };

      try {
        batch.create('issuer', issuerData);
        throw new Error('Expected OcpValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        const validationError = error as OcpValidationError;
        expect(validationError.message).toContain('Cannot create issuer via batch');
        expect(validationError.fieldPath).toBe('type');
        expect(validationError.code).toBe(OcpErrorCodes.INVALID_TYPE);
      }
    });

    it('should throw OcpValidationError when deleting issuer via batch', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      try {
        batch.delete('issuer', 'issuer-123');
        throw new Error('Expected OcpValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        const validationError = error as OcpValidationError;
        expect(validationError.message).toContain('Cannot delete issuer');
        expect(validationError.fieldPath).toBe('type');
        expect(validationError.code).toBe(OcpErrorCodes.INVALID_TYPE);
      }
    });

    it('should allow editing issuer via batch', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const issuerData = {
        id: 'issuer-123',
        legal_name: 'Updated Test Corp',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
        tax_ids: [],
      };

      batch.edit('issuer', issuerData);

      expect(batch.isEmpty).toBe(false);
      expect(batch.size).toBe(1);

      const { command } = batch.build();
      expect(command).toHaveProperty('ExerciseCommand');
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
        edits: Array<{ tag: string; value: unknown }>;
        deletes: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.edits).toHaveLength(1);
      expect(choiceArg.edits[0].tag).toBe('OcfEditIssuer');
    });
  });

  describe('build()', () => {
    it('should throw error for empty batch', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      expect(() => batch.build()).toThrow('Cannot build empty batch');
    });

    it('should build command with creates', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const stakeholderData: OcfStakeholder = {
        id: 'sh-123',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      batch.create('stakeholder', stakeholderData);

      const { command, disclosedContracts } = batch.build();

      expect(command).toHaveProperty('ExerciseCommand');
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      expect(command.ExerciseCommand).toMatchObject({
        contractId: 'cap-table-123',
        choice: 'UpdateCapTable',
      });

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
        edits: Array<{ tag: string; value: unknown }>;
        deletes: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(1);
      expect(choiceArg.creates[0].tag).toBe('OcfCreateStakeholder');
      expect(choiceArg.edits).toHaveLength(0);
      expect(choiceArg.deletes).toHaveLength(0);

      // No disclosed contracts needed - CapTable choices don't reference external contracts
      expect(disclosedContracts).toHaveLength(0);
    });

    it('should build command with edits', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      const stakeholderData: OcfStakeholder = {
        id: 'sh-123',
        name: { legal_name: 'Jane Doe' },
        stakeholder_type: 'INDIVIDUAL',
      };

      batch.edit('stakeholder', stakeholderData);

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
        edits: Array<{ tag: string; value: unknown }>;
        deletes: Array<{ tag: string; value: unknown }>;
      };

      expect(choiceArg.creates).toHaveLength(0);
      expect(choiceArg.edits).toHaveLength(1);
      expect(choiceArg.edits[0].tag).toBe('OcfEditStakeholder');
      expect(choiceArg.deletes).toHaveLength(0);
    });

    it('should build command with deletes', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      batch.delete('document', 'doc-123');

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      const choiceArg = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
        edits: Array<{ tag: string; value: unknown }>;
        deletes: Array<{ tag: string; value: string }>;
      };

      expect(choiceArg.creates).toHaveLength(0);
      expect(choiceArg.edits).toHaveLength(0);
      expect(choiceArg.deletes).toHaveLength(1);
      expect(choiceArg.deletes[0].tag).toBe('OcfDeleteDocument');
      expect(choiceArg.deletes[0].value).toBe('doc-123');
    });

    it('should use custom templateId when capTableContractDetails provided', () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        capTableContractDetails: {
          templateId: 'custom-template-id',
        },
        actAs: ['party-1'],
      });

      batch.delete('stakeholder', 'sh-123');

      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

      expect(command.ExerciseCommand.templateId).toBe('custom-template-id');
    });
  });

  describe('execute()', () => {
    it('should throw error when no client provided', async () => {
      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-123',
        actAs: ['party-1'],
      });

      batch.delete('stakeholder', 'sh-123');

      await expect(batch.execute()).rejects.toThrow('Cannot execute batch without a client');
    });

    it('should wrap submitAndWaitForTransactionTree errors with batch context', async () => {
      const mockClient = {
        submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(new Error('DAML_FAILURE: Invalid contract')),
      };

      const batch = new CapTableBatch(
        {
          capTableContractId: 'cap-table-123',
          actAs: ['party-1'],
        },
        mockClient as never
      );

      batch.create('stakeholder', {
        id: 'sh-123',
        name: { legal_name: 'John Doe' },
        stakeholder_type: 'INDIVIDUAL',
      } as OcfStakeholder);

      await expect(batch.execute()).rejects.toThrow(/Batch execution failed: DAML_FAILURE: Invalid contract/);
      await expect(batch.execute()).rejects.toThrow(/\[batch: 1 creates, 0 edits, 0 deletes; types: Stakeholder\]/);
    });

    it('should include multiple entity types in error context', async () => {
      const mockClient = {
        submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      const batch = new CapTableBatch(
        {
          capTableContractId: 'cap-table-123',
          actAs: ['party-1'],
        },
        mockClient as never
      );

      batch
        .create('stakeholder', {
          id: 'sh-123',
          name: { legal_name: 'John Doe' },
          stakeholder_type: 'INDIVIDUAL',
        } as OcfStakeholder)
        .edit('stockClass', {
          id: 'sc-123',
          name: 'Common Stock',
          class_type: 'COMMON',
          default_id_prefix: 'CS-',
          initial_shares_authorized: '10000000',
          votes_per_share: '1',
          seniority: '1',
        } as OcfStockClass)
        .delete('document', 'doc-123');

      await expect(batch.execute()).rejects.toThrow(/\[batch: 1 creates, 1 edits, 1 deletes/);
    });

    it('should throw RESULT_NOT_FOUND with batch context when UpdateCapTable result missing', async () => {
      // Mock a transaction tree that doesn't contain the UpdateCapTable exercised event
      const mockClient = {
        submitAndWaitForTransactionTree: jest.fn().mockResolvedValue({
          transactionTree: {
            updateId: 'update-123',
            eventsById: {
              // Empty or contains other events but not UpdateCapTable
              'event-1': {
                CreatedTreeEvent: {
                  value: { templateId: 'some-template' },
                },
              },
            },
          },
        }),
      };

      const batch = new CapTableBatch(
        {
          capTableContractId: 'cap-table-123',
          actAs: ['party-1'],
        },
        mockClient as never
      );

      batch.delete('stakeholder', 'sh-123');

      await expect(batch.execute()).rejects.toThrow(/UpdateCapTable result not found in transaction tree/);
      await expect(batch.execute()).rejects.toThrow(/\[batch: 0 creates, 0 edits, 1 deletes; types: Stakeholder\]/);
    });

    it('should set cause property when wrapping errors', async () => {
      const originalError = new Error('Original DAML error');
      const mockClient = {
        submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(originalError),
      };

      const batch = new CapTableBatch(
        {
          capTableContractId: 'cap-table-123',
          actAs: ['party-1'],
        },
        mockClient as never
      );

      batch.delete('document', 'doc-123');

      try {
        await batch.execute();
        throw new Error('Expected execute to throw');
      } catch (error) {
        expect(error).toHaveProperty('cause', originalError);
      }
    });
  });
});

describe('JSON-safety guard', () => {
  it('should throw OcpValidationError when converter output contains undefined', () => {
    const batch = new CapTableBatch({
      capTableContractId: 'cap-table-123',
      actAs: ['party-1'],
    });

    // Simulate what happened in the DEV-MEZ incident: a converter emits undefined
    // for stock_class_ids because the source data uses the deprecated stock_class_id field.
    // We inject a poisoned create directly into the internal array to test the guard.
    const poisonedCreate = {
      tag: 'OcfCreateStockPlan',
      value: {
        id: 'stock-plan_eca1ad4ba4d9',
        plan_name: 'Test Plan',
        initial_shares_reserved: '900000',
        stock_class_ids: undefined, // This is the bug
        comments: [],
      },
    };

    // Access private creates array via type assertion to inject the poisoned data
    (batch as unknown as { creates: unknown[]; createMetas: unknown[] }).creates.push(poisonedCreate);
    (batch as unknown as { creates: unknown[]; createMetas: unknown[] }).createMetas.push({
      entityType: 'stockPlan',
      ocfId: 'stock-plan_eca1ad4ba4d9',
    });

    expect(() => batch.build()).toThrow(OcpValidationError);
    expect(() => batch.build()).toThrow(/non-JSON-safe payload/);
    expect(() => batch.build()).toThrow(/undefined value at/);
    expect(() => batch.build()).toThrow(/stock_class_ids/);
    expect(() => batch.build()).toThrow(/stockPlan/);
  });

  it('should not throw when all values are JSON-safe', () => {
    const batch = new CapTableBatch({
      capTableContractId: 'cap-table-123',
      actAs: ['party-1'],
    });

    const stakeholderData: OcfStakeholder = {
      id: 'sh-123',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };

    batch.create('stakeholder', stakeholderData);

    // Should not throw
    expect(() => batch.build()).not.toThrow();
  });

  it('should detect deeply nested undefined values', () => {
    const batch = new CapTableBatch({
      capTableContractId: 'cap-table-123',
      actAs: ['party-1'],
    });

    // Inject a create with a deeply nested undefined
    const poisonedCreate = {
      tag: 'OcfCreateStakeholder',
      value: {
        id: 'sh-123',
        name: { legal_name: 'Test', nested: { deep: undefined } },
      },
    };
    (batch as unknown as { creates: unknown[]; createMetas: unknown[] }).creates.push(poisonedCreate);
    (batch as unknown as { creates: unknown[]; createMetas: unknown[] }).createMetas.push({
      entityType: 'stakeholder',
      ocfId: 'sh-123',
    });

    expect(() => batch.build()).toThrow(OcpValidationError);
    expect(() => batch.build()).toThrow(/undefined value at/);
  });
});

describe('buildUpdateCapTableCommand', () => {
  it('should build command from operations object', () => {
    const stakeholderData: OcfStakeholder = {
      id: 'sh-123',
      name: { legal_name: 'John Doe' },
      stakeholder_type: 'INDIVIDUAL',
    };

    const { command, disclosedContracts } = buildUpdateCapTableCommand(
      {
        capTableContractId: 'cap-table-123',
      },
      {
        creates: [{ type: 'stakeholder', data: stakeholderData }],
        deletes: [{ type: 'document', id: 'doc-123' }],
      }
    );

    expect(command).toHaveProperty('ExerciseCommand');
    if (!('ExerciseCommand' in command)) throw new Error('Expected ExerciseCommand');

    expect(command.ExerciseCommand.choice).toBe('UpdateCapTable');

    const choiceArg = command.ExerciseCommand.choiceArgument as {
      creates: Array<{ tag: string; value: unknown }>;
      edits: Array<{ tag: string; value: unknown }>;
      deletes: Array<{ tag: string; value: unknown }>;
    };

    expect(choiceArg.creates).toHaveLength(1);
    expect(choiceArg.deletes).toHaveLength(1);
    // No disclosed contracts needed - CapTable choices don't reference external contracts
    expect(disclosedContracts).toHaveLength(0);
  });
});

describe('ENTITY_TAG_MAP', () => {
  it('should have correct tags for all entity types', () => {
    // Spot check a few entity types
    expect(ENTITY_TAG_MAP.stakeholder).toEqual({
      create: 'OcfCreateStakeholder',
      edit: 'OcfEditStakeholder',
      delete: 'OcfDeleteStakeholder',
    });

    expect(ENTITY_TAG_MAP.stockClass).toEqual({
      create: 'OcfCreateStockClass',
      edit: 'OcfEditStockClass',
      delete: 'OcfDeleteStockClass',
    });

    expect(ENTITY_TAG_MAP.document).toEqual({
      create: 'OcfCreateDocument',
      edit: 'OcfEditDocument',
      delete: 'OcfDeleteDocument',
    });
  });

  it('should have all 55 entity types (47 base + 7 PlanSecurity aliases + 1 issuer)', () => {
    // The DAML contract supports 47 entity types in the CapTable maps
    // Plus 7 PlanSecurity alias types that map to EquityCompensation types
    // Plus 1 issuer type (edit-only, stored as a single reference not a map)
    expect(Object.keys(ENTITY_TAG_MAP)).toHaveLength(55);
  });

  it('should have correct tags for stakeholder event types', () => {
    expect(ENTITY_TAG_MAP.stakeholderRelationshipChangeEvent).toEqual({
      create: 'OcfCreateStakeholderRelationshipChangeEvent',
      edit: 'OcfEditStakeholderRelationshipChangeEvent',
      delete: 'OcfDeleteStakeholderRelationshipChangeEvent',
    });

    expect(ENTITY_TAG_MAP.stakeholderStatusChangeEvent).toEqual({
      create: 'OcfCreateStakeholderStatusChangeEvent',
      edit: 'OcfEditStakeholderStatusChangeEvent',
      delete: 'OcfDeleteStakeholderStatusChangeEvent',
    });
  });

  it('should have issuer as edit-only entity type (no create/delete)', () => {
    // Issuer is edit-only: created with CapTable via IssuerAuthorization, cannot be deleted
    expect(ENTITY_TAG_MAP.issuer).toEqual({
      create: undefined, // Not supported
      edit: 'OcfEditIssuer',
      delete: undefined, // Not supported
    });
  });
});
