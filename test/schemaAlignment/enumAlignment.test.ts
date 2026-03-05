import fs from 'fs';
import path from 'path';

const ENUM_SCHEMA_DIR = path.join(__dirname, '../../libs/Open-Cap-Format-OCF/schema/enums');

/** OCF enum name → SDK type values. For enums where SDK normalizes OCF values (e.g. space→underscore), the mapping uses SDK form. */
const ENUM_MAPPINGS: Record<
  string,
  { sdkValues: string[]; ocfToSdkNormalize?: (ocfValue: string) => string; notes?: string }
> = {
  RoundingType: { sdkValues: ['CEILING', 'FLOOR', 'NORMAL'] },
  ConvertibleType: { sdkValues: ['NOTE', 'SAFE', 'CONVERTIBLE_SECURITY'] },
  StakeholderRelationshipType: {
    sdkValues: [
      'ADVISOR',
      'BOARD_MEMBER',
      'CONSULTANT',
      'EMPLOYEE',
      'EX_ADVISOR',
      'EX_CONSULTANT',
      'EX_EMPLOYEE',
      'EXECUTIVE',
      'FOUNDER',
      'INVESTOR',
      'NON_US_EMPLOYEE',
      'OFFICER',
      'OTHER',
    ],
  },
  ConversionTriggerType: {
    sdkValues: [
      'AUTOMATIC_ON_CONDITION',
      'AUTOMATIC_ON_DATE',
      'ELECTIVE_IN_RANGE',
      'ELECTIVE_ON_CONDITION',
      'ELECTIVE_AT_WILL',
      'UNSPECIFIED',
    ],
  },
  AllocationType: {
    sdkValues: [
      'CUMULATIVE_ROUNDING',
      'CUMULATIVE_ROUND_DOWN',
      'FRONT_LOADED',
      'BACK_LOADED',
      'FRONT_LOADED_TO_SINGLE_TRANCHE',
      'BACK_LOADED_TO_SINGLE_TRANCHE',
      'FRACTIONAL',
    ],
  },
  AuthorizedShares: {
    sdkValues: ['NOT_APPLICABLE', 'UNLIMITED'],
    ocfToSdkNormalize: (v) => (v === 'NOT APPLICABLE' ? 'NOT_APPLICABLE' : v),
    notes: 'OCF uses space (NOT APPLICABLE), SDK normalizes to underscore',
  },
  EmailType: { sdkValues: ['PERSONAL', 'BUSINESS', 'OTHER'] },
  AddressType: { sdkValues: ['LEGAL', 'CONTACT', 'OTHER'] },
  PhoneType: { sdkValues: ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'] },
  StockClassType: { sdkValues: ['COMMON', 'PREFERRED'] },
  StakeholderType: { sdkValues: ['INDIVIDUAL', 'INSTITUTION'] },
  StakeholderStatusType: {
    sdkValues: [
      'ACTIVE',
      'LEAVE_OF_ABSENCE',
      'TERMINATION_VOLUNTARY_OTHER',
      'TERMINATION_VOLUNTARY_GOOD_CAUSE',
      'TERMINATION_VOLUNTARY_RETIREMENT',
      'TERMINATION_INVOLUNTARY_OTHER',
      'TERMINATION_INVOLUNTARY_DEATH',
      'TERMINATION_INVOLUNTARY_DISABILITY',
      'TERMINATION_INVOLUNTARY_WITH_CAUSE',
    ],
  },
  CompensationType: {
    sdkValues: ['OPTION_NSO', 'OPTION_ISO', 'OPTION', 'RSU', 'CSAR', 'SSAR'],
  },
  PeriodType: { sdkValues: ['DAYS', 'MONTHS', 'YEARS'] },
  TerminationWindowType: {
    sdkValues: [
      'VOLUNTARY_OTHER',
      'VOLUNTARY_GOOD_CAUSE',
      'VOLUNTARY_RETIREMENT',
      'INVOLUNTARY_OTHER',
      'INVOLUNTARY_DEATH',
      'INVOLUNTARY_DISABILITY',
      'INVOLUNTARY_WITH_CAUSE',
    ],
  },
  StockPlanCancellationBehaviorType: {
    sdkValues: ['RETIRE', 'RETURN_TO_POOL', 'HOLD_AS_CAPITAL_STOCK', 'DEFINED_PER_PLAN_SECURITY'],
  },
  ValuationType: { sdkValues: ['409A'] },
  StockIssuanceType: { sdkValues: ['RSA', 'FOUNDERS_STOCK'] },
  VestingDayOfMonth: {
    sdkValues: [
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
      '26',
      '27',
      '28',
      '29_OR_LAST_DAY_OF_MONTH',
      '30_OR_LAST_DAY_OF_MONTH',
      '31_OR_LAST_DAY_OF_MONTH',
      'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
    ],
  },
  VestingTriggerType: {
    sdkValues: ['VESTING_START_DATE', 'VESTING_SCHEDULE_ABSOLUTE', 'VESTING_SCHEDULE_RELATIVE', 'VESTING_EVENT'],
  },
  QuantitySourceType: {
    sdkValues: [
      'HUMAN_ESTIMATED',
      'MACHINE_ESTIMATED',
      'UNSPECIFIED',
      'INSTRUMENT_FIXED',
      'INSTRUMENT_MAX',
      'INSTRUMENT_MIN',
    ],
  },
  OptionType: { sdkValues: ['NSO', 'ISO', 'INTL'] },
  ConversionMechanismType: {
    sdkValues: [
      'FIXED_AMOUNT_CONVERSION',
      'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
      'RATIO_CONVERSION',
      'SAFE_CONVERSION',
      'VALUATION_BASED_CONVERSION',
      'CONVERTIBLE_NOTE_CONVERSION',
      'CUSTOM_CONVERSION',
      'PPS_BASED_CONVERSION',
    ],
  },
  ConversionRightType: {
    sdkValues: ['CONVERTIBLE_CONVERSION_RIGHT', 'WARRANT_CONVERSION_RIGHT', 'STOCK_CLASS_CONVERSION_RIGHT'],
  },
  ConversionTimingType: { sdkValues: ['PRE_MONEY', 'POST_MONEY'] },
  AccrualPeriodType: {
    sdkValues: ['DAILY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'],
  },
  CompoundingType: { sdkValues: ['COMPOUNDING', 'SIMPLE'] },
  DayCountType: { sdkValues: ['ACTUAL_365', '30_360'] },
  InterestPayoutType: { sdkValues: ['DEFERRED', 'CASH'] },
  ValuationBasedFormulaType: { sdkValues: ['FIXED', 'ACTUAL', 'CAP'] },
  ParentSecurityType: {
    sdkValues: ['STOCK_PLAN', 'STOCK', 'WARRANT', 'CONVERTIBLE'],
  },
};

/** Enums used internally; covered by OcfObjectReference.object_type or file loading. Skip SDK type coverage. */
const SKIP_ENUMS = new Set(['FileType', 'ObjectType']);

function getEnumSchemaFiles(): string[] {
  if (!fs.existsSync(ENUM_SCHEMA_DIR)) {
    return [];
  }
  return fs
    .readdirSync(ENUM_SCHEMA_DIR)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
}

function getOcfEnumValues(schemaPath: string): string[] {
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(raw) as { enum?: string[] };
  const values = schema.enum;
  if (!Array.isArray(values)) {
    return [];
  }
  return values;
}

describe('OCF Enum Schema Alignment', () => {
  it('every non-skipped OCF enum schema has a mapping', () => {
    const schemaFiles = getEnumSchemaFiles();
    const unmapped: string[] = [];
    for (const file of schemaFiles) {
      const enumName = file.replace(/\.schema\.json$/, '');
      if (SKIP_ENUMS.has(enumName)) continue;
      if (!(enumName in ENUM_MAPPINGS)) {
        unmapped.push(enumName);
      }
    }
    expect(unmapped).toEqual([]);
  });

  for (const [enumName, mapping] of Object.entries(ENUM_MAPPINGS)) {
    const file = `${enumName}.schema.json`;
    const schemaPath = path.join(ENUM_SCHEMA_DIR, file);

    describe(enumName, () => {
      it('SDK type covers all OCF values', () => {
        if (!fs.existsSync(schemaPath)) {
          throw new Error(`OCF schema not found: ${schemaPath}`);
        }
        const ocfValues = getOcfEnumValues(schemaPath);
        const sdkSet = new Set(mapping.sdkValues);
        const normalize = mapping.ocfToSdkNormalize ?? ((v: string) => v);

        const missing: string[] = [];
        for (const ocf of ocfValues) {
          const sdkEquivalent = normalize(ocf);
          if (!sdkSet.has(sdkEquivalent)) {
            missing.push(`${ocf} (SDK equivalent: ${sdkEquivalent})`);
          }
        }

        expect(missing).toEqual([]);
      });

      it('SDK type has no extra values beyond OCF', () => {
        if (!fs.existsSync(schemaPath)) {
          throw new Error(`OCF schema not found: ${schemaPath}`);
        }
        const ocfValues = getOcfEnumValues(schemaPath);
        const ocfSet = new Set(ocfValues.map((v) => (mapping.ocfToSdkNormalize ? mapping.ocfToSdkNormalize(v) : v)));

        const extra: string[] = [];
        for (const sdk of mapping.sdkValues) {
          if (!ocfSet.has(sdk)) {
            extra.push(sdk);
          }
        }

        expect(extra).toEqual([]);
      });
    });
  }
});
