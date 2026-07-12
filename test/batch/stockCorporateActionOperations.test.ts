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
      id: 'ratio-adjustment-1',
      date: '2026-07-10',
      stock_class_id: 'preferred-1',
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '1.2500000000', currency: 'USD' },
        ratio: { numerator: '2.0000000000', denominator: '1.0000000000' },
        rounding_type: 'FLOOR',
      },
      comments: ['repriced'],
    },
    expected: {
      id: 'ratio-adjustment-1',
      stock_class_id: 'preferred-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1.25', currency: 'USD' },
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'OcfRoundingFloor',
      },
      comments: ['repriced'],
    },
  },
  {
    entityType: 'stockClassSplit',
    data: {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: 'split-1',
      date: '2026-07-10',
      stock_class_id: 'common-1',
      split_ratio: { numerator: '4.0000000000', denominator: '1.0000000000' },
      comments: ['split'],
    },
    expected: {
      id: 'split-1',
      stock_class_id: 'common-1',
      split_ratio: { numerator: '4', denominator: '1' },
      comments: ['split'],
    },
  },
  {
    entityType: 'stockConsolidation',
    data: {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'consolidation-1',
      date: '2026-07-10',
      security_ids: ['security-old-1'],
      resulting_security_id: 'security-new-1',
      reason_text: 'cleanup',
      comments: ['consolidated'],
    },
    expected: {
      id: 'consolidation-1',
      security_ids: ['security-old-1'],
      resulting_security_id: 'security-new-1',
      reason_text: 'cleanup',
      comments: ['consolidated'],
    },
  },
  {
    entityType: 'stockReissuance',
    data: {
      object_type: 'TX_STOCK_REISSUANCE',
      id: 'reissuance-1',
      date: '2026-07-10',
      security_id: 'security-old-1',
      resulting_security_ids: ['security-new-1', 'security-new-2'],
      reason_text: 'replacement',
      split_transaction_id: 'split-1',
      comments: ['reissued'],
    },
    expected: {
      id: 'reissuance-1',
      security_id: 'security-old-1',
      resulting_security_ids: ['security-new-1', 'security-new-2'],
      reason_text: 'replacement',
      split_transaction_id: 'split-1',
      comments: ['reissued'],
    },
  },
  {
    entityType: 'stockRepurchase',
    data: {
      object_type: 'TX_STOCK_REPURCHASE',
      id: 'repurchase-1',
      date: '2026-07-10',
      security_id: 'security-1',
      quantity: '12.5000000000',
      price: { amount: '1.2500000000', currency: 'USD' },
      balance_security_id: 'security-balance-1',
      consideration_text: 'cash',
      comments: ['repurchased'],
    },
    expected: {
      id: 'repurchase-1',
      security_id: 'security-1',
      quantity: '12.5',
      price: { amount: '1.25', currency: 'USD' },
      balance_security_id: 'security-balance-1',
      consideration_text: 'cash',
      comments: ['repurchased'],
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
          securityIds.length === 0 ? 'stockConsolidation.security_ids' : 'stockConsolidation.security_ids[1]'
        );
        expect(validationError.code).toBe(
          securityIds.length === 0 ? OcpErrorCodes.OUT_OF_RANGE : OcpErrorCodes.INVALID_FORMAT
        );
      }
    }
  });

  it('rejects an empty reissuance result list across tuple and operation writers', () => {
    const base = corporateActionCases[3];
    const testCase: CorporateActionCase = {
      ...base,
      data: { ...base.data, resulting_security_ids: [] } as unknown as OcfDataTypeFor<CorporateActionType>,
    };
    for (const action of [
      () => convertToDaml(...argsFor(testCase)),
      () => convertOperationToDaml(createOperationFor(testCase)),
      () => buildOcfCreateData(...argsFor(testCase)),
      () => buildOcfEditDataFromOperation(editOperationFor(testCase)),
    ]) {
      const error = captureError(action) as OcpValidationError;
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error.code).toBe(OcpErrorCodes.OUT_OF_RANGE);
      expect(error.fieldPath).toBe('stockReissuance.resulting_security_ids');
    }
  });

  it('rejects non-positive writer Numeric values at their exact paths', () => {
    const cases = [
      { base: corporateActionCases[0], fieldPath: 'new_ratio_conversion_mechanism.ratio.numerator' },
      { base: corporateActionCases[1], fieldPath: 'split_ratio.numerator' },
      { base: corporateActionCases[4], fieldPath: 'quantity' },
    ] as const;

    for (const { base, fieldPath } of cases) {
      const parts = fieldPath.split('.');
      const data = JSON.parse(JSON.stringify(base.data)) as Record<string, unknown>;
      let target = data;
      for (const key of parts.slice(0, -1)) target = target[key] as Record<string, unknown>;
      const field = parts[parts.length - 1];
      if (field === undefined) throw new Error('Expected a Numeric field');
      target[field] = '0';
      const testCase = { ...base, data: data as unknown as OcfDataTypeFor<CorporateActionType> };

      const error = captureError(() => convertToDaml(...argsFor(testCase))) as OcpValidationError;
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error.code).toBe(OcpErrorCodes.OUT_OF_RANGE);
      expect(error.fieldPath).toBe(`${base.entityType}.${fieldPath}`);
    }
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
