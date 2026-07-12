import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime, isRecord, toNonEmptyArray } from '../../../utils/typeConversions';
import { requirePositiveOcfDecimal } from './ocfValues';

interface VestingInput {
  date: string;
  amount: string;
}

interface DamlVesting {
  date: string;
  amount: string;
}

/** Encode omission as DAML `[]`; otherwise preserve and validate every row at the exact OCF boundary. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | undefined,
  basePath: string
): DamlVesting[] {
  if (vestings === undefined) return [];
  return toNonEmptyArray(vestings, basePath, (vesting, { index }) => {
    const vestingPath = `${basePath}[${index}]`;
    if (!isRecord(vesting)) {
      throw new OcpValidationError(vestingPath, 'Vesting must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: vesting,
      });
    }

    const amountPath = `${vestingPath}.amount`;
    const date = dateStringToDAMLTime(vesting.date, `${vestingPath}.date`);
    const amount = requirePositiveOcfDecimal(vesting.amount, amountPath);
    return { date, amount };
  });
}
