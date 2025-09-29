import { OcpClient } from '../../src';

describe('get: getEquityCompensationExerciseEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockPlan.getEquityCompensationExerciseEventAsOcf({ contractId: 'equity-comp-exercise-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
        id: 'ece-1',
        quantity: '10',
        security_id: 'ps-1',
        date: '2025-01-13'
      },
      contractId: 'equity-comp-exercise-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockPlan.getEquityCompensationExerciseEventAsOcf({ contractId: 'equity-comp-exercise-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
        id: '5a9b5b82-8c18-4dd4-804a-bcec60faefb8',
        quantity: '5',
        security_id: '0094d247-7b24-4865-aedc-87f04ff2a63a',
        date: '2024-06-30',
        consideration_text: 'Purchase of 5 shares of Common Stock at $1 per share under the Stock Purchase Agreement.',
        resulting_security_ids: ['b0e4b17d-e3fe-2ab9-3ada-76ef1e6b742a'],
        comments: ['Exercise of stock option for 5 shares as per the Stock Purchase Agreement executed on June 30, 2024.']
      },
      contractId: 'equity-comp-exercise-full'
    });
  });
});


