import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime, isRecord, normalizeNumericString } from '../../../utils/typeConversions';

interface VestingInput {
  date: string;
  amount: string | number;
}

interface DamlVesting {
  date: string;
  amount: string;
}

/** Validate every vesting row, then filter zero-value placeholders while retaining original indexes. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | null | undefined,
  basePath: string
): DamlVesting[] {
  return (vestings ?? [])
    .map((vesting, index) => {
      const vestingPath = `${basePath}.${index}`;
      if (!isRecord(vesting)) {
        throw new OcpValidationError(vestingPath, 'Vesting must be an object', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'object',
          receivedValue: vesting,
        });
      }

      const amountPath = `${vestingPath}.amount`;
      const date = dateStringToDAMLTime(vesting.date, `${vestingPath}.date`);
      const amount = normalizeNumericString(vesting.amount, amountPath);

      if (Number(amount) < 0) {
        throw new OcpValidationError(amountPath, 'Vesting amount must not be negative', {
          code: OcpErrorCodes.OUT_OF_RANGE,
          receivedValue: vesting.amount,
        });
      }

      return { date, amount };
    })
    .filter(({ amount }) => Number(amount) !== 0);
}
