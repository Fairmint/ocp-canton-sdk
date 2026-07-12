import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { filterAndMapVestingsToDaml } from '../../src/functions/OpenCapTable/shared/vesting';

const PATH = 'issuance.vestings';

function captureError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    return error as OcpValidationError;
  }
  throw new Error('Expected vesting validation to fail');
}

describe('shared vesting write boundary', () => {
  test('maps omission to DAML [] but rejects an explicitly present empty OCF array', () => {
    expect(filterAndMapVestingsToDaml(undefined, PATH)).toEqual([]);

    const error = captureError(() => filterAndMapVestingsToDaml([], PATH));
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: PATH,
      receivedValue: [],
    });
  });

  test('validates, canonicalizes, and preserves every schema-valid row', () => {
    expect(
      filterAndMapVestingsToDaml(
        [
          { date: '2026-01-01T23:30:00-05:00', amount: '0.0010' },
          { date: '2026-02-01', amount: '+0.500' },
          { date: '2026-03-01T00:30:00+14:00', amount: '10.5000' },
        ],
        PATH
      )
    ).toEqual([
      { date: '2026-01-01T00:00:00.000Z', amount: '0.001' },
      { date: '2026-02-01T00:00:00.000Z', amount: '0.5' },
      { date: '2026-03-01T00:00:00.000Z', amount: '10.5' },
    ]);
  });

  test.each(['0', '-0'])('rejects a malformed date on a preserved zero-amount row %s', (amount) => {
    const error = captureError(() => filterAndMapVestingsToDaml([{ date: 'not-a-date', amount }], PATH));

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${PATH}[0].date`,
      receivedValue: 'not-a-date',
    });
  });

  test.each(['0', '-0', '-1.2500'])('rejects a non-positive OCF vesting amount %s', (amount) => {
    const error = captureError(() => filterAndMapVestingsToDaml([{ date: '2026-01-01', amount }], PATH));

    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: `${PATH}[0].amount`,
      receivedValue: amount,
    });
  });

  test('reports malformed amounts at their original index', () => {
    const error = captureError(() =>
      filterAndMapVestingsToDaml(
        [
          { date: '2026-01-01', amount: '1' },
          { date: '2026-02-01', amount: '1e2' },
        ],
        PATH
      )
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${PATH}[1].amount`,
      receivedValue: '1e2',
    });
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-a-vesting'],
  ] as const)('rejects a %s vesting with an indexed structured error', (_case, invalidVesting) => {
    const error = captureError(() =>
      filterAndMapVestingsToDaml(
        [{ date: '2026-01-01', amount: '1' }, invalidVesting] as unknown as Parameters<
          typeof filterAndMapVestingsToDaml
        >[0],
        PATH
      )
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: `${PATH}[1]`,
      expectedType: 'object',
      receivedValue: invalidVesting,
    });
  });
});
