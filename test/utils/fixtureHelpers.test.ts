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

function createdEvent(value: unknown): Record<string, unknown> {
  return { CreatedTreeEvent: { value } };
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

  it('selects multiple created events by node ID rather than object insertion order', () => {
    const firstCreatedValue = { ...createdValue, contractId: 'contract-a' };
    const lastCreatedValue = { ...createdValue, contractId: 'contract-z' };
    const responses = [
      {
        transactionTree: {
          eventsById: {
            'node-z': createdEvent(lastCreatedValue),
            'node-a': createdEvent(firstCreatedValue),
          },
        },
      },
      {
        transactionTree: {
          eventsById: {
            'node-a': createdEvent(firstCreatedValue),
            'node-z': createdEvent(lastCreatedValue),
          },
        },
      },
    ];

    for (const response of responses) {
      expect(convertTransactionTreeToEventsResponse(response, 'synchronizer-1')).toEqual({
        archived: null,
        created: {
          createdEvent: lastCreatedValue,
          synchronizerId: 'synchronizer-1',
        },
      });
      expect(extractContractIdFromTransactionTree(response, 'CapTable')).toBe('contract-a');
    }
  });

  it('compares decimal ledger node IDs numerically', () => {
    const nodeTwoValue = { ...createdValue, contractId: 'contract-2' };
    const nodeTenValue = { ...createdValue, contractId: 'contract-10' };
    const response = {
      transactionTree: {
        eventsById: {
          '10': createdEvent(nodeTenValue),
          '2': createdEvent(nodeTwoValue),
        },
      },
    };

    expect(convertTransactionTreeToEventsResponse(response, 'synchronizer-1')).toMatchObject({
      created: { createdEvent: nodeTenValue },
    });
    expect(extractContractIdFromTransactionTree(response, 'CapTable')).toBe('contract-2');
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

  it('bounds hostile node IDs in field-specific diagnostics', () => {
    const hostileNodeId = 'x'.repeat(10_000);
    const response = { transactionTree: { eventsById: { [hostileNodeId]: null } } };

    try {
      extractContractIdFromTransactionTree(response, 'CapTable');
      throw new Error('Expected malformed transaction tree to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const { message } = error as Error;
      expect(message).toContain('[10000 chars]');
      expect(message).not.toContain(hostileNodeId);
      expect(message.length).toBeLessThan(700);
    }
  });
});
