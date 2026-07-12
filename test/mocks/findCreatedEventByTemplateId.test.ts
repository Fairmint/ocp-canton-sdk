import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../mocks/fairmint-canton-node-sdk';

describe('findCreatedEventByTemplateId mock compatibility', () => {
  const createdEvent = {
    CreatedTreeEvent: {
      value: {
        templateId: 'pkg:Fairmint.OpenCapTable.Stakeholder:Stakeholder',
        contractId: 'cid',
      },
    },
  };

  test.each([
    {
      name: 'direct transaction tree',
      transactionTree: {
        eventsById: {
          '0': createdEvent,
        },
      },
    },
    {
      name: 'legacy nested transaction tree',
      transactionTree: {
        transaction: {
          eventsById: {
            '0': createdEvent,
          },
        },
      },
    },
  ])('finds a created event from the $name shape', ({ transactionTree }) => {
    // The nested form is an intentionally supported legacy fixture shape outside the current SDK declaration.
    const response = { transactionTree } as unknown as SubmitAndWaitForTransactionTreeResponse;

    const result = findCreatedEventByTemplateId(response, 'pkg:Fairmint.OpenCapTable.Stakeholder:Stakeholder');

    expect(result).toEqual(createdEvent);
  });

  test('ignores malformed and non-created event wrappers', () => {
    const response = {
      transactionTree: {
        eventsById: {
          '0': { CreatedTreeEvent: { value: { templateId: 42, contractId: 'cid' } } },
          '1': { ExercisedTreeEvent: { value: {} } },
        },
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse;

    expect(findCreatedEventByTemplateId(response, 'Fairmint.OpenCapTable.Stakeholder:Stakeholder')).toBeUndefined();
  });
});
