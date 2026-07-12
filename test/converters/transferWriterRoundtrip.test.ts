import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  decodeDamlEntityData,
  extractAndDecodeDamlEntityData,
} from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { convertibleTransferDataToDaml } from '../../src/functions/OpenCapTable/convertibleTransfer/convertibleTransferDataToDaml';
import {
  damlConvertibleTransferToNative,
  type DamlConvertibleTransferData,
} from '../../src/functions/OpenCapTable/convertibleTransfer/damlToOcf';
import { getConvertibleTransferAsOcf } from '../../src/functions/OpenCapTable/convertibleTransfer/getConvertibleTransferAsOcf';
import {
  damlEquityCompensationTransferToNative,
  type DamlEquityCompensationTransferData,
} from '../../src/functions/OpenCapTable/equityCompensationTransfer/damlToOcf';
import { equityCompensationTransferDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationTransfer/equityCompensationTransferDataToDaml';
import { getEquityCompensationTransferAsOcf } from '../../src/functions/OpenCapTable/equityCompensationTransfer/getEquityCompensationTransferAsOcf';
import { stockTransferDataToDaml } from '../../src/functions/OpenCapTable/stockTransfer/createStockTransfer';
import {
  damlStockTransferToNative,
  type DamlStockTransferData,
} from '../../src/functions/OpenCapTable/stockTransfer/damlToOcf';
import { getStockTransferAsOcf } from '../../src/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';
import {
  damlWarrantTransferToNative,
  type DamlWarrantTransferData,
} from '../../src/functions/OpenCapTable/warrantTransfer/damlToOcf';
import { getWarrantTransferAsOcf } from '../../src/functions/OpenCapTable/warrantTransfer/getWarrantTransferAsOcf';
import { warrantTransferDataToDaml } from '../../src/functions/OpenCapTable/warrantTransfer/warrantTransferDataToDaml';
import type {
  OcfConvertibleTransfer,
  OcfEquityCompensationTransfer,
  OcfStockTransfer,
  OcfWarrantTransfer,
} from '../../src/types/native';

type TransferEntityType = 'convertibleTransfer' | 'equityCompensationTransfer' | 'stockTransfer' | 'warrantTransfer';
type TransferInput = OcfConvertibleTransfer | OcfEquityCompensationTransfer | OcfStockTransfer | OcfWarrantTransfer;
type TransferEvent = TransferInput;

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

interface TransferCase {
  readonly entityType: TransferEntityType;
  readonly contractId: string;
  readonly numericField: 'amount' | 'quantity';
  readonly input: () => TransferInput;
  readonly expected: TransferEvent;
  readonly write: (input: unknown) => Record<string, unknown>;
  readonly dispatchWrite: (input: unknown) => Record<string, unknown>;
  readonly read: (data: unknown) => TransferEvent;
  readonly dispatchRead: (data: unknown) => TransferEvent;
  readonly encodeWrapper: (data: Record<string, unknown>) => Record<string, unknown>;
  readonly invoke: (client: LedgerJsonApiClient) => Promise<{ event: TransferEvent; contractId: string }>;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected generated codec to encode an object');
  }
  return value as Record<string, unknown>;
}

const cases: readonly TransferCase[] = [
  {
    entityType: 'stockTransfer',
    contractId: 'stock-transfer-cid',
    numericField: 'quantity',
    input: (): OcfStockTransfer => ({
      object_type: 'TX_STOCK_TRANSFER',
      id: 'stock-transfer-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5000000000',
      resulting_security_ids: ['stock-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    }),
    expected: {
      object_type: 'TX_STOCK_TRANSFER',
      id: 'stock-transfer-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5',
      resulting_security_ids: ['stock-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    },
    write: (input) => stockTransferDataToDaml(input as OcfStockTransfer),
    dispatchWrite: (input) => convertToDaml('stockTransfer', input as OcfStockTransfer),
    read: (data) => damlStockTransferToNative(data as DamlStockTransferData),
    dispatchRead: (data) => convertToOcf('stockTransfer', data as DamlDataTypeFor<'stockTransfer'>),
    encodeWrapper: (data) =>
      requireRecord(
        Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer.encode({
          context: VALID_CONTEXT,
          transfer_data: data as DamlDataTypeFor<'stockTransfer'>,
        })
      ),
    invoke: async (client) => getStockTransferAsOcf(client, { contractId: 'stock-transfer-cid' }),
  },
  {
    entityType: 'convertibleTransfer',
    contractId: 'convertible-transfer-cid',
    numericField: 'amount',
    input: (): OcfConvertibleTransfer => ({
      object_type: 'TX_CONVERTIBLE_TRANSFER',
      id: 'convertible-transfer-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      amount: { amount: '250.0000000000', currency: 'USD' },
      resulting_security_ids: ['convertible-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    }),
    expected: {
      object_type: 'TX_CONVERTIBLE_TRANSFER',
      id: 'convertible-transfer-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      amount: { amount: '250', currency: 'USD' },
      resulting_security_ids: ['convertible-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    },
    write: (input) => convertibleTransferDataToDaml(input as OcfConvertibleTransfer),
    dispatchWrite: (input) => convertToDaml('convertibleTransfer', input as OcfConvertibleTransfer),
    read: (data) => damlConvertibleTransferToNative(data as DamlConvertibleTransferData),
    dispatchRead: (data) => convertToOcf('convertibleTransfer', data as DamlDataTypeFor<'convertibleTransfer'>),
    encodeWrapper: (data) =>
      requireRecord(
        Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransfer.encode({
          context: VALID_CONTEXT,
          transfer_data: data as DamlDataTypeFor<'convertibleTransfer'>,
        })
      ),
    invoke: async (client) => getConvertibleTransferAsOcf(client, { contractId: 'convertible-transfer-cid' }),
  },
  {
    entityType: 'equityCompensationTransfer',
    contractId: 'equityCompensationTransfer-cid',
    numericField: 'quantity',
    input: (): OcfEquityCompensationTransfer => ({
      object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
      id: 'equity-transfer-1',
      date: '2026-07-10',
      security_id: 'equity-security-1',
      quantity: '8.0000000000',
      resulting_security_ids: ['equity-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    }),
    expected: {
      object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
      id: 'equity-transfer-1',
      date: '2026-07-10',
      security_id: 'equity-security-1',
      quantity: '8',
      resulting_security_ids: ['equity-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    },
    write: (input) => equityCompensationTransferDataToDaml(input as OcfEquityCompensationTransfer),
    dispatchWrite: (input) => convertToDaml('equityCompensationTransfer', input as OcfEquityCompensationTransfer),
    read: (data) => damlEquityCompensationTransferToNative(data as DamlEquityCompensationTransferData),
    dispatchRead: (data) =>
      convertToOcf('equityCompensationTransfer', data as DamlDataTypeFor<'equityCompensationTransfer'>),
    encodeWrapper: (data) =>
      requireRecord(
        Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransfer.encode({
          context: VALID_CONTEXT,
          transfer_data: data as DamlDataTypeFor<'equityCompensationTransfer'>,
        })
      ),
    invoke: async (client) =>
      getEquityCompensationTransferAsOcf(client, { contractId: 'equityCompensationTransfer-cid' }),
  },
  {
    entityType: 'warrantTransfer',
    contractId: 'warrant-transfer-cid',
    numericField: 'quantity',
    input: (): OcfWarrantTransfer => ({
      object_type: 'TX_WARRANT_TRANSFER',
      id: 'warrant-transfer-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      quantity: '3.0000000000',
      resulting_security_ids: ['warrant-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    }),
    expected: {
      object_type: 'TX_WARRANT_TRANSFER',
      id: 'warrant-transfer-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      quantity: '3',
      resulting_security_ids: ['warrant-result-1'],
      balance_security_id: '',
      consideration_text: '',
      comments: ['', ' keep whitespace '],
    },
    write: (input) => warrantTransferDataToDaml(input as OcfWarrantTransfer),
    dispatchWrite: (input) => convertToDaml('warrantTransfer', input as OcfWarrantTransfer),
    read: (data) => damlWarrantTransferToNative(data as DamlWarrantTransferData),
    dispatchRead: (data) => convertToOcf('warrantTransfer', data as DamlDataTypeFor<'warrantTransfer'>),
    encodeWrapper: (data) =>
      requireRecord(
        Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransfer.encode({
          context: VALID_CONTEXT,
          transfer_data: data as DamlDataTypeFor<'warrantTransfer'>,
        })
      ),
    invoke: async (client) => getWarrantTransferAsOcf(client, { contractId: 'warrant-transfer-cid' }),
  },
];

function createArgument(testCase: TransferCase, data: unknown): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
  };
}

function clientFor(testCase: TransferCase, createArgumentValue: unknown): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          createArgument: createArgumentValue,
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

function expectBoundedSdkError(error: unknown): void {
  expect(error).toBeInstanceOf(OcpError);
  let serialized = '';
  expect(() => {
    serialized = JSON.stringify(error);
  }).not.toThrow();
  expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThan(4_096);
}

async function capture(action: () => unknown): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to reject');
}

async function collectReadSurfaceErrors(testCase: TransferCase, data: unknown): Promise<readonly unknown[]> {
  return Promise.all([
    capture(() => decodeDamlEntityData(testCase.entityType, data)),
    capture(() => testCase.read(data)),
    capture(() => testCase.dispatchRead(data)),
    capture(() => extractAndDecodeDamlEntityData(testCase.entityType, createArgument(testCase, data))),
    capture(async () => testCase.invoke(clientFor(testCase, createArgument(testCase, data)))),
  ]);
}

async function collectConversionSurfaceErrors(testCase: TransferCase, data: unknown): Promise<readonly unknown[]> {
  return Promise.all([
    capture(() => testCase.read(data)),
    capture(() => testCase.dispatchRead(data)),
    capture(async () => testCase.invoke(clientFor(testCase, createArgument(testCase, data)))),
  ]);
}

describe('exact transfer writer and reader symmetry', () => {
  it.each(cases)(
    '$entityType round-trips through direct, dispatcher, generated wrapper, and ledger surfaces',
    async (testCase) => {
      for (const write of [testCase.write, testCase.dispatchWrite]) {
        const written = write(testCase.input());
        expect(written.balance_security_id).toBe('');
        expect(written.consideration_text).toBe('');
        expect(written.comments).toEqual(['', ' keep whitespace ']);
        expect(testCase.read(written)).toEqual(testCase.expected);
        expect(testCase.dispatchRead(written)).toEqual(testCase.expected);

        const wrapper = testCase.encodeWrapper(written);
        await expect(testCase.invoke(clientFor(testCase, wrapper))).resolves.toEqual({
          event: testCase.expected,
          contractId: testCase.contractId,
        });
      }
    }
  );

  it.each(cases)('$entityType rejects duplicate result IDs on direct and dispatcher writer surfaces', (testCase) => {
    const input = { ...testCase.input(), resulting_security_ids: ['duplicate', 'duplicate'] };
    for (const write of [testCase.write, testCase.dispatchWrite]) {
      expect(() => write(input)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: `${testCase.entityType}.resulting_security_ids[1]`,
        })
      );
    }
  });

  it.each(cases)(
    '$entityType preserves schema-valid empty id and security_id values symmetrically',
    async (testCase) => {
      for (const field of ['id', 'security_id'] as const) {
        const input = { ...testCase.input(), [field]: '' };
        const expected = { ...testCase.expected, [field]: '' };
        for (const write of [testCase.write, testCase.dispatchWrite]) {
          const written = write(input);
          expect(written[field]).toBe('');
          expect(testCase.read(written)).toEqual(expected);
          const wrapper = testCase.encodeWrapper(written);
          await expect(testCase.invoke(clientFor(testCase, wrapper))).resolves.toEqual({
            event: expected,
            contractId: testCase.contractId,
          });
        }
      }
    }
  );

  it.each(cases)('$entityType rejects out-of-range Numeric10 values on reads and writes', async (testCase) => {
    for (const invalid of ['12345678901234567890123456789', '1.12345678901']) {
      const input = testCase.input() as TransferInput & Record<string, unknown>;
      if (testCase.numericField === 'amount') {
        input.amount = { amount: invalid, currency: 'USD' };
      } else {
        input.quantity = invalid;
      }
      const fieldPath =
        testCase.numericField === 'amount' ? `${testCase.entityType}.amount.amount` : `${testCase.entityType}.quantity`;

      for (const write of [testCase.write, testCase.dispatchWrite]) {
        expect(() => write(input)).toThrow(
          expect.objectContaining({ name: 'OcpValidationError', code: OcpErrorCodes.INVALID_FORMAT, fieldPath })
        );
      }

      const validData = testCase.write(testCase.input());
      const malformedData =
        testCase.numericField === 'amount'
          ? { ...validData, amount: { amount: invalid, currency: 'USD' } }
          : { ...validData, quantity: invalid };
      for (const error of await collectConversionSurfaceErrors(testCase, malformedData)) {
        expect(error).toMatchObject({ name: 'OcpValidationError', code: OcpErrorCodes.INVALID_FORMAT, fieldPath });
      }
    }
  });

  it('convertibleTransfer rejects non-canonical currency before submission and after decoding', async () => {
    const testCase = cases.find(({ entityType }) => entityType === 'convertibleTransfer');
    if (testCase === undefined) throw new Error('Missing convertible transfer case');
    const input = testCase.input() as OcfConvertibleTransfer;
    input.amount = { ...input.amount, currency: 'usd' };
    for (const write of [testCase.write, testCase.dispatchWrite]) {
      expect(() => write(input)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: 'convertibleTransfer.amount.currency',
        })
      );
    }

    const malformed = {
      ...testCase.write(testCase.input()),
      amount: { amount: '250', currency: 'usd' },
    };
    for (const error of await collectConversionSurfaceErrors(testCase, malformed)) {
      expect(error).toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'convertibleTransfer.amount.currency',
      });
    }
  });
});

describe('trap-free transfer writer boundaries', () => {
  it.each(cases)('$entityType rejects accessors without invoking them on every writer surface', (testCase) => {
    for (const write of [testCase.write, testCase.dispatchWrite]) {
      let invocations = 0;
      const input = testCase.input() as TransferInput & Record<string, unknown>;
      Object.defineProperty(input, testCase.numericField, {
        configurable: true,
        enumerable: true,
        get: () => {
          invocations += 1;
          throw new Error('writer accessor must not run');
        },
      });
      const error = (() => {
        try {
          write(input);
        } catch (caught) {
          return caught;
        }
        throw new Error('Expected accessor writer input to fail');
      })();
      expect(invocations).toBe(0);
      expect(error).toMatchObject({
        name: 'OcpValidationError',
        fieldPath: `${testCase.entityType}.${testCase.numericField}`,
      });
      expectBoundedSdkError(error);
    }
  });

  it.each(cases)('$entityType rejects benign, throwing, and revoked input Proxies without traps', (testCase) => {
    for (const write of [testCase.write, testCase.dispatchWrite]) {
      for (const proxyKind of ['benign', 'throwing', 'revoked'] as const) {
        let trapCalls = 0;
        const trap = (): never => {
          trapCalls += 1;
          throw new Error('writer Proxy trap must not run');
        };
        const target = testCase.input();
        let proxy: object;
        if (proxyKind === 'benign') {
          proxy = new Proxy(target, {});
        } else if (proxyKind === 'throwing') {
          proxy = new Proxy(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
        } else {
          const revocable = Proxy.revocable(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
          ({ proxy } = revocable);
          revocable.revoke();
        }
        let error: unknown;
        try {
          write(proxy);
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(trapCalls).toBe(0);
        expectBoundedSdkError(error);
      }
    }
  });

  it.each(cases)('$entityType rejects inherited, hidden, symbol, cyclic, and huge sparse writer data', (testCase) => {
    const attacks: unknown[] = [];

    const inherited = Object.create(testCase.input()) as Record<string, unknown>;
    attacks.push(inherited);

    const hidden = testCase.input() as TransferInput & Record<string, unknown>;
    Object.defineProperty(hidden, 'hidden', { enumerable: false, value: true });
    attacks.push(hidden);

    const symbol = testCase.input() as TransferInput & Record<PropertyKey, unknown>;
    symbol[Symbol('hidden')] = true;
    attacks.push(symbol);

    const cyclic = testCase.input() as TransferInput & Record<string, unknown>;
    cyclic.cycle = cyclic;
    attacks.push(cyclic);

    const sparse = testCase.input() as TransferInput & Record<string, unknown>;
    sparse.comments = new Array(0xffff_ffff);
    attacks.push(sparse);

    const prototypeTrap = (): never => {
      throw new Error('prototype Proxy trap must not run');
    };
    const hostilePrototype = testCase.input();
    Object.setPrototypeOf(
      hostilePrototype,
      new Proxy(
        {},
        {
          get: prototypeTrap,
          getOwnPropertyDescriptor: prototypeTrap,
          getPrototypeOf: prototypeTrap,
          ownKeys: prototypeTrap,
        }
      )
    );
    attacks.push(hostilePrototype);

    for (const attack of attacks) {
      for (const write of [testCase.write, testCase.dispatchWrite]) {
        let error: unknown;
        try {
          write(attack);
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(OcpValidationError);
        expectBoundedSdkError(error);
      }
    }
  });
});

describe('trap-free transfer reader boundaries', () => {
  it.each(cases)('$entityType rejects an accessor without invoking it on every reader surface', async (testCase) => {
    let invocations = 0;
    const data = testCase.write(testCase.input());
    Object.defineProperty(data, testCase.numericField, {
      configurable: true,
      enumerable: true,
      get: () => {
        invocations += 1;
        throw new Error('reader accessor must not run');
      },
    });

    const errors = await collectReadSurfaceErrors(testCase, data);
    expect(invocations).toBe(0);
    for (const error of errors) {
      expect(error).toBeInstanceOf(OcpParseError);
      expectBoundedSdkError(error);
    }
  });

  it.each(cases)(
    '$entityType rejects benign, throwing, and revoked payload Proxies without traps',
    async (testCase) => {
      for (const proxyKind of ['benign', 'throwing', 'revoked'] as const) {
        let trapCalls = 0;
        const trap = (): never => {
          trapCalls += 1;
          throw new Error('reader Proxy trap must not run');
        };
        const target = testCase.write(testCase.input());
        let proxy: object;
        if (proxyKind === 'benign') {
          proxy = new Proxy(target, {});
        } else if (proxyKind === 'throwing') {
          proxy = new Proxy(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
        } else {
          const revocable = Proxy.revocable(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
          ({ proxy } = revocable);
          revocable.revoke();
        }
        const errors = await collectReadSurfaceErrors(testCase, proxy);
        expect(trapCalls).toBe(0);
        for (const error of errors) expectBoundedSdkError(error);
      }
    }
  );

  it.each(cases)('$entityType rejects non-enumerable, symbol, cyclic, and huge sparse payloads', async (testCase) => {
    const attacks: unknown[] = [];

    const hidden = testCase.write(testCase.input());
    const { id } = hidden;
    delete hidden.id;
    Object.defineProperty(hidden, 'id', { enumerable: false, value: id });
    attacks.push(hidden);

    const symbol = testCase.write(testCase.input());
    Object.defineProperty(symbol, Symbol('hidden'), { enumerable: true, value: true });
    attacks.push(symbol);

    const cyclic = testCase.write(testCase.input());
    cyclic.cycle = cyclic;
    attacks.push(cyclic);

    const sparse = testCase.write(testCase.input());
    sparse.comments = new Array(0xffff_ffff);
    attacks.push(sparse);

    const startedAt = Date.now();
    for (const attack of attacks) {
      const errors = await collectReadSurfaceErrors(testCase, attack);
      for (const error of errors) expectBoundedSdkError(error);
    }
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it.each(cases)(
    '$entityType rejects benign, throwing, and revoked full-wrapper Proxies without traps',
    async (testCase) => {
      for (const proxyKind of ['benign', 'throwing', 'revoked'] as const) {
        let trapCalls = 0;
        const trap = (): never => {
          trapCalls += 1;
          throw new Error('wrapper Proxy trap must not run');
        };
        const target = createArgument(testCase, testCase.write(testCase.input()));
        let proxy: object;
        if (proxyKind === 'benign') {
          proxy = new Proxy(target, {});
        } else if (proxyKind === 'throwing') {
          proxy = new Proxy(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
        } else {
          const revocable = Proxy.revocable(target, {
            get: trap,
            getOwnPropertyDescriptor: trap,
            getPrototypeOf: trap,
            ownKeys: trap,
          });
          ({ proxy } = revocable);
          revocable.revoke();
        }
        const errors = await Promise.all([
          capture(() => extractAndDecodeDamlEntityData(testCase.entityType, proxy)),
          capture(async () => testCase.invoke(clientFor(testCase, proxy))),
        ]);
        expect(trapCalls).toBe(0);
        for (const error of errors) expectBoundedSdkError(error);
      }
    }
  );

  it('rejects hostile contract-response envelopes without invoking Proxy or then/createArgument accessors', async () => {
    const testCase = cases.find(({ entityType }) => entityType === 'stockTransfer');
    if (testCase === undefined) throw new Error('Missing stock transfer case');
    const wrapper = createArgument(testCase, testCase.write(testCase.input()));
    const baseResponse = {
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId: ENTITY_TEMPLATE_ID_MAP.stockTransfer,
          createArgument: wrapper,
        },
      },
    };

    for (const proxyKind of ['benign', 'throwing', 'revoked'] as const) {
      let trapCalls = 0;
      const trap = (): never => {
        trapCalls += 1;
        throw new Error('response Proxy trap must not run');
      };
      let response: object;
      if (proxyKind === 'benign') {
        response = new Proxy(baseResponse, {});
      } else if (proxyKind === 'throwing') {
        response = new Proxy(baseResponse, {
          get: trap,
          getOwnPropertyDescriptor: trap,
          getPrototypeOf: trap,
          ownKeys: trap,
        });
      } else {
        const revocable = Proxy.revocable(baseResponse, {
          get: trap,
          getOwnPropertyDescriptor: trap,
          getPrototypeOf: trap,
          ownKeys: trap,
        });
        response = revocable.proxy;
        revocable.revoke();
      }
      const client = {
        getEventsByContractId: jest.fn().mockReturnValue(response),
      } as unknown as LedgerJsonApiClient;
      const error = await capture(async () => testCase.invoke(client));
      expect(trapCalls).toBe(0);
      expectBoundedSdkError(error);
    }

    for (const accessorField of ['then', 'createArgument'] as const) {
      let invocations = 0;
      const response = {
        created: {
          createdEvent: {
            contractId: testCase.contractId,
            templateId: ENTITY_TEMPLATE_ID_MAP.stockTransfer,
            createArgument: wrapper,
          },
        },
      } as Record<string, unknown>;
      const target =
        accessorField === 'then'
          ? response
          : ((response.created as Record<string, unknown>).createdEvent as Record<string, unknown>);
      Object.defineProperty(target, accessorField, {
        configurable: true,
        enumerable: true,
        get: () => {
          invocations += 1;
          throw new Error(`${accessorField} getter must not run`);
        },
      });
      const client = {
        getEventsByContractId: jest.fn().mockReturnValue(response),
      } as unknown as LedgerJsonApiClient;
      const error = await capture(async () => testCase.invoke(client));
      expect(invocations).toBe(0);
      expectBoundedSdkError(error);
    }
  });
});
