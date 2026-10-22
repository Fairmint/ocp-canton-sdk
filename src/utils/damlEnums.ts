/**
 * Daml enum constructors for OCF enum values (OpenCapTable-v35).
 *
 * v35 names every constructor `<TypeName><PascalCase(OCF value)>` and keeps the constructors in the order of OCF's
 * enum schema: `OcfStockIssuanceTypeFoundersStock`, `OcfDayCountType30360`, `OcfValuationType409a`. Both directions
 * apply that rule and then check the result against the constructors of the generated enum, so a package whose
 * constructors drift from the rule fails loudly at the boundary instead of sending an unknown tag to the ledger.
 *
 * `OcfObjectType` is the one documented exception: the register omits the seven `TX_PLAN_SECURITY_*` aliases (writers
 * normalize them to `TX_EQUITY_COMPENSATION_*`, see `planSecurityAliases`) and appends the two Fairmint hold types.
 * `OcfHoldType` belongs to that hold extension: its values live in `schemas/ocf-extension`, not in OCF's own enums.
 *
 * @example
 *   ```typescript
 *   damlEnumConstructor('OcfStockIssuanceType', 'FOUNDERS_STOCK'); // 'OcfStockIssuanceTypeFoundersStock'
 *   ocfEnumValue('OcfDayCountType', 'OcfDayCountType30360'); // '30_360'
 *   ```
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../errors';

/**
 * OCF values of every enum the converters use, in OCF schema order (`libs/Open-Cap-Format-OCF/schema/enums/*.schema.json`).
 * `PascalCase` of each value, prefixed with the type name, is the constructor at the same position.
 */
export const OCF_ENUM_VALUES = {
  OcfAccrualPeriodType: ['DAILY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'],
  OcfAddressType: ['LEGAL', 'CONTACT', 'OTHER'],
  OcfAllocationType: [
    'CUMULATIVE_ROUNDING',
    'CUMULATIVE_ROUND_DOWN',
    'FRONT_LOADED',
    'BACK_LOADED',
    'FRONT_LOADED_TO_SINGLE_TRANCHE',
    'BACK_LOADED_TO_SINGLE_TRANCHE',
    'FRACTIONAL',
  ],
  OcfAuthorizedShares: ['NOT APPLICABLE', 'UNLIMITED'],
  OcfCompensationType: ['OPTION_NSO', 'OPTION_ISO', 'OPTION', 'RSU', 'CSAR', 'SSAR'],
  OcfCompoundingType: ['COMPOUNDING', 'SIMPLE'],
  OcfConversionTimingType: ['PRE_MONEY', 'POST_MONEY'],
  OcfConversionTriggerType: [
    'AUTOMATIC_ON_CONDITION',
    'AUTOMATIC_ON_DATE',
    'ELECTIVE_IN_RANGE',
    'ELECTIVE_ON_CONDITION',
    'ELECTIVE_AT_WILL',
    'UNSPECIFIED',
  ],
  OcfConvertibleType: ['NOTE', 'SAFE', 'CONVERTIBLE_SECURITY'],
  OcfDayCountType: ['ACTUAL_365', '30_360'],
  OcfEmailType: ['PERSONAL', 'BUSINESS', 'OTHER'],
  OcfHoldType: ['REGISTER_SETTLEMENT', 'STOP_TRANSFER'],
  OcfInterestPayoutType: ['DEFERRED', 'CASH'],
  OcfObjectType: [
    'ISSUER',
    'STAKEHOLDER',
    'STOCK_CLASS',
    'STOCK_LEGEND_TEMPLATE',
    'STOCK_PLAN',
    'VALUATION',
    'VESTING_TERMS',
    'FINANCING',
    'DOCUMENT',
    'CE_STAKEHOLDER_RELATIONSHIP',
    'CE_STAKEHOLDER_STATUS',
    'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    'TX_STOCK_CLASS_SPLIT',
    'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    'TX_STOCK_PLAN_RETURN_TO_POOL',
    'TX_CONVERTIBLE_ACCEPTANCE',
    'TX_CONVERTIBLE_CANCELLATION',
    'TX_CONVERTIBLE_CONVERSION',
    'TX_CONVERTIBLE_ISSUANCE',
    'TX_CONVERTIBLE_RETRACTION',
    'TX_CONVERTIBLE_TRANSFER',
    'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    'TX_EQUITY_COMPENSATION_CANCELLATION',
    'TX_EQUITY_COMPENSATION_EXERCISE',
    'TX_EQUITY_COMPENSATION_ISSUANCE',
    'TX_EQUITY_COMPENSATION_RELEASE',
    'TX_EQUITY_COMPENSATION_RETRACTION',
    'TX_EQUITY_COMPENSATION_TRANSFER',
    'TX_EQUITY_COMPENSATION_REPRICING',
    'TX_STOCK_ACCEPTANCE',
    'TX_STOCK_CANCELLATION',
    'TX_STOCK_CONVERSION',
    'TX_STOCK_ISSUANCE',
    'TX_STOCK_REISSUANCE',
    'TX_STOCK_CONSOLIDATION',
    'TX_STOCK_REPURCHASE',
    'TX_STOCK_RETRACTION',
    'TX_STOCK_TRANSFER',
    'TX_WARRANT_ACCEPTANCE',
    'TX_WARRANT_CANCELLATION',
    'TX_WARRANT_EXERCISE',
    'TX_WARRANT_ISSUANCE',
    'TX_WARRANT_RETRACTION',
    'TX_WARRANT_TRANSFER',
    'TX_VESTING_ACCELERATION',
    'TX_VESTING_START',
    'TX_VESTING_EVENT',
    'TX_STOCK_HOLD',
    'TX_STOCK_HOLD_CANCELLATION',
  ],
  OcfPeriodType: ['DAYS', 'MONTHS', 'YEARS'],
  OcfPhoneType: ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'],
  OcfQuantitySourceType: [
    'HUMAN_ESTIMATED',
    'MACHINE_ESTIMATED',
    'UNSPECIFIED',
    'INSTRUMENT_FIXED',
    'INSTRUMENT_MAX',
    'INSTRUMENT_MIN',
  ],
  OcfRoundingType: ['CEILING', 'FLOOR', 'NORMAL'],
  OcfStakeholderRelationshipType: [
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
  OcfStakeholderStatusType: [
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
  OcfStakeholderType: ['INDIVIDUAL', 'INSTITUTION'],
  OcfStockClassType: ['COMMON', 'PREFERRED'],
  OcfStockIssuanceType: ['RSA', 'FOUNDERS_STOCK'],
  OcfStockPlanCancellationBehaviorType: [
    'RETIRE',
    'RETURN_TO_POOL',
    'HOLD_AS_CAPITAL_STOCK',
    'DEFINED_PER_PLAN_SECURITY',
  ],
  OcfTerminationWindowType: [
    'VOLUNTARY_OTHER',
    'VOLUNTARY_GOOD_CAUSE',
    'VOLUNTARY_RETIREMENT',
    'INVOLUNTARY_OTHER',
    'INVOLUNTARY_DEATH',
    'INVOLUNTARY_DISABILITY',
    'INVOLUNTARY_WITH_CAUSE',
  ],
  OcfValuationBasedFormulaType: ['FIXED', 'ACTUAL', 'CAP'],
  OcfValuationType: ['409A'],
  OcfVestingDayOfMonth: [
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
} as const;

/** Names of the generated Daml enums that have an OCF counterpart. */
export type DamlEnumTypeName = keyof typeof OCF_ENUM_VALUES;

/** The OCF values that one generated Daml enum carries. */
export type OcfEnumValue<TypeName extends DamlEnumTypeName> = (typeof OCF_ENUM_VALUES)[TypeName][number];

type PascalCaseWord<Word extends string> = Word extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Lowercase<Rest>}`
  : Word;

/** The type-level twin of {@link pascalCaseOcfValue}. */
type PascalCaseOf<Value extends string> = Value extends `${infer Head}_${infer Tail}`
  ? `${PascalCaseWord<Head>}${PascalCaseOf<Tail>}`
  : Value extends `${infer Head} ${infer Tail}`
    ? `${PascalCaseWord<Head>}${PascalCaseOf<Tail>}`
    : PascalCaseWord<Value>;

/**
 * The constructors of one generated Daml enum: `<TypeName><PascalCase(OCF value)>` for each of its OCF values. Declared
 * from the rule rather than from the generated package so that public declarations stay structural; the generated
 * constructors are proven to follow the rule where they are collected below.
 */
export type DamlEnumConstructor<TypeName extends DamlEnumTypeName> =
  `${TypeName}${PascalCaseOf<OcfEnumValue<TypeName>>}`;

/** Runtime constructors of every generated enum the converters use, in the generated (OCF) order. */
const GENERATED_ENUM_KEYS = {
  OcfAccrualPeriodType: Fairmint.OpenCapTable.Types.Conversion.OcfAccrualPeriodType.keys,
  OcfAddressType: Fairmint.OpenCapTable.Types.Contact.OcfAddressType.keys,
  OcfAllocationType: Fairmint.OpenCapTable.OCF.VestingTerms.OcfAllocationType.keys,
  OcfAuthorizedShares: Fairmint.OpenCapTable.Types.Stock.OcfAuthorizedShares.keys,
  OcfCompensationType: Fairmint.OpenCapTable.Types.Vesting.OcfCompensationType.keys,
  OcfCompoundingType: Fairmint.OpenCapTable.Types.Conversion.OcfCompoundingType.keys,
  OcfConversionTimingType: Fairmint.OpenCapTable.Types.Conversion.OcfConversionTimingType.keys,
  OcfConversionTriggerType: Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType.keys,
  OcfConvertibleType: Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleType.keys,
  OcfDayCountType: Fairmint.OpenCapTable.Types.Conversion.OcfDayCountType.keys,
  OcfEmailType: Fairmint.OpenCapTable.Types.Contact.OcfEmailType.keys,
  OcfHoldType: Fairmint.OpenCapTable.Types.Stock.OcfHoldType.keys,
  OcfInterestPayoutType: Fairmint.OpenCapTable.Types.Conversion.OcfInterestPayoutType.keys,
  OcfObjectType: Fairmint.OpenCapTable.Types.ObjectType.OcfObjectType.keys,
  OcfPeriodType: Fairmint.OpenCapTable.Types.Vesting.OcfPeriodType.keys,
  OcfPhoneType: Fairmint.OpenCapTable.Types.Contact.OcfPhoneType.keys,
  OcfQuantitySourceType: Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType.keys,
  OcfRoundingType: Fairmint.OpenCapTable.Types.Conversion.OcfRoundingType.keys,
  OcfStakeholderRelationshipType: Fairmint.OpenCapTable.Types.Stakeholder.OcfStakeholderRelationshipType.keys,
  OcfStakeholderStatusType: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType.keys,
  OcfStakeholderType: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderType.keys,
  OcfStockClassType: Fairmint.OpenCapTable.Types.Stock.OcfStockClassType.keys,
  OcfStockIssuanceType: Fairmint.OpenCapTable.OCF.StockIssuance.OcfStockIssuanceType.keys,
  OcfStockPlanCancellationBehaviorType: Fairmint.OpenCapTable.OCF.StockPlan.OcfStockPlanCancellationBehaviorType.keys,
  OcfTerminationWindowType: Fairmint.OpenCapTable.Types.Vesting.OcfTerminationWindowType.keys,
  OcfValuationBasedFormulaType: Fairmint.OpenCapTable.Types.Conversion.OcfValuationBasedFormulaType.keys,
  OcfValuationType: Fairmint.OpenCapTable.OCF.Valuation.OcfValuationType.keys,
  OcfVestingDayOfMonth: Fairmint.OpenCapTable.OCF.VestingTerms.OcfVestingDayOfMonth.keys,
} as const;

/**
 * The constructors of every generated enum, typed by the rule: assigning the generated keys proves at compile time that
 * each generated constructor is one `<TypeName><PascalCase(OCF value)>` produces. The reverse (the rule produces no
 * constructor the package lacks) is pinned by `test/utils/damlEnums.test.ts`.
 */
const ENUM_CONSTRUCTORS: { readonly [TypeName in DamlEnumTypeName]: ReadonlyArray<DamlEnumConstructor<TypeName>> } =
  GENERATED_ENUM_KEYS;

/** The names of the generated enums, for tests and diagnostics. */
export const DAML_ENUM_TYPE_NAMES = Object.freeze(Object.keys(OCF_ENUM_VALUES) as DamlEnumTypeName[]);

/** The generated constructors of one enum, in generated order. */
export function damlEnumConstructors<TypeName extends DamlEnumTypeName>(
  typeName: TypeName
): ReadonlyArray<DamlEnumConstructor<TypeName>> {
  return ENUM_CONSTRUCTORS[typeName];
}

/** `PascalCase` of an OCF enum value: words split on `_` or a space, first letter upper case, the rest lower case. */
export function pascalCaseOcfValue(ocfValue: string): string {
  return ocfValue
    .split(/[_ ]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Daml constructor for an OCF enum value, checked against the generated enum.
 *
 * @param typeName - The generated Daml enum type
 * @param ocfValue - The OCF enum value (`FOUNDERS_STOCK`)
 * @param source - Contextual path used when the value is unknown
 * @throws OcpParseError with code UNKNOWN_ENUM_VALUE when the generated enum has no such constructor
 */
export function damlEnumConstructor<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  ocfValue: OcfEnumValue<TypeName>,
  source: string = typeName
): DamlEnumConstructor<TypeName> {
  // Callers are typed, but the value is raw ledger-bound input at runtime: check it before applying the rule.
  const candidate = isOcfEnumValue(typeName, ocfValue) ? `${typeName}${pascalCaseOcfValue(ocfValue)}` : undefined;
  const constructors: ReadonlyArray<DamlEnumConstructor<TypeName>> = ENUM_CONSTRUCTORS[typeName];
  const found = constructors.find((constructor) => constructor === candidate);
  if (found === undefined) {
    throw new OcpParseError(`Unknown ${typeName} value: ${String(ocfValue)}`, {
      source,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return found;
}

/**
 * Daml constructor for an OCF enum value of unknown static type (raw caller input).
 *
 * @param typeName - The generated Daml enum type
 * @param input - The candidate OCF enum value
 * @param source - Contextual path used when the value is unknown
 * @throws OcpParseError with code UNKNOWN_ENUM_VALUE when the input is not an OCF value of the enum
 */
export function damlEnumConstructorFromInput<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  input: unknown,
  source: string = typeName
): DamlEnumConstructor<TypeName> {
  if (!isOcfEnumValue(typeName, input)) {
    throw new OcpParseError(`Unknown ${typeName} value: ${String(input)}`, {
      source,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return damlEnumConstructor(typeName, input, source);
}

/**
 * OCF value for a Daml enum constructor, checked against the generated enum.
 *
 * @param typeName - The generated Daml enum type
 * @param constructor - The constructor as read from the ledger (`OcfStockIssuanceTypeFoundersStock`)
 * @param source - Contextual path used when the constructor is unknown
 * @throws OcpParseError with code UNKNOWN_ENUM_VALUE when the generated enum has no such constructor
 */
export function ocfEnumValue<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  constructor: string,
  source: string = typeName
): OcfEnumValue<TypeName> {
  const values: ReadonlyArray<OcfEnumValue<TypeName>> = OCF_ENUM_VALUES[typeName];
  if (typeof constructor === 'string' && isDamlEnumConstructor(typeName, constructor)) {
    const found = values.find((value) => `${typeName}${pascalCaseOcfValue(value)}` === constructor);
    if (found !== undefined) return found;
  }
  throw new OcpParseError(`Unknown DAML ${typeName} constructor: ${String(constructor)}`, {
    source,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

/** True when the value is a constructor of the generated enum. */
export function isDamlEnumConstructor<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  value: unknown
): value is DamlEnumConstructor<TypeName> {
  const constructors: readonly string[] = ENUM_CONSTRUCTORS[typeName];
  return typeof value === 'string' && constructors.includes(value);
}

/** True when the value is one of the OCF values the generated enum carries. */
export function isOcfEnumValue<TypeName extends DamlEnumTypeName>(
  typeName: TypeName,
  value: unknown
): value is OcfEnumValue<TypeName> {
  const values: readonly string[] = OCF_ENUM_VALUES[typeName];
  return typeof value === 'string' && values.includes(value);
}
