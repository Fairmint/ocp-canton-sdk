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

function isNegativeDecimal(amount: string): boolean {
  if (!amount.startsWith('-')) return false;
  const digitsOnly = amount.slice(1).replace('.', '');
  return /[1-9]/.test(digitsOnly);
}

function isZeroDecimal(amount: string): boolean {
  const digitsOnly = (amount.startsWith('-') || amount.startsWith('+') ? amount.slice(1) : amount).replace('.', '');
  return !/[1-9]/.test(digitsOnly);
}

/** Validate every vesting row, then filter zero-value placeholders while retaining original indexes. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | null | undefined,
  basePath: string
): DamlVesting[] {
  return (vestings ?? [])
    .map((vesting, index) => {
      const vestingPath = `${basePath}[${index}]`;
      if (!isRecord(vesting)) {
        throw new OcpValidationError(vestingPath, 'Vesting must be an object', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'object',
          receivedValue: vesting,
        });
      }

      const amountPath = `${basePath}[${index}].amount`;
      const date = dateStringToDAMLTime(vesting.date, `${vestingPath}.date`);
      const amount = normalizeNumericString(vesting.amount, amountPath);

      if (isNegativeDecimal(amount)) {
        throw new OcpValidationError(amountPath, 'Vesting amount must not be negative', {
          code: OcpErrorCodes.OUT_OF_RANGE,
          receivedValue: vesting.amount,
        });
      }

      return { date, amount };
    })
    .filter(({ amount }) => !isZeroDecimal(amount));
}
