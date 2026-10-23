import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import {
  anchorCommand,
  assertJsonSafe,
  describeOperationAt,
  requireBoundedList,
  requireChoiceDate,
  requireDecimal,
  summarizeOperations,
  writeFailure,
} from '../../src/functions/OpenCapTable/capTable/anchorCommand';
import type { CapTableOperationMeta } from '../../src/types/register';

const METAS: CapTableOperationMeta[] = [
  { index: 0, kind: 'record', entityType: 'stakeholder', id: 'SH-1' },
  { index: 1, kind: 'vestingSnapshot', securityId: 'S-1' },
  { index: 2, kind: 'record', entityType: 'stakeholder', id: 'SH-2' },
];

describe('anchor command plumbing', () => {
  it('names the operation behind a value that is not JSON-safe', () => {
    const payload = { operations: [{ ok: 1 }, { value: { vested: undefined } }] };
    expect(() => assertJsonSafe(payload, describeOperationAt(METAS))).toThrow(
      'undefined value at "choiceArgument.operations[1].value.vested" (operation 1: vestingSnapshot S-1)'
    );
    expect(() => assertJsonSafe({ inputs: { states: [undefined] } }, describeOperationAt(METAS))).toThrow(
      'undefined value at "choiceArgument.inputs.states[0]". '
    );
    expect(() =>
      anchorCommand({ capTableContractId: 'anchor-1' }, 'CapTable_Apply', { inputs: undefined } as never, 'ta')
    ).toThrow('Converter produced non-JSON-safe payload');
  });

  it('summarizes a batch by kind', () => {
    expect(summarizeOperations(METAS)).toBe('[3 operations: record x2, vestingSnapshot x1]');
  });

  it('wraps a failure that is not a contract error as CHOICE_FAILED', () => {
    const failure = writeFailure('socket closed', 'CapTable_Restate', 'anchor-1', METAS.slice(0, 1));
    expect(failure).toBeInstanceOf(OcpContractError);
    expect(failure.code).toBe(OcpErrorCodes.CHOICE_FAILED);
    expect(failure.cause?.message).toBe('socket closed');
    expect(failure.message).toBe('CapTable_Restate [1 operation: record x1] failed: socket closed');
    expect(failure.operations).toEqual([METAS[0]]);
  });

  it('refuses arguments of the wrong type', () => {
    expect(() => requireDecimal(10, 'quantity')).toThrow('Expected a decimal string');
    expect(() => requireChoiceDate(20250602, 'date')).toThrow('Expected a Daml Date (YYYY-MM-DD)');
    expect(() =>
      requireBoundedList('lots' as unknown as string[], 'lots', { empty: 'none', tooMany: 'many' }, 50)
    ).toThrow('Expected an array');
    expect(() => anchorCommand({ capTableContractId: '' }, 'CapTable_Apply', {}, 'ta')).toThrow(
      "Validation error at 'capTableContractId'"
    );
  });
});
