import { convertTransactionTreeToEventsResponse, extractContractIdFromTransactionTree } from './fixtureHelpers';

const createdValue = {
  contractId: 'contract-1',
  templateId: 'package-hash:Fairmint.OpenCapTable:CapTable',
};

function directTree(value: unknown): Record<string, unknown> {
  return {
    transactionTree: {
      eventsById: {
        '0': { CreatedTreeEvent: { value } },
      },
    },
  };
}

function nestedTree(value: unknown): Record<string, unknown> {
  return {
    transactionTree: {
      transaction: {
        eventsById: {
          '0': { CreatedTreeEvent: { value } },
        },
      },
    },
  };
}

describe('transaction-tree fixture guards', () => {
  it.each([
    ['direct', directTree(createdValue)],
    ['legacy nested', nestedTree(createdValue)],
  ])('extracts a valid %s created event', (_name, response) => {
    expect(convertTransactionTreeToEventsResponse(response, 'synchronizer-1')).toEqual({
      archived: null,
      created: {
        createdEvent: createdValue,
        synchronizerId: 'synchronizer-1',
      },
    });
    expect(extractContractIdFromTransactionTree(response, 'CapTable')).toBe('contract-1');
  });

  it.each([
    {
      name: 'null event',
      response: { transactionTree: { eventsById: { '0': null } } },
      path: 'transactionTree.eventsById.0',
      expectation: 'expected an object',
    },
    {
      name: 'non-object event',
      response: { transactionTree: { eventsById: { '0': 42 } } },
      path: 'transactionTree.eventsById.0',
      expectation: 'expected an object',
    },
    {
      name: 'non-object created value',
      response: directTree('not an object'),
      path: 'transactionTree.eventsById.0.CreatedTreeEvent.value',
      expectation: 'expected an object',
    },
    {
      name: 'non-string template id',
      response: directTree({ ...createdValue, templateId: 42 }),
      path: 'transactionTree.eventsById.0.CreatedTreeEvent.value.templateId',
      expectation: 'expected a string',
    },
    {
      name: 'non-string contract id',
      response: directTree({ ...createdValue, contractId: 42 }),
      path: 'transactionTree.eventsById.0.CreatedTreeEvent.value.contractId',
      expectation: 'expected a string',
    },
  ])('rejects a malformed $name with a field-specific error', ({ response, path, expectation }) => {
    const message = `Invalid transaction tree at ${path}: ${expectation}`;
    expect(() => convertTransactionTreeToEventsResponse(response, 'synchronizer-1')).toThrow(message);
    expect(() => extractContractIdFromTransactionTree(response, 'CapTable')).toThrow(message);
  });

  it('rejects malformed nested events with the nested field path', () => {
    const response = {
      transactionTree: {
        transaction: {
          eventsById: { '7': null },
        },
      },
    };

    expect(() => extractContractIdFromTransactionTree(response, 'CapTable')).toThrow(
      'Invalid transaction tree at transactionTree.transaction.eventsById.7: expected an object'
    );
  });
});
