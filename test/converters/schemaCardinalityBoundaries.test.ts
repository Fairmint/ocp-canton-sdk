import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertibleTransferDataToDaml } from '../../src/functions/OpenCapTable/convertibleTransfer/convertibleTransferDataToDaml';
import { damlConvertibleTransferToNative } from '../../src/functions/OpenCapTable/convertibleTransfer/damlToOcf';
import { damlEquityCompensationTransferToNative } from '../../src/functions/OpenCapTable/equityCompensationTransfer/damlToOcf';
import { equityCompensationTransferDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationTransfer/equityCompensationTransferDataToDaml';
import { damlStockConsolidationToNative } from '../../src/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import { stockConsolidationDataToDaml } from '../../src/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml';
import { stockTransferDataToDaml } from '../../src/functions/OpenCapTable/stockTransfer/createStockTransfer';
import { damlStockTransferToNative } from '../../src/functions/OpenCapTable/stockTransfer/damlToOcf';
import { damlWarrantTransferToNative } from '../../src/functions/OpenCapTable/warrantTransfer/damlToOcf';
import { warrantTransferDataToDaml } from '../../src/functions/OpenCapTable/warrantTransfer/warrantTransferDataToDaml';

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected schema cardinality validation to fail');
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected action to throw');
}

const QUANTITY_DAML = {
  balance_security_id: null,
  comments: [],
  consideration_text: null,
  date: '2026-01-01T00:00:00.000Z',
  id: 'transfer-1',
  quantity: '1',
  resulting_security_ids: ['result-1'],
  security_id: 'security-1',
};

const QUANTITY_OCF = {
  date: '2026-01-01',
  id: 'transfer-1',
  quantity: '1',
  resulting_security_ids: ['result-1'],
  security_id: 'security-1',
};

const CONVERTIBLE_DAML = {
  balance_security_id: QUANTITY_DAML.balance_security_id,
  comments: QUANTITY_DAML.comments,
  consideration_text: QUANTITY_DAML.consideration_text,
  date: QUANTITY_DAML.date,
  id: QUANTITY_DAML.id,
  resulting_security_ids: QUANTITY_DAML.resulting_security_ids,
  security_id: QUANTITY_DAML.security_id,
};

const transferCases = [
  {
    genericRead: (resultingSecurityIds: unknown) =>
      convertToOcf('stockTransfer', { ...QUANTITY_DAML, resulting_security_ids: resultingSecurityIds } as never),
    label: 'stock transfer',
    path: 'stockTransfer.resulting_security_ids',
    read: (resultingSecurityIds: unknown) =>
      damlStockTransferToNative({ ...QUANTITY_DAML, resulting_security_ids: resultingSecurityIds } as never),
    write: (resultingSecurityIds: unknown) =>
      stockTransferDataToDaml({
        ...QUANTITY_OCF,
        object_type: 'TX_STOCK_TRANSFER',
        resulting_security_ids: resultingSecurityIds,
      } as never),
  },
  {
    genericRead: (resultingSecurityIds: unknown) =>
      convertToOcf('warrantTransfer', { ...QUANTITY_DAML, resulting_security_ids: resultingSecurityIds } as never),
    label: 'warrant transfer',
    path: 'warrantTransfer.resulting_security_ids',
    read: (resultingSecurityIds: unknown) =>
      damlWarrantTransferToNative({ ...QUANTITY_DAML, resulting_security_ids: resultingSecurityIds } as never),
    write: (resultingSecurityIds: unknown) =>
      warrantTransferDataToDaml({
        ...QUANTITY_OCF,
        object_type: 'TX_WARRANT_TRANSFER',
        resulting_security_ids: resultingSecurityIds,
      } as never),
  },
  {
    genericRead: (resultingSecurityIds: unknown) =>
      convertToOcf('equityCompensationTransfer', {
        ...QUANTITY_DAML,
        resulting_security_ids: resultingSecurityIds,
      } as never),
    label: 'equity compensation transfer',
    path: 'equityCompensationTransfer.resulting_security_ids',
    read: (resultingSecurityIds: unknown) =>
      damlEquityCompensationTransferToNative({
        ...QUANTITY_DAML,
        resulting_security_ids: resultingSecurityIds,
      } as never),
    write: (resultingSecurityIds: unknown) =>
      equityCompensationTransferDataToDaml({
        ...QUANTITY_OCF,
        object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
        resulting_security_ids: resultingSecurityIds,
      } as never),
  },
  {
    genericRead: (resultingSecurityIds: unknown) =>
      convertToOcf('convertibleTransfer', {
        ...CONVERTIBLE_DAML,
        amount: { amount: '1', currency: 'USD' },
        resulting_security_ids: resultingSecurityIds,
      } as never),
    label: 'convertible transfer',
    path: 'convertibleTransfer.resulting_security_ids',
    read: (resultingSecurityIds: unknown) =>
      damlConvertibleTransferToNative({
        ...CONVERTIBLE_DAML,
        amount: { amount: '1', currency: 'USD' },
        resulting_security_ids: resultingSecurityIds,
      } as never),
    write: (resultingSecurityIds: unknown) =>
      convertibleTransferDataToDaml({
        date: QUANTITY_OCF.date,
        id: QUANTITY_OCF.id,
        object_type: 'TX_CONVERTIBLE_TRANSFER',
        amount: { amount: '1', currency: 'USD' },
        resulting_security_ids: resultingSecurityIds,
        security_id: QUANTITY_OCF.security_id,
      } as never),
  },
] as const;

describe('schema-cardinality transfer boundaries', () => {
  it.each(transferCases)(
    '$label readers reject duplicate uniqueItems at the duplicate index',
    ({ genericRead, path, read }) => {
      for (const invoke of [read, genericRead]) {
        const error = captureValidationError(() => invoke(['duplicate', 'duplicate']));
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: `${path}.1`,
          receivedValue: 'duplicate',
        });
        expect(error.context).toMatchObject({ duplicateIndex: 1, duplicateOfIndex: 0 });
      }
    }
  );

  it.each(transferCases)('$label writers reject duplicate uniqueItems at the duplicate index', ({ path, write }) => {
    const error = captureValidationError(() => write(['duplicate', 'duplicate']));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${path}.1`,
      receivedValue: 'duplicate',
    });
  });

  it.each(transferCases)('$label boundaries reject wrong element types at the exact index', ({ path, read, write }) => {
    expect(() => read(['valid', 42])).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_data',
        context: expect.objectContaining({ decoderPath: 'input.resulting_security_ids[1]' }),
      })
    );

    const writerError = captureValidationError(() => write(['valid', 42]));
    expect(writerError).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      fieldPath: `${path}.1`,
      receivedValue: 42,
    });
  });

  it.each(transferCases)('$label boundaries reject empty required arrays as out of range', ({ path, read, write }) => {
    for (const invoke of [read, write]) {
      const error = captureValidationError(() => invoke([]));
      expect(error).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: path,
        receivedValue: [],
      });
    }
  });
});

const CONSOLIDATION_DAML = {
  comments: [],
  date: '2026-01-01T00:00:00.000Z',
  id: 'consolidation-1',
  reason_text: null,
  resulting_security_id: 'result-1',
  security_ids: ['security-1'],
};

const CONSOLIDATION_OCF = {
  date: '2026-01-01',
  id: 'consolidation-1',
  object_type: 'TX_STOCK_CONSOLIDATION' as const,
  resulting_security_id: 'result-1',
  security_ids: ['security-1'],
};

describe('schema-cardinality stock consolidation boundaries', () => {
  it.each([
    {
      invoke: (securityIds: unknown) =>
        damlStockConsolidationToNative({ ...CONSOLIDATION_DAML, security_ids: securityIds } as never),
      label: 'direct reader',
      reader: true,
    },
    {
      invoke: (securityIds: unknown) =>
        convertToOcf('stockConsolidation', { ...CONSOLIDATION_DAML, security_ids: securityIds } as never),
      label: 'generic reader',
      reader: true,
    },
    {
      invoke: (securityIds: unknown) =>
        stockConsolidationDataToDaml({ ...CONSOLIDATION_OCF, security_ids: securityIds } as never),
      label: 'writer',
      reader: false,
    },
  ])('$label rejects empty, duplicate, and wrong-type security_ids', ({ invoke, reader }) => {
    expect(captureValidationError(() => invoke([]))).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'stockConsolidation.security_ids',
    });
    expect(captureValidationError(() => invoke(['duplicate', 'duplicate']))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'stockConsolidation.security_ids.1',
      receivedValue: 'duplicate',
    });
    const wrongTypeError = captureError(() => invoke(['valid', 42]));
    if (reader) {
      expect(wrongTypeError).toBeInstanceOf(OcpParseError);
      const parseError = wrongTypeError as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(JSON.stringify(parseError.context)).toContain('security_ids');
    } else {
      expect(wrongTypeError).toBeInstanceOf(OcpValidationError);
      const validationError = wrongTypeError as OcpValidationError;
      expect(validationError.code).toBe(OcpErrorCodes.INVALID_TYPE);
      expect(validationError.fieldPath).toBe('stockConsolidation.security_ids.1');
      expect(validationError.receivedValue).toBe(42);
    }
  });

  it('reader requires canonical singular resulting_security_id and rejects legacy plural data', () => {
    const { resulting_security_id: _resultingSecurityId, ...withoutSingular } = CONSOLIDATION_DAML;
    expect(() => damlStockConsolidationToNative(withoutSingular as never)).toThrow(OcpParseError);
    try {
      damlStockConsolidationToNative(withoutSingular as never);
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(JSON.stringify(parseError.context)).toContain('resulting_security_id');
    }

    expect(() =>
      damlStockConsolidationToNative({
        ...CONSOLIDATION_DAML,
        resulting_security_ids: ['legacy-result'],
      } as never)
    ).toThrow(OcpParseError);
    try {
      damlStockConsolidationToNative({
        ...CONSOLIDATION_DAML,
        resulting_security_ids: ['legacy-result'],
      } as never);
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(JSON.stringify(parseError.context)).toContain('resulting_security_ids');
    }
  });

  it('writer requires canonical singular resulting_security_id and rejects legacy plural data', () => {
    const { resulting_security_id: _resultingSecurityId, ...withoutSingular } = CONSOLIDATION_OCF;
    expect(captureValidationError(() => stockConsolidationDataToDaml(withoutSingular as never))).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'stockConsolidation.resulting_security_id',
    });

    expect(
      captureValidationError(() =>
        stockConsolidationDataToDaml({
          ...CONSOLIDATION_OCF,
          resulting_security_ids: ['legacy-result'],
        } as never)
      )
    ).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'stockConsolidation.resulting_security_ids',
    });
  });
});
