import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime, isRecord } from '../../../utils/typeConversions';
import { requirePositiveOcfDecimal } from './ocfValues';

interface VestingInput {
  date: string;
  amount: string;
}

interface DamlVesting {
  date: string;
  amount: string;
}

/** Validate every vesting row against the exact generated DAML Numeric(10) boundary. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | null | undefined,
  basePath: string
): DamlVesting[] {
  return (vestings ?? []).map((vesting, index) => {
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
