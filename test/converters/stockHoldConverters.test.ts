/**
 * The Fairmint OCF extension's hold pair: TX_STOCK_HOLD and TX_STOCK_HOLD_CANCELLATION.
 *
 * The register writes the pair itself under derived IDs, so the SDK reads it and validates it against the vendored
 * extension schemas, and has no writer for it.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_REGISTRY,
  OCF_DATA_FIELD,
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  isOcfLedgerWrittenEntityType,
} from '../../src/functions/OpenCapTable/capTable';
import { convertToOcf, decodeDamlEntityData } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml, convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { getStockHoldAsOcf } from '../../src/functions/OpenCapTable/stockHold';
import { damlStockHoldToNative } from '../../src/functions/OpenCapTable/stockHold/damlToOcf';
import { getStockHoldCancellationAsOcf } from '../../src/functions/OpenCapTable/stockHoldCancellation';
import { OcpClient } from '../../src/OcpClient';
import type { OcfStockHold, OcfStockHoldCancellation } from '../../src/types';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { loadSyntheticFixture, stripSourceMetadata } from '../utils/productionFixtures';
import { TEST_REGISTER_SIGNATORIES } from '../utils/registerEvents';

const GENERATED_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
  transfer_agent: 'transfer-agent::party',
  cap_table_id: 'cap-table-1',
} as const;

const settlementHold = stripSourceMetadata(
  loadSyntheticFixture<Record<string, unknown>>('stockHoldRegisterSettlement')
);
const stopHold = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stockHoldStopTransfer'));
const cancellation = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stockHoldCancellation'));

/** The Daml `StockHoldOcfData` the register writes for a settlement hold, as the ledger returns it. */
const damlSettlementHold = {
  id: 'test-stock-hold-settlement-001',
  date: '2026-03-02',
  hold_type: 'OcfHoldTypeRegisterSettlement',
  reason_text: 'Shares held for the settlement of a trade at the register',
  reference: 'settlement-2026-03-02-0001',
  security_id: 'test-security-stock-hold-001',
  comments: ['Placed by the transfer agent with the trade'],
  quantity: '1500.0000000000',
};

const damlStopHold = {
  id: 'test-stock-hold-stop-001',
  date: '2026-03-03',
  hold_type: 'OcfHoldTypeStopTransfer',
  reason_text: 'Stop transfer ordered by the court',
  reference: 'court-order-2026-117',
  security_id: 'test-security-stock-hold-002',
  comments: [],
  quantity: null,
};

const damlCancellation = {
  id: 'test-stock-hold-cancellation-001',
  date: '2026-03-04',
  hold_id: 'test-stock-hold-settlement-001',
  reason_text: 'The trade was not executed',
  security_id: 'test-security-stock-hold-001',
  comments: ['Hold released whole'],
};

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to fail');
}

describe('hold pair schema validation (vendored Fairmint OCF extension)', () => {
  test('accepts a settlement hold, a stop without quantity and a cancellation', () => {
    expect(parseOcfEntityInput('stockHold', settlementHold)).toMatchObject({ hold_type: 'REGISTER_SETTLEMENT' });
    expect(parseOcfEntityInput('stockHold', stopHold)).toMatchObject({ hold_type: 'STOP_TRANSFER' });
    expect(parseOcfEntityInput('stockHoldCancellation', cancellation)).toMatchObject({
      hold_id: 'test-stock-hold-settlement-001',
    });
  });

  test('also parses the pair as raw OCF objects', () => {
    expect(parseOcfObject(settlementHold)).toMatchObject({ object_type: 'TX_STOCK_HOLD' });
    expect(parseOcfObject(cancellation)).toMatchObject({ object_type: 'TX_STOCK_HOLD_CANCELLATION' });
  });

  test('rejects a settlement hold without quantity', () => {
    const { quantity: _quantity, ...withoutQuantity } = settlementHold;

    expect(() => parseOcfEntityInput('stockHold', withoutQuantity)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(withoutQuantity)).toThrow(OcpValidationError);
  });

  test('rejects a stop transfer hold that names a quantity', () => {
    expect(() => parseOcfEntityInput('stockHold', { ...stopHold, quantity: '10' })).toThrow(OcpValidationError);
  });

  test('rejects an unknown hold type, a missing field and an extra property', () => {
    expect(() => parseOcfEntityInput('stockHold', { ...settlementHold, hold_type: 'PLEDGE' })).toThrow(
      OcpValidationError
    );
    const { reference: _reference, ...withoutReference } = settlementHold;
    expect(() => parseOcfEntityInput('stockHold', withoutReference)).toThrow(OcpValidationError);
    expect(() => parseOcfEntityInput('stockHold', { ...settlementHold, issuer: 'party' })).toThrow(OcpValidationError);
    const { hold_id: _holdId, ...withoutHoldId } = cancellation;
    expect(() => parseOcfEntityInput('stockHoldCancellation', withoutHoldId)).toThrow(OcpValidationError);
  });

  test('rejects an object type that is not the entity kind', () => {
    expect(() => parseOcfEntityInput('stockHold', cancellation)).toThrow(
      expect.objectContaining({ fieldPath: 'object_type' })
    );
  });
});

describe('hold pair reads (Daml to OCF)', () => {
  test('reads a settlement hold with its quantity and the optional comments', () => {
    const data = decodeDamlEntityData('stockHold', damlSettlementHold);

    expect(convertToOcf('stockHold', data)).toEqual(settlementHold);
  });

  test('reads a stop transfer hold without a quantity', () => {
    const data = decodeDamlEntityData('stockHold', damlStopHold);
    const hold = convertToOcf('stockHold', data);

    expect(hold).toEqual(stopHold);
    expect(hold).not.toHaveProperty('quantity');
    expect(hold).not.toHaveProperty('comments');
  });

  test('reads a hold cancellation', () => {
    const data = decodeDamlEntityData('stockHoldCancellation', damlCancellation);

    expect(convertToOcf('stockHoldCancellation', data)).toEqual(cancellation);
  });

  test('produces output that the extension schemas accept', () => {
    for (const [entityType, daml] of [
      ['stockHold', damlSettlementHold],
      ['stockHold', damlStopHold],
      ['stockHoldCancellation', damlCancellation],
    ] as const) {
      const ocf = convertToOcf(entityType, decodeDamlEntityData(entityType, daml) as never);

      expect(() => parseOcfEntityInput(entityType, ocf)).not.toThrow();
    }
  });

  test('rejects a settlement hold without a quantity', () => {
    const data = decodeDamlEntityData('stockHold', { ...damlSettlementHold, quantity: null });

    expect(captureError(() => damlStockHoldToNative(data))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'stockHold.quantity',
    });
  });

  test('rejects a stop transfer hold that carries a quantity', () => {
    const data = decodeDamlEntityData('stockHold', { ...damlStopHold, quantity: '5.0000000000' });

    expect(captureError(() => damlStockHoldToNative(data))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'stockHold.quantity',
    });
  });

  test('rejects a Daml timestamp where a hold date is a Daml Date', () => {
    const data = decodeDamlEntityData('stockHold', damlStopHold);

    expect(captureError(() => damlStockHoldToNative({ ...data, date: '2026-03-03T00:00:00.000Z' }))).toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'stockHold.date',
    });
  });

  test('rejects a v34 hold type constructor through the generated codec', () => {
    expect(() => decodeDamlEntityData('stockHold', { ...damlStopHold, hold_type: 'OcfHoldStopTransfer' })).toThrow(
      OcpParseError
    );
  });
});

describe('hold pair is read-only for the SDK', () => {
  test.each(['stockHold', 'stockHoldCancellation'] as const)('%s is not creatable, editable or deletable', (kind) => {
    expect(isOcfLedgerWrittenEntityType(kind)).toBe(true);
    expect(isOcfCreatableEntityType(kind)).toBe(false);
    expect(isOcfEditableEntityType(kind)).toBe(false);
    expect(isOcfDeletableEntityType(kind)).toBe(false);
  });

  test.each([
    ['stockHold', settlementHold],
    ['stockHoldCancellation', cancellation],
  ] as const)('%s has no OCF to Daml converter', (kind, data) => {
    expect(() => convertToDaml(kind as never, data as never)).toThrow(
      expect.objectContaining({ name: 'OcpParseError', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE, source: 'entityType' })
    );
    expect(() => convertToDamlData(kind as never, data as never)).toThrow(OcpParseError);
  });

  test('the registry pairs the hold records with their generated record constructors', () => {
    expect(ENTITY_REGISTRY.stockHold).toMatchObject({
      objectType: 'TX_STOCK_HOLD',
      recordTag: 'OcfRecordDataStockHold',
      cidTag: 'OcfRecordCidStockHold',
    });
    expect(ENTITY_REGISTRY.stockHoldCancellation).toMatchObject({
      objectType: 'TX_STOCK_HOLD_CANCELLATION',
      recordTag: 'OcfRecordDataStockHoldCancellation',
      cidTag: 'OcfRecordCidStockHoldCancellation',
    });
  });
});

describe('hold pair client reads', () => {
  function clientReading(templateId: string, damlData: Record<string, unknown>) {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId,
          createArgument: { context: GENERATED_CONTEXT, [OCF_DATA_FIELD]: damlData },
        },
      },
    });
    return { ocp: new OcpClient({ ledger: { getEventsByContractId } as never }), getEventsByContractId };
  }

  test('OpenCapTable.stockHold.get and getByObjectType read a settlement hold', async () => {
    const { ocp, getEventsByContractId } = clientReading(ENTITY_REGISTRY.stockHold.templateId, damlSettlementHold);

    const direct = await ocp.OpenCapTable.stockHold.get({ contractId: 'hold-cid', readAs: ['issuer::party'] });
    const generic = await ocp.OpenCapTable.getByObjectType({ objectType: 'TX_STOCK_HOLD', contractId: 'hold-cid' });

    expect(direct).toEqual({ data: settlementHold, contractId: 'hold-cid' });
    expect(generic).toEqual(direct);
    expect(getEventsByContractId).toHaveBeenCalledWith({ contractId: 'hold-cid', readAs: ['issuer::party'] });
  });

  test('OpenCapTable.stockHoldCancellation.get and getByObjectType read a cancellation', async () => {
    const { ocp } = clientReading(ENTITY_REGISTRY.stockHoldCancellation.templateId, damlCancellation);

    const direct = await ocp.OpenCapTable.stockHoldCancellation.get({ contractId: 'cancel-cid' });
    const generic = await ocp.OpenCapTable.getByObjectType({
      objectType: 'TX_STOCK_HOLD_CANCELLATION',
      contractId: 'cancel-cid',
    });

    expect(direct).toEqual({ data: cancellation, contractId: 'cancel-cid' });
    expect(generic).toEqual(direct);
  });

  test('the entity-folder readers return the OCF event', async () => {
    const hold = clientReading(ENTITY_REGISTRY.stockHold.templateId, damlStopHold);
    const cancel = clientReading(ENTITY_REGISTRY.stockHoldCancellation.templateId, damlCancellation);

    const holdResult: { event: OcfStockHold; contractId: string } = await getStockHoldAsOcf(hold.ocp.ledger, {
      contractId: 'hold-cid',
    });
    const cancelResult: { event: OcfStockHoldCancellation; contractId: string } = await getStockHoldCancellationAsOcf(
      cancel.ocp.ledger,
      { contractId: 'cancel-cid' }
    );

    expect(holdResult).toEqual({ event: stopHold, contractId: 'hold-cid' });
    expect(cancelResult).toEqual({ event: cancellation, contractId: 'cancel-cid' });
  });

  test('a hold contract of the wrong template is rejected before decoding', async () => {
    const { ocp } = clientReading(ENTITY_REGISTRY.stockCancellation.templateId, damlSettlementHold);

    await expect(ocp.OpenCapTable.stockHold.get({ contractId: 'wrong-cid' })).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
    });
  });
});
