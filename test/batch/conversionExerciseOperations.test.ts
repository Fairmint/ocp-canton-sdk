import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable/CapTableBatch';
import type {
  OcfCreateArguments,
  OcfCreateOperation,
  OcfDataTypeFor,
  OcfEditOperation,
  OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { ENTITY_TAG_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';

type ConversionExerciseType = Extract<
  OcfEntityType,
  'convertibleConversion' | 'stockConversion' | 'equityCompensationExercise' | 'warrantExercise'
>;

interface OperationCase {
  readonly entityType: ConversionExerciseType;
  readonly data: OcfDataTypeFor<ConversionExerciseType>;
  readonly numericField?: 'quantity_converted' | 'quantity';
  readonly numericPath?: string;
}

const operationCases = [
  {
    entityType: 'convertibleConversion',
    data: {
      object_type: 'TX_CONVERTIBLE_CONVERSION',
      id: '',
      date: '2026-07-10',
      reason_text: '',
      security_id: '',
      trigger_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      balance_security_id: '',
      quantity_converted: '+000.5000000000',
      comments: [''],
    },
    numericField: 'quantity_converted',
    numericPath: 'convertibleConversion.quantity_converted',
  },
  {
    entityType: 'stockConversion',
    data: {
      object_type: 'TX_STOCK_CONVERSION',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity_converted: '-0',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      balance_security_id: '',
      comments: [''],
    },
    numericField: 'quantity_converted',
    numericPath: 'stockConversion.quantity_converted',
  },
  {
    entityType: 'equityCompensationExercise',
    data: {
      object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity: '0.0000000001',
      consideration_text: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      comments: [''],
    },
    numericField: 'quantity',
    numericPath: 'equityCompensationExercise.quantity',
  },
  {
    entityType: 'warrantExercise',
    data: {
      object_type: 'TX_WARRANT_EXERCISE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      trigger_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      consideration_text: '',
      comments: [''],
    },
  },
] as const satisfies readonly OperationCase[];

const numericOperationCases = operationCases.filter(
  (
    testCase
  ): testCase is (typeof operationCases)[number] & Required<Pick<OperationCase, 'numericField' | 'numericPath'>> =>
    'numericField' in testCase && 'numericPath' in testCase
);

function argsFor(testCase: OperationCase): OcfCreateArguments {
  return [testCase.entityType, testCase.data] as OcfCreateArguments;
}

function createOperationFor(testCase: OperationCase): OcfCreateOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfCreateOperation;
}

function editOperationFor(testCase: OperationCase): OcfEditOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfEditOperation;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to throw');
}

describe('conversion and exercise operation boundaries', () => {
  it.each(operationCases)(
    '$entityType preserves cardinality, duplicates, and empty Text through every writer path',
    (testCase) => {
      const args = argsFor(testCase);
      const operation = createOperationFor(testCase);
      const direct = convertToDaml(...args);
      const operationData = convertOperationToDaml(operation);
      const create = buildOcfCreateData(...args);
      const createFromOperation = buildOcfCreateDataFromOperation(operation);
      const edit = buildOcfEditData(...args);
      const editFromOperation = buildOcfEditDataFromOperation(editOperationFor(testCase));

      for (const data of [
        direct,
        operationData,
        create.value,
        createFromOperation.value,
        edit.value,
        editFromOperation.value,
      ]) {
        expect(data).toMatchObject({
          id: '',
          security_id: '',
          resulting_security_ids: ['', 'duplicate', 'duplicate'],
          comments: [''],
        });
      }
      expect(create.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].create);
      expect(createFromOperation.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].create);
      expect(edit.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].edit);
      expect(editFromOperation.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].edit);

      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-conversion-exercise',
        actAs: ['issuer::party'],
      });
      batch.create(...args).editOperation(editOperationFor(testCase));
      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected an ExerciseCommand');
      const choiceArgument = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: Record<string, unknown> }>;
        edits: Array<{ tag: string; value: Record<string, unknown> }>;
      };
      expect(choiceArgument.creates[0]).toMatchObject({
        tag: ENTITY_TAG_MAP[testCase.entityType].create,
        value: { resulting_security_ids: ['', 'duplicate', 'duplicate'], comments: [''] },
      });
      expect(choiceArgument.edits[0]).toMatchObject({
        tag: ENTITY_TAG_MAP[testCase.entityType].edit,
        value: { resulting_security_ids: ['', 'duplicate', 'duplicate'], comments: [''] },
      });
    }
  );

  it.each(operationCases)(
    '$entityType rejects an omitted required id while preserving an empty Text id',
    (testCase) => {
      const withoutId = { ...testCase.data } as Record<string, unknown>;
      delete withoutId.id;
      const malformed: OperationCase = {
        ...testCase,
        data: withoutId as unknown as OcfDataTypeFor<ConversionExerciseType>,
      };
      const expected = {
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: `${testCase.entityType}.id`,
      };

      expect(captureError(() => convertToDaml(...argsFor(malformed)))).toMatchObject(expected);
      expect(captureError(() => convertOperationToDaml(createOperationFor(malformed)))).toMatchObject(expected);
      expect(captureError(() => buildOcfCreateData(...argsFor(malformed)))).toMatchObject(expected);

      const batch = new CapTableBatch({
        capTableContractId: 'cap-table-conversion-exercise',
        actAs: ['issuer::party'],
      });
      expect(captureError(() => batch.create(...argsFor(malformed)))).toMatchObject(expected);
    }
  );

  it.each(operationCases)(
    '$entityType accepts an empty resulting_security_ids array in tuple and operation batches',
    (testCase) => {
      const data = { ...testCase.data, resulting_security_ids: [] } as OcfDataTypeFor<ConversionExerciseType>;
      const emptyCase: OperationCase = { ...testCase, data };
      const create = buildOcfCreateData(...argsFor(emptyCase));
      const edit = buildOcfEditDataFromOperation(editOperationFor(emptyCase));
      expect((create.value as { resulting_security_ids: string[] }).resulting_security_ids).toEqual([]);
      expect((edit.value as { resulting_security_ids: string[] }).resulting_security_ids).toEqual([]);
    }
  );

  it.each(numericOperationCases)(
    '$entityType reports exact fixed Numeric diagnostics through operation construction',
    (testCase) => {
      const data = { ...testCase.data, [testCase.numericField]: '1e3' } as OcfDataTypeFor<ConversionExerciseType>;
      const malformed: OperationCase = { ...testCase, data };
      const expected = {
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: testCase.numericPath,
      };
      expect(captureError(() => convertToDaml(...argsFor(malformed)))).toMatchObject(expected);
      expect(captureError(() => convertOperationToDaml(createOperationFor(malformed)))).toMatchObject(expected);
      expect(captureError(() => buildOcfCreateData(...argsFor(malformed)))).toMatchObject(expected);
      expect(captureError(() => buildOcfEditDataFromOperation(editOperationFor(malformed)))).toMatchObject(expected);
    }
  );

  it.each(operationCases)(
    '$entityType reports exact calendar-date diagnostics before batch construction',
    (testCase) => {
      const malformed: OperationCase = {
        ...testCase,
        data: { ...testCase.data, date: '2026-02-30' },
      };
      expect(captureError(() => buildOcfCreateData(...argsFor(malformed)))).toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.date`,
      });
    }
  );

  it('rejects the warrant ledger-only quantity field instead of silently dropping it', () => {
    const warrant = operationCases[3];
    const malformed: OperationCase = {
      ...warrant,
      data: { ...warrant.data, quantity: '1' } as OcfDataTypeFor<ConversionExerciseType>,
    };
    expect(captureError(() => buildOcfCreateData(...argsFor(malformed)))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'warrantExercise.quantity',
    });
  });

  it.each(operationCases)(
    '$entityType rejects proxied and accessor-backed payloads without invoking traps',
    (testCase) => {
      let trapCalls = 0;
      const failTrap = (): never => {
        trapCalls += 1;
        throw new Error('writer proxy trap must not run');
      };
      const proxy = new Proxy(testCase.data, {
        get: failTrap,
        getOwnPropertyDescriptor: failTrap,
        getPrototypeOf: failTrap,
        has: failTrap,
        ownKeys: failTrap,
      });
      const proxiedCase: OperationCase = {
        ...testCase,
        data: proxy,
      };

      const proxyError = captureError(() => buildOcfCreateData(...argsFor(proxiedCase)));
      expect(proxyError).toBeInstanceOf(OcpValidationError);
      expect(proxyError).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH, fieldPath: testCase.entityType });
      expect(trapCalls).toBe(0);

      let getterCalls = 0;
      const accessorData = { ...testCase.data } as Record<string, unknown>;
      Object.defineProperty(accessorData, 'id', {
        enumerable: true,
        configurable: true,
        get() {
          getterCalls += 1;
          throw new Error('writer getter must not run');
        },
      });
      const accessorCase: OperationCase = {
        ...testCase,
        data: accessorData as unknown as OcfDataTypeFor<ConversionExerciseType>,
      };
      const accessorError = captureError(() => buildOcfEditDataFromOperation(editOperationFor(accessorCase)));
      expect(accessorError).toBeInstanceOf(OcpValidationError);
      expect(accessorError).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
      expect(getterCalls).toBe(0);
    }
  );

  it('rejects proxied and accessor-backed operation envelopes without invoking traps or getters', () => {
    const testCase = operationCases[0];
    let trapCalls = 0;
    const failTrap = (): never => {
      trapCalls += 1;
      throw new Error('operation-envelope proxy trap must not run');
    };
    const operation = new Proxy(createOperationFor(testCase), {
      get: failTrap,
      getOwnPropertyDescriptor: failTrap,
      getPrototypeOf: failTrap,
      has: failTrap,
      ownKeys: failTrap,
    });

    expect(captureError(() => convertOperationToDaml(operation))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'operation',
    });
    expect(captureError(() => buildOcfCreateDataFromOperation(operation))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'batch.createOperation',
    });
    expect(trapCalls).toBe(0);

    let getterCalls = 0;
    const accessorOperation = { data: testCase.data } as Record<string, unknown>;
    Object.defineProperty(accessorOperation, 'type', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error('operation-envelope getter must not run');
      },
    });
    expect(
      captureError(() =>
        buildOcfEditDataFromOperation(accessorOperation as unknown as OcfEditOperation<'convertibleConversion'>)
      )
    ).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'batch.editOperation.type',
    });
    expect(getterCalls).toBe(0);
  });
});
