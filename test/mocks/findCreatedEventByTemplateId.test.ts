import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../mocks/fairmint-canton-node-sdk';

describe('findCreatedEventByTemplateId mock compatibility', () => {
  test('finds created event from legacy nested transaction tree shape', () => {
    const createdEvent = {
      CreatedTreeEvent: {
        value: {
          templateId: 'pkg:Fairmint.OpenCapTable.Stakeholder:Stakeholder',
          contractId: 'cid',
        },
      },
    };
    const response = {
      transactionTree: {
        transaction: {
          eventsById: {
            '0': createdEvent,
          },
        },
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse;

    const result = findCreatedEventByTemplateId(response, 'pkg:Fairmint.OpenCapTable.Stakeholder:Stakeholder');

    expect(result).toEqual(createdEvent);
  });
});
