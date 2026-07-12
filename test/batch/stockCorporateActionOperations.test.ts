import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable/CapTableBatch';
import {
  ENTITY_TAG_MAP,
  type OcfCreateArguments,
  type OcfCreateOperation,
  type OcfDataTypeFor,
  type OcfEditOperation,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';

type CorporateActionType = Extract<
  OcfEntityType,
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockReissuance'
  | 'stockRepurchase'
>;

interface CorporateActionCase {
  readonly entityType: CorporateActionType;
  readonly data: OcfDataTypeFor<CorporateActionType>;
  readonly expected: Readonly<Record<string, unknown>>;
}

const corporateActionCases = [
  {
    entityType: 'stockClassConversionRatioAdjustment',
    data: {
      object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      id: '',
      date: '2026-07-10',
      stock_class_id: '',
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '+0001.2500000000', currency: 'USD' },
        ratio: { numerator: '+0002.0000000000', denominator: '+0001.0000000000' },
        rounding_type: 'FLOOR',
      },
      comments: [''],
    },
    expected: {
      id: '',
      stock_class_id: '',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1.25', currency: 'USD' },
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'OcfRoundingFloor',
      },
      comments: [''],
    },
  },
  {
    entityType: 'stockClassSplit',
    data: {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: '',
      date: '2026-07-10',
      stock_class_id: '',
      split_ratio: { numerator: '+0004.0000000000', denominator: '1.0000000000' },
      comments: [''],
    },
    expected: {
      id: '',
      stock_class_id: '',
      split_ratio: { numerator: '4', denominator: '1' },
      comments: [''],
    },
  },
  {
    entityType: 'stockConsolidation',
    data: {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: '',
      date: '2026-07-10',
      security_ids: [''],
      resulting_security_id: '',
      reason_text: '',
      comments: [''],
    },
    expected: {
      id: '',
      security_ids: [''],
      resulting_security_id: '',
      reason_text: '',
      comments: [''],
    },
  },
  {
    entityType: 'stockReissuance',
    data: {
      object_type: 'TX_STOCK_REISSUANCE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      reason_text: '',
      split_transaction_id: '',
      comments: [''],
    },
    expected: {
      id: '',
      security_id: '',
      resulting_security_ids: ['', 'duplicate', 'duplicate'],
      reason_text: '',
      split_transaction_id: '',
      comments: [''],
    },
  },
  {
    entityType: 'stockRepurchase',
    data: {
      object_type: 'TX_STOCK_REPURCHASE',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity: '-0',
      price: { amount: '+0001.2500000000', currency: 'USD' },
      balance_security_id: '',
      consideration_text: '',
      comments: [''],
    },
    expected: {
      id: '',
      security_id: '',
      quantity: '0',
      price: { amount: '1.25', currency: 'USD' },
      balance_security_id: '',
      consideration_text: '',
      comments: [''],
    },
  },
] as const satisfies readonly CorporateActionCase[];

function argsFor(testCase: CorporateActionCase): OcfCreateArguments {
  return [testCase.entityType, testCase.data] as OcfCreateArguments;
}

function createOperationFor(testCase: CorporateActionCase): OcfCreateOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfCreateOperation;
}

function editOperationFor(testCase: CorporateActionCase): OcfEditOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfEditOperation;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected action to throw');
}

describe('stock corporate-action operation boundaries', () => {
  it.each(corporateActionCases)(
    '$entityType preserves exact Text, Numeric, and cardinality semantics through every writer path',
    (testCase) => {
      const args = argsFor(testCase);
      const createOperation = createOperationFor(testCase);
      const editOperation = editOperationFor(testCase);
      const create = buildOcfCreateData(...args);
      const createFromOperation = buildOcfCreateDataFromOperation(createOperation);
      const edit = buildOcfEditData(...args);
      const editFromOperation = buildOcfEditDataFromOperation(editOperation);

      for (const data of [
        convertToDaml(...args),
        convertOperationToDaml(createOperation),
        create.value,
        createFromOperation.value,
        edit.value,
        editFromOperation.value,
      ]) {
        expect(data).toMatchObject(testCase.expected);
      }

      expect(create.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].create);
      expect(createFromOperation.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].create);
      expect(edit.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].edit);
      expect(editFromOperation.tag).toBe(ENTITY_TAG_MAP[testCase.entityType].edit);

      const batch = new CapTableBatch({ capTableContractId: 'cap-table-corporate-actions', actAs: ['issuer::party'] });
      batch.create(...args).editOperation(editOperation);
      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected an ExerciseCommand');
      const choiceArgument = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: Record<string, unknown> }>;
        edits: Array<{ tag: string; value: Record<string, unknown> }>;
      };
      expect(choiceArgument.creates[0]).toMatchObject({
        tag: ENTITY_TAG_MAP[testCase.entityType].create,
        value: testCase.expected,
      });
      expect(choiceArgument.edits[0]).toMatchObject({
        tag: ENTITY_TAG_MAP[testCase.entityType].edit,
        value: testCase.expected,
      });
    }
  );

  it('enforces consolidation minItems and uniqueItems through tuple and operation writers', () => {
    const base = corporateActionCases[2];
    for (const securityIds of [[], ['duplicate', 'duplicate']] as const) {
      const testCase: CorporateActionCase = {
        ...base,
        data: { ...base.data, security_ids: [...securityIds] } as unknown as OcfDataTypeFor<CorporateActionType>,
      };
      for (const action of [
        () => convertToDaml(...argsFor(testCase)),
        () => convertOperationToDaml(createOperationFor(testCase)),
        () => buildOcfCreateData(...argsFor(testCase)),
        () => buildOcfEditDataFromOperation(editOperationFor(testCase)),
      ]) {
        const error = captureError(action);
        expect(error).toBeInstanceOf(OcpValidationError);
        const validationError = error as OcpValidationError;
        expect(validationError.fieldPath).toBe(
          securityIds.length === 0 ? 'stockConsolidation.security_ids' : 'stockConsolidation.security_ids.1'
        );
        expect(validationError.code).toBe(
          securityIds.length === 0 ? OcpErrorCodes.OUT_OF_RANGE : OcpErrorCodes.INVALID_FORMAT
        );
      }
    }
  });

  it('preserves an empty reissuance result list without imposing consolidation cardinality', () => {
    const base = corporateActionCases[3];
    const testCase: CorporateActionCase = {
      ...base,
      data: { ...base.data, resulting_security_ids: [] },
    };
    expect(convertToDaml(...argsFor(testCase))).toMatchObject({ resulting_security_ids: [] });
    expect(buildOcfCreateDataFromOperation(createOperationFor(testCase)).value).toMatchObject({
      resulting_security_ids: [],
    });
  });

  it.each(corporateActionCases)(
    '$entityType rejects proxied and accessor-backed writer payloads without traps',
    (testCase) => {
      let trapCalls = 0;
      const failTrap = (): never => {
        trapCalls += 1;
        throw new Error('writer proxy trap must not run');
      };
      const proxiedCase: CorporateActionCase = {
        ...testCase,
        data: new Proxy(testCase.data, {
          get: failTrap,
          getOwnPropertyDescriptor: failTrap,
          getPrototypeOf: failTrap,
          has: failTrap,
          ownKeys: failTrap,
        }),
      };
      const proxyError = captureError(() => buildOcfCreateData(...argsFor(proxiedCase)));
      expect(proxyError).toBeInstanceOf(OcpValidationError);
      expect((proxyError as OcpValidationError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(trapCalls).toBe(0);

      let getterCalls = 0;
      const accessorData = { ...testCase.data } as Record<string, unknown>;
      Object.defineProperty(accessorData, 'id', {
        configurable: true,
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error('writer getter must not run');
        },
      });
      const accessorCase: CorporateActionCase = {
        ...testCase,
        data: accessorData as unknown as OcfDataTypeFor<CorporateActionType>,
      };
      const accessorError = captureError(() => buildOcfEditDataFromOperation(editOperationFor(accessorCase)));
      expect(accessorError).toBeInstanceOf(OcpValidationError);
      expect((accessorError as OcpValidationError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(getterCalls).toBe(0);
    }
  );
});
