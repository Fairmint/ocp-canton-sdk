import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import { ENTITY_TEMPLATE_ID_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getConvertibleCancellationAsOcf } from '../../src/functions/OpenCapTable/convertibleCancellation';

function createMockClient(createArgument: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: 'convertible-cancellation-contract-1',
          templateId: ENTITY_TEMPLATE_ID_MAP.convertibleCancellation,
          createArgument,
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('Convertible cancellation converters', () => {
  test('the dedicated getter returns the canonical monetary amount', async () => {
    const client = createMockClient({
      cancellation_data: {
        id: 'convertible-cancellation-1',
        date: '2026-07-09T00:00:00.000Z',
        security_id: 'convertible-security-1',
        amount: { amount: '1250.5000000000', currency: 'USD' },
        balance_security_id: 'convertible-security-balance-1',
        reason_text: 'Partial repayment',
        comments: ['Board approved'],
      },
    });

    const result = await getConvertibleCancellationAsOcf(client, {
      contractId: 'convertible-cancellation-contract-1',
    });

    expect(result).toEqual({
      contractId: 'convertible-cancellation-contract-1',
      event: {
        object_type: 'TX_CONVERTIBLE_CANCELLATION',
        id: 'convertible-cancellation-1',
        date: '2026-07-09',
        security_id: 'convertible-security-1',
        amount: { amount: '1250.5', currency: 'USD' },
        balance_security_id: 'convertible-security-balance-1',
        reason_text: 'Partial repayment',
        comments: ['Board approved'],
      },
    });
  });

  test('the dedicated getter rejects a cancellation without an amount', async () => {
    const client = createMockClient({
      cancellation_data: {
        id: 'convertible-cancellation-2',
        date: '2026-07-09T00:00:00.000Z',
        security_id: 'convertible-security-2',
        reason_text: 'Missing amount',
        balance_security_id: null,
        comments: [],
      },
    });

    await expect(
      getConvertibleCancellationAsOcf(client, { contractId: 'convertible-cancellation-contract-2' })
    ).rejects.toMatchObject({
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: 'convertibleCancellation',
        decoderPath: expect.any(String),
        decoderMessage: expect.stringContaining('amount'),
      },
    });
  });
});
