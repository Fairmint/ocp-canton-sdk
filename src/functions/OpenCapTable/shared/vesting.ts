import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  dateStringToDAMLTime,
  isRecord,
  normalizeNumericString,
  toNonEmptyArray,
} from '../../../utils/typeConversions';

interface VestingInput {
  date: string;
  amount: string | number;
}

interface DamlVesting {
  date: string;
  amount: string;
}

/** Encode omission as DAML `[]`; validate a present OCF array as schema-non-empty and preserve every row. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | undefined,
  basePath: string
): DamlVesting[] {
  if (vestings === undefined) return [];
  return toNonEmptyArray(vestings, basePath, (vesting, { fieldPath: vestingPath }) => {
    if (!isRecord(vesting)) {
      throw new OcpValidationError(vestingPath, 'Vesting must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: vesting,
      });
    }

    const amountPath = `${vestingPath}.amount`;
    const date = dateStringToDAMLTime(vesting.date, `${vestingPath}.date`);
    const amountValue = vesting.amount;
    if (typeof amountValue !== 'string' && typeof amountValue !== 'number') {
      throw new OcpValidationError(amountPath, 'Vesting amount must be a decimal string or number', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: amountValue,
      });
    }
    const amount = normalizeNumericString(amountValue, amountPath);

    if (Number(amount) < 0) {
      throw new OcpValidationError(amountPath, 'Vesting amount must not be negative', {
        code: OcpErrorCodes.OUT_OF_RANGE,
        receivedValue: amountValue,
      });
    }

    return { date, amount };
  });
}
