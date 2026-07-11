/** Losslessness guarantees layered over generated DAML codecs. */

import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  decodeDamlEntityData,
  extractAndDecodeDamlEntityData,
} from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import { convertibleTransferDataToDaml } from '../../src/functions/OpenCapTable/convertibleTransfer/convertibleTransferDataToDaml';
import { stockAcceptanceDataToDaml } from '../../src/functions/OpenCapTable/stockAcceptance/stockAcceptanceDataToDaml';
import { stockCancellationDataToDaml } from '../../src/functions/OpenCapTable/stockCancellation/createStockCancellation';
import { stockTransferDataToDaml } from '../../src/functions/OpenCapTable/stockTransfer/createStockTransfer';

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

function stockTransferData(): Record<string, unknown> {
  return stockTransferDataToDaml({
    object_type: 'TX_STOCK_TRANSFER',
    id: 'stock-transfer-1',
    date: '2026-07-10',
    security_id: 'stock-security-1',
    quantity: '12.5',
    resulting_security_ids: ['stock-result-1'],
  });
}

function convertibleTransferData(): Record<string, unknown> {
  return convertibleTransferDataToDaml({
    object_type: 'TX_CONVERTIBLE_TRANSFER',
    id: 'convertible-transfer-1',
    date: '2026-07-10',
    security_id: 'convertible-security-1',
    amount: { amount: '250', currency: 'USD' },
    resulting_security_ids: ['convertible-result-1'],
  });
}

function stockAcceptanceCreateArgument(): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    acceptance_data: stockAcceptanceDataToDaml({
      object_type: 'TX_STOCK_ACCEPTANCE',
      id: 'stock-acceptance-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      comments: ['accepted'],
    }),
  };
}

function stockCancellationCreateArgument(): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    cancellation_data: stockCancellationDataToDaml({
      object_type: 'TX_STOCK_CANCELLATION',
      id: 'stock-cancellation-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5',
      reason_text: 'Cancelled',
      comments: ['cancelled'],
    }),
  };
}

function expectLosslessFailure(input: Record<string, unknown>, path: string, message: string): void {
  try {
    decodeDamlEntityData('stockTransfer', input);
    throw new Error(`Expected decodeDamlEntityData to reject ${path}`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: 'stockTransfer',
        decoderPath: path,
        decoderMessage: message,
      },
    });
  }
}

type FullWrapperEntityType = 'stockAcceptance' | 'stockCancellation';

function expectFullWrapperLosslessFailure(
  entityType: FullWrapperEntityType,
  input: Record<string, unknown>,
  path: string,
  message: string
): void {
  try {
    extractAndDecodeDamlEntityData(entityType, input);
    throw new Error(`Expected extractAndDecodeDamlEntityData to reject ${path}`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType,
        decoderPath: path,
        decoderMessage: message,
      },
    });
  }
}

const fullWrapperCases = [
  {
    entityType: 'stockAcceptance',
    dataField: 'acceptance_data',
    validCreateArgument: stockAcceptanceCreateArgument,
  },
  {
    entityType: 'stockCancellation',
    dataField: 'cancellation_data',
    validCreateArgument: stockCancellationCreateArgument,
  },
] as const;

describe('decodeDamlEntityData losslessness', () => {
  it('accepts missing optional fields and keeps their generated null defaults', () => {
    const input = stockTransferData();
    delete input.balance_security_id;
    delete input.consideration_text;

    const decoded = decodeDamlEntityData('stockTransfer', input);

    expect(decoded.balance_security_id).toBeNull();
    expect(decoded.consideration_text).toBeNull();
  });

  it('accepts explicit null and string optional values', () => {
    const explicitNull = stockTransferData();
    explicitNull.balance_security_id = null;
    explicitNull.consideration_text = null;
    expect(decodeDamlEntityData('stockTransfer', explicitNull)).toMatchObject({
      balance_security_id: null,
      consideration_text: null,
    });

    const explicitStrings = stockTransferData();
    explicitStrings.balance_security_id = 'balance-security-1';
    explicitStrings.consideration_text = 'Consideration';
    expect(decodeDamlEntityData('stockTransfer', explicitStrings)).toMatchObject({
      balance_security_id: 'balance-security-1',
      consideration_text: 'Consideration',
    });
  });

  it('rejects malformed optional scalars at the exact field path', () => {
    expectLosslessFailure(
      { ...stockTransferData(), consideration_text: 17 },
      'input.consideration_text',
      'raw number was decoded and encoded as null'
    );
  });

  it('rejects malformed optional objects at the exact field path', () => {
    expectLosslessFailure(
      { ...stockTransferData(), balance_security_id: { value: 'not-text' } },
      'input.balance_security_id',
      'raw object was decoded and encoded as null'
    );
  });

  it('rejects unknown raw fields that a generated codec discards', () => {
    expectLosslessFailure(
      { ...stockTransferData(), unexpected_field: true },
      'input.unexpected_field',
      'raw field was discarded by the generated codec'
    );
  });

  it('reports a precise nested path for fields discarded inside records', () => {
    const input = convertibleTransferData();
    input.amount = { amount: '250', currency: 'USD', unexpected: 'discarded' };

    try {
      decodeDamlEntityData('convertibleTransfer', input);
      throw new Error('Expected nested field loss to be rejected');
    } catch (error: unknown) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: {
          entityType: 'convertibleTransfer',
          decoderPath: 'input.amount.unexpected',
          decoderMessage: 'raw field was discarded by the generated codec',
        },
      });
    }
  });

  it.each(fullWrapperCases)(
    '$entityType enforces losslessness at every level of its full generated wrapper',
    (testCase) => {
      const base = testCase.validCreateArgument();
      const context = base.context as Record<string, unknown>;
      const payload = base[testCase.dataField] as Record<string, unknown>;
      const mutations: ReadonlyArray<readonly [Record<string, unknown>, string]> = [
        [{ ...base, unexpected_wrapper_field: true }, 'input.unexpected_wrapper_field'],
        [
          { ...base, context: { ...context, unexpected_context_field: true } },
          'input.context.unexpected_context_field',
        ],
        [
          { ...base, [testCase.dataField]: { ...payload, unexpected_payload_field: true } },
          `input.${testCase.dataField}.unexpected_payload_field`,
        ],
      ];

      for (const [input, path] of mutations) {
        expectFullWrapperLosslessFailure(
          testCase.entityType,
          input,
          path,
          'raw field was discarded by the generated codec'
        );
      }
    }
  );

  it('leaves representative valid generated payloads unchanged', () => {
    const stock = stockTransferData();
    const convertible = convertibleTransferData();

    expect(decodeDamlEntityData('stockTransfer', stock)).toEqual(stock);
    expect(decodeDamlEntityData('convertibleTransfer', convertible)).toEqual(convertible);
  });
});
