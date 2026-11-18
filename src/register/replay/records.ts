/**
 * Reading a manifest's records for the offline replay: the fields the v35 rules read, each checked, and the refusal a
 * replay unit fails with.
 *
 * A manifest holds native OCF objects (`buildOcfManifest`, or a source database's records). The replay reads only the
 * fields the register's rules use; a field that is missing or malformed refuses the record (`malformed_record`)
 * rather than the whole replay, so one bad record is reported beside the others.
 */

import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { Monetary, Vesting } from '../../types/native';
import type { ReplayRule, SplitRatio } from '../../types/register';
import { tryIsoDateToDateString } from '../../utils/typeConversions';
import { canonicalDecimal } from '../numeric';

/** One manifest object, as the manifest holds it. */
export type ManifestRecord = Readonly<Record<string, unknown>>;

/** One record the replay reads: its canonical object and entity types, its object ID and its data. */
export interface ReplayRecord {
  /** The canonical OCF object type (plan-security aliases read as equity compensation) */
  objectType: string;
  entityType: OcfEntityType;
  id: string;
  data: ManifestRecord;
  /** Its position among the manifest's records, the last tiebreak of the replay order */
  position: number;
}

/** A replay unit's refusal: the rule it breaks and the ledger's message where the ledger has one. */
export class ReplayRefusal extends Error {
  readonly rule: ReplayRule;

  constructor(rule: ReplayRule, message: string) {
    super(message);
    this.name = 'ReplayRefusal';
    this.rule = rule;
  }
}

/** Refuses a replay unit. */
export function refuse(rule: ReplayRule, message: string): never {
  throw new ReplayRefusal(rule, message);
}

function malformed(record: ReplayRecord, field: string, expected: string): never {
  return refuse('malformed_record', `${record.objectType} ${record.id}: ${field} must be ${expected}`);
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/** A required text field (it may be empty: an empty ID is refused by its claim, as on the ledger). */
export function readText(record: ReplayRecord, field: string): string {
  const value = record.data[field];
  if (typeof value !== 'string') return malformed(record, field, 'a string');
  return value;
}

/** An optional text field: `null` when absent. */
export function readOptionalText(record: ReplayRecord, field: string): string | null {
  const value = record.data[field];
  if (!present(value)) return null;
  if (typeof value !== 'string') return malformed(record, field, 'a string when present');
  return value;
}

/** A list of texts: empty when absent. */
export function readTextList(record: ReplayRecord, field: string): string[] {
  const value = record.data[field];
  if (!present(value)) return [];
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    return malformed(record, field, 'a list of strings');
  }
  return [...value];
}

/** A decimal field, in canonical form. */
export function readDecimal(record: ReplayRecord, field: string): string {
  const value = record.data[field];
  if (typeof value !== 'string') return malformed(record, field, 'a decimal string');
  try {
    return canonicalDecimal(value, field);
  } catch {
    return malformed(record, field, 'a decimal string that fits a Daml Decimal');
  }
}

/** An optional decimal field: `null` when absent. */
export function readOptionalDecimal(record: ReplayRecord, field: string): string | null {
  return present(record.data[field]) ? readDecimal(record, field) : null;
}

/** A date: `YYYY-MM-DD`, or the day of an RFC 3339 date-time. */
export function dateOf(value: unknown): string | null {
  return tryIsoDateToDateString(value);
}

/** A required date field, as its day. */
export function readDate(record: ReplayRecord, field: string): string {
  const date = dateOf(record.data[field]);
  if (date === null) return malformed(record, field, 'a date (YYYY-MM-DD)');
  return date;
}

/** An optional date field: `null` when absent. */
export function readOptionalDate(record: ReplayRecord, field: string): string | null {
  return present(record.data[field]) ? readDate(record, field) : null;
}

/** A monetary field: `null` when absent. */
export function readOptionalMonetary(record: ReplayRecord, field: string): Monetary | null {
  const value = record.data[field];
  if (!present(value)) return null;
  if (typeof value !== 'object' || value === null) return malformed(record, field, 'a monetary amount');
  const { amount, currency } = value as Record<string, unknown>;
  if (typeof amount !== 'string' || typeof currency !== 'string') {
    return malformed(record, field, 'a monetary amount');
  }
  try {
    return { amount: canonicalDecimal(amount, `${field}.amount`), currency };
  } catch {
    return malformed(record, `${field}.amount`, 'a decimal string that fits a Daml Decimal');
  }
}

/** An issuance's explicit vesting tranches: empty when absent. */
export function readVestings(record: ReplayRecord): Vesting[] {
  const value = record.data['vestings'];
  if (!present(value)) return [];
  if (!Array.isArray(value)) return malformed(record, 'vestings', 'a list of tranches');
  return value.map((tranche: unknown, index): Vesting => {
    const fields = typeof tranche === 'object' && tranche !== null ? (tranche as Record<string, unknown>) : {};
    const date = dateOf(fields['date']);
    const { amount } = fields;
    if (date === null || typeof amount !== 'string') {
      return malformed(record, `vestings[${index}]`, 'a tranche with a date and an amount');
    }
    try {
      return { date, amount: canonicalDecimal(amount, `vestings[${index}].amount`) };
    } catch {
      return malformed(record, `vestings[${index}].amount`, 'a decimal string that fits a Daml Decimal');
    }
  });
}

/** A split's ratio: `split_ratio`, or the deprecated numerator and denominator pair. */
export function readSplitRatio(record: ReplayRecord): SplitRatio {
  const ratio = record.data['split_ratio'];
  const fields =
    typeof ratio === 'object' && ratio !== null
      ? (ratio as Record<string, unknown>)
      : { numerator: record.data['split_ratio_numerator'], denominator: record.data['split_ratio_denominator'] };
  const { numerator, denominator } = fields;
  if (typeof numerator !== 'string' || typeof denominator !== 'string') {
    return malformed(record, 'split_ratio', 'a ratio of two decimal strings');
  }
  try {
    return {
      numerator: canonicalDecimal(numerator, 'split_ratio.numerator'),
      denominator: canonicalDecimal(denominator, 'split_ratio.denominator'),
    };
  } catch {
    return malformed(record, 'split_ratio', 'a ratio of two decimal strings that fit a Daml Decimal');
  }
}
