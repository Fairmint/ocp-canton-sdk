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
  test('validates and canonicalizes every row before filtering exact zero placeholders', () => {
    expect(
      filterAndMapVestingsToDaml(
        [
          { date: '2026-01-01T23:30:00-05:00', amount: '0.000' },
          { date: '2026-02-01', amount: '-0' },
          { date: '2026-03-01T00:30:00+14:00', amount: '10.5000' },
        ],
        PATH
      )
    ).toEqual([{ date: '2026-03-01T00:00:00.000Z', amount: '10.5' }]);
  });

  test.each(['0', '-0'])('rejects a malformed date before filtering placeholder amount %s', (amount) => {
    const error = captureError(() => filterAndMapVestingsToDaml([{ date: 'not-a-date', amount }], PATH));

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${PATH}[0].date`,
      receivedValue: 'not-a-date',
    });
  });

  test('rejects a negative amount instead of silently dropping it', () => {
    const error = captureError(() =>
      filterAndMapVestingsToDaml(
        [
          { date: '2026-01-01', amount: '0' },
          { date: '2026-02-01', amount: '-1.2500' },
        ],
        PATH
      )
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: `${PATH}[1].amount`,
      receivedValue: '-1.2500',
    });
  });

  test('reports malformed amounts at their original index', () => {
    const error = captureError(() =>
      filterAndMapVestingsToDaml(
        [
          { date: '2026-01-01', amount: '0' },
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
});
