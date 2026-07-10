import { extractOcfIdFromEvent, safeGet, type CreatedTreeEvent } from '../../src/utils/transactionHelpers';

function createStakeholderEvent(createArgument: unknown): CreatedTreeEvent {
  return {
    CreatedTreeEvent: {
      value: {
        contractId: 'contract-id',
        templateId: 'package:module:Stakeholder',
        createArgument,
      },
    },
  };
}

describe('transactionHelpers', () => {
  describe('safeGet', () => {
    test('returns own nested properties', () => {
      expect(safeGet({ stakeholder_data: { id: 'stakeholder-id' } }, ['stakeholder_data', 'id'])).toBe(
        'stakeholder-id'
      );
    });

    test.each(['constructor', 'toString'])('does not return inherited prototype property %s', (prototypeKey) => {
      expect(safeGet({}, [prototypeKey])).toBeUndefined();
    });

    test('allows explicitly owned properties whose names overlap prototype keys', () => {
      expect(safeGet({ constructor: { id: 'own-id' } }, ['constructor', 'id'])).toBe('own-id');
    });
  });

  describe('extractOcfIdFromEvent', () => {
    test('does not read an inherited OCF data wrapper', () => {
      const createArgument = Object.create({
        stakeholder_data: { id: 'prototype-id' },
      }) as object;

      expect(extractOcfIdFromEvent(createStakeholderEvent(createArgument), 'STAKEHOLDER')).toBeUndefined();
    });

    test('does not read an inherited OCF id', () => {
      const stakeholderData = Object.create({ id: 'prototype-id' }) as object;

      expect(
        extractOcfIdFromEvent(createStakeholderEvent({ stakeholder_data: stakeholderData }), 'STAKEHOLDER')
      ).toBeUndefined();
    });
  });
});
