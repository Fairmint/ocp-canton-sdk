import { dateStringToDAMLTime, normalizeNumericString } from '../../../utils/typeConversions';

interface VestingInput {
  date: string;
  amount: string | number;
}

interface DamlVesting {
  date: string;
  amount: string;
}

/** Filter zero-value vestings while retaining original indexes for validation paths. */
export function filterAndMapVestingsToDaml(
  vestings: readonly VestingInput[] | null | undefined,
  basePath: string
): DamlVesting[] {
  const filteredVestings = (vestings ?? [])
    .map((vesting, index) => ({ index, vesting }))
    .filter(({ vesting }) => {
      // Preserve the converter boundary: malformed amounts fail before filtering.
      const normalized = normalizeNumericString(vesting.amount);
      return parseFloat(normalized) > 0;
    });

  return filteredVestings.map(({ index, vesting }) => ({
    date: dateStringToDAMLTime(vesting.date, `${basePath}[${index}].date`),
    amount: normalizeNumericString(vesting.amount),
  }));
}
