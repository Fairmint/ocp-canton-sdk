import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime, normalizeNumericString } from '../../../utils/typeConversions';

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
      const amountPath = `${basePath}.${index}.amount`;
      const date = dateStringToDAMLTime(vesting.date, `${basePath}.${index}.date`);
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
