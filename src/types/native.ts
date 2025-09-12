/**
 * Clean TypeScript types that provide a better developer experience
 * compared to the raw DAML types. These types use simple string literals
 * for enums and standard TypeScript objects for complex types.
 */

/** Email type */
export type EmailType = 'PERSONAL' | 'BUSINESS' | 'OTHER';

/** Address type */
export type AddressType = 'LEGAL' | 'CONTACT' | 'OTHER';
/** Phone type */
export type PhoneType = 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER';

/** Phone object */
export interface Phone {
  /** Type of phone number (e.g. mobile, home or business) */
  phone_type: PhoneType;
  /** A valid phone number string in ITU E.123 international notation (e.g. +123 123 456 7890) */
  phone_number: string;
}

/** Name object per OCF Name.schema */
export interface Name {
  legal_name: string;
  first_name?: string;
  last_name?: string;
}


/** Stock class type */
export type StockClassType = 'PREFERRED' | 'COMMON';

/** Conversion mechanism types */
export type ConversionMechanism = 'RATIO_CONVERSION' | 'PERCENT_CONVERSION' | 'FIXED_AMOUNT_CONVERSION';

/** Conversion trigger types */
export type ConversionTrigger = 'AUTOMATIC_ON_CONDITION' | 'AUTOMATIC_ON_DATE' | 'ELECTIVE_ON_CONDITION' | 'ELECTIVE_ON_DATE' | 'ELECTIVE_AT_WILL';

/** Rounding type for fractional shares */
export type RoundingType = 'DOWN' | 'UP' | 'NEAREST' | 'NORMAL';

/** Authorized shares special values */
export type AuthorizedShares = 'NOT_APPLICABLE' | 'UNLIMITED';

/** Initial shares authorized (Issuer allows enum, StockClass requires numeric). */
export type InitialSharesAuthorized = number | string;

/** Monetary value */
export interface Monetary {
  /** The amount of the monetary value */
  amount: string | number;
  /** The currency code for the monetary value (ISO 4217) */
  currency: string;
}

/** Email object */
export interface Email {
  /** Type of email address */
  email_type: EmailType;
  /** The email address */
  email_address: string;
}

/** Address object */
export interface Address {
  /** What type of address this is */
  address_type: AddressType;
  /** Street address (multi-line string) */
  street_suite?: string;
  /** City */
  city?: string;
  /** State, province, or equivalent identifier */
  country_subdivision?: string;
  /** Country code for this address (ISO 3166-1 alpha-2) */
  country: string;
  /** Address postal code */
  postal_code?: string;
}

/** Tax ID object following OCF specification */
export interface TaxId {
  /** Tax identifier as string */
  tax_id: string;
  /** Issuing country code (ISO 3166-1 alpha-2) for the tax identifier */
  country: string;
}

/** Stock Class Conversion Right following OCF specification */
export interface StockClassConversionRight {
  /** Type identifier for the conversion right (required) */
  type: string;
  /** The conversion mechanism that determines how conversions are calculated (required) */
  conversion_mechanism: ConversionMechanism;
  /** When the conversion can occur (required) */
  conversion_trigger: ConversionTrigger;
  /** ID of the target stock class that this converts into (required) */
  converts_to_stock_class_id: string;
  /** Legacy simple ratio value (if provided, denominator assumed 1) */
  ratio?: number;
  /** Ratio components for RATIO_CONVERSION */
  ratio_numerator?: number;
  ratio_denominator?: number;
  /** Percent for PERCENT_CONVERSION (0 < p <= 1) */
  percent_of_capitalization?: number;
  /** Fixed amount price for FIXED_AMOUNT_CONVERSION */
  conversion_price?: Monetary;
  /** Optional reference prices and bounds (not fully modeled in DAML in v1) */
  reference_share_price?: Monetary;
  reference_valuation_price_per_share?: Monetary;
  discount_rate?: number;
  valuation_cap?: Monetary;
  floor_price_per_share?: Monetary;
  ceiling_price_per_share?: Monetary;
  custom_description?: string;
  /** How should fractional shares be rounded? (not modeled in DAML v1; retained for OCF completeness) */
  rounding_type?: RoundingType;
  /** Expiration date after which the conversion right is no longer valid (YYYY-MM-DD format) */
  expires_at?: string;
}

/** OCF Issuer Data */
export interface OcfIssuerData {
  ocf_id: string;
  /** Legal name of the issuer */
  legal_name: string;
  /** Date of formation (YYYY-MM-DD format) */
  formation_date?: string;
  /** The country where the issuer company was legally formed (ISO 3166-1 alpha-2) */
  country_of_formation: string;
  /** Doing Business As name */
  dba?: string;
  /** The state, province, or subdivision where the issuer company was legally formed */
  country_subdivision_of_formation?: string;
  /** The text name of state, province, or subdivision where the issuer company was legally formed if the code is not available */
  country_subdivision_name_of_formation?: string;
  /** The tax ids for this issuer company */
  tax_ids?: TaxId[];
  /** A work email that the issuer company can be reached at */
  email?: Email;
  /** A phone number that the issuer company can be reached at */
  phone?: Phone;
  /** The headquarters address of the issuing company */
  address?: Address;
  /** The initial number of shares authorized for this issuer */
  initial_shares_authorized?: InitialSharesAuthorized;
  /** Optional comments */
  comments?: string[];
}

/** OCF Stock Class Data */
export interface OcfStockClassData {
  ocf_id: string;
  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;
  /** The type of this stock class */
  class_type: StockClassType;
  /** Default prefix for certificate numbers */
  default_id_prefix: string;
  /** The initial number of shares authorized for this stock class (numeric only) */
  initial_shares_authorized: string | number;
  /** The number of votes each share of this stock class gets */
  votes_per_share: string | number;
  /** Seniority of the stock - determines repayment priority */
  seniority: string | number;
  /** Date on which the board approved the stock class (YYYY-MM-DD format) */
  board_approval_date?: string;
  /** Date on which the stockholders approved the stock class (YYYY-MM-DD format) */
  stockholder_approval_date?: string;
  /** Per-share par value of this stock class */
  par_value?: Monetary;
  /** Per-share price this stock class was issued for */
  price_per_share?: Monetary;
  /** List of stock class conversion rights possible for this stock class */
  conversion_rights?: StockClassConversionRight[];
  /** The liquidation preference per share for this stock class */
  liquidation_preference_multiple?: string | number;
  /** The participation cap multiple per share for this stock class */
  participation_cap_multiple?: string | number;
  /** Optional comments */
  comments?: string[];
}

/** Stakeholder type */
export type StakeholderType = 'INDIVIDUAL' | 'INSTITUTION';

/** Contact info with name */
export interface ContactInfo {
  name: Name;
  phone_numbers?: Phone[];
  emails?: Email[];
}

/** Contact info without name */
export interface ContactInfoWithoutName {
  phone_numbers?: Phone[];
  emails?: Email[];
}

/** OCF Stakeholder Data */
export interface OcfStakeholderData {
  ocf_id: string;
  name: Name;
  stakeholder_type: StakeholderType;
  issuer_assigned_id?: string;
  /** Array of current relationships per v2 */
  current_relationships?: string[];
  /** Current activity status of the stakeholder */
  current_status?:
    | 'ACTIVE'
    | 'LEAVE_OF_ABSENCE'
    | 'TERMINATION_VOLUNTARY_OTHER'
    | 'TERMINATION_VOLUNTARY_GOOD_CAUSE'
    | 'TERMINATION_VOLUNTARY_RETIREMENT'
    | 'TERMINATION_INVOLUNTARY_OTHER'
    | 'TERMINATION_INVOLUNTARY_DEATH'
    | 'TERMINATION_INVOLUNTARY_DISABILITY'
    | 'TERMINATION_INVOLUNTARY_WITH_CAUSE';
  primary_contact?: ContactInfo;
  contact_info?: ContactInfoWithoutName;
  addresses: Address[];
  tax_ids: TaxId[];
  comments?: string[];
}

/** Stock Legend Template Data */
export interface OcfStockLegendTemplateData {
  ocf_id: string;
  name: string;
  text: string;
  comments?: string[];
}

/** Reference to another OCF object */
export interface OcfObjectReference {
  object_type:
    | 'ISSUER'
    | 'STAKEHOLDER'
    | 'STOCK_CLASS'
    | 'STOCK_LEGEND_TEMPLATE'
    | 'STOCK_PLAN'
    | 'VALUATION'
    | 'VESTING_TERMS'
    | 'FINANCING'
    | 'DOCUMENT'
    | 'CE_STAKEHOLDER_RELATIONSHIP'
    | 'CE_STAKEHOLDER_STATUS'
    | 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT'
    | 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_CLASS_SPLIT'
    | 'TX_STOCK_PLAN_POOL_ADJUSTMENT'
    | 'TX_STOCK_PLAN_RETURN_TO_POOL'
    | 'TX_CONVERTIBLE_ACCEPTANCE'
    | 'TX_CONVERTIBLE_CANCELLATION'
    | 'TX_CONVERTIBLE_CONVERSION'
    | 'TX_CONVERTIBLE_ISSUANCE'
    | 'TX_CONVERTIBLE_RETRACTION'
    | 'TX_CONVERTIBLE_TRANSFER'
    | 'TX_EQUITY_COMPENSATION_ACCEPTANCE'
    | 'TX_EQUITY_COMPENSATION_CANCELLATION'
    | 'TX_EQUITY_COMPENSATION_EXERCISE'
    | 'TX_EQUITY_COMPENSATION_ISSUANCE'
    | 'TX_EQUITY_COMPENSATION_RELEASE'
    | 'TX_EQUITY_COMPENSATION_RETRACTION'
    | 'TX_EQUITY_COMPENSATION_TRANSFER'
    | 'TX_EQUITY_COMPENSATION_REPRICING'
    | 'TX_PLAN_SECURITY_ACCEPTANCE'
    | 'TX_PLAN_SECURITY_CANCELLATION'
    | 'TX_PLAN_SECURITY_EXERCISE'
    | 'TX_PLAN_SECURITY_ISSUANCE'
    | 'TX_PLAN_SECURITY_RELEASE'
    | 'TX_PLAN_SECURITY_RETRACTION'
    | 'TX_PLAN_SECURITY_TRANSFER'
    | 'TX_STOCK_ACCEPTANCE'
    | 'TX_STOCK_CANCELLATION'
    | 'TX_STOCK_CONVERSION'
    | 'TX_STOCK_ISSUANCE'
    | 'TX_STOCK_REISSUANCE'
    | 'TX_STOCK_CONSOLIDATION'
    | 'TX_STOCK_REPURCHASE'
    | 'TX_STOCK_RETRACTION'
    | 'TX_STOCK_TRANSFER'
    | 'TX_WARRANT_ACCEPTANCE'
    | 'TX_WARRANT_CANCELLATION'
    | 'TX_WARRANT_EXERCISE'
    | 'TX_WARRANT_ISSUANCE'
    | 'TX_WARRANT_RETRACTION'
    | 'TX_WARRANT_TRANSFER'
    | 'TX_VESTING_ACCELERATION'
    | 'TX_VESTING_START'
    | 'TX_VESTING_EVENT';
  object_id: string;
}

/** OCF Document Data */
export interface OcfDocumentData {
  ocf_id: string;
  path?: string;
  uri?: string;
  md5: string;
  related_objects: OcfObjectReference[];
  comments?: string[];
}

/** Valuation Type */
export type ValuationType = '409A';

/** OCF Valuation Data */
export interface OcfValuationData {
  ocf_id: string;
  stock_class_id: string;
  provider?: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
  price_per_share: Monetary;
  effective_date: string; // YYYY-MM-DD
  valuation_type: ValuationType;
}

// ===== Vesting Terms Types =====

export type AllocationType =
  | 'CUMULATIVE_ROUNDING'
  | 'CUMULATIVE_ROUND_DOWN'
  | 'FRONT_LOADED'
  | 'BACK_LOADED'
  | 'FRONT_LOADED_SINGLE_TRANCHE'
  | 'BACK_LOADED_SINGLE_TRANCHE'
  | 'FRACTIONAL';

export type PeriodType = 'DAYS' | 'MONTHS';

export type VestingPeriod = { type: PeriodType; value: number };

export type VestingTrigger =
  | { kind: 'START' }
  | { kind: 'SCHEDULE_ABSOLUTE'; at: string }
  | { kind: 'SCHEDULE_RELATIVE'; period: VestingPeriod; relative_to_condition_id: string }
  | { kind: 'EVENT' };

export interface VestingConditionPortion {
  numerator: string | number;
  denominator: string | number;
  remainder: boolean;
}

export interface VestingCondition {
  id: string;
  description?: string;
  portion?: VestingConditionPortion;
  quantity?: string | number;
  trigger: VestingTrigger;
  next_condition_ids: string[];
}

export interface OcfVestingTermsData {
  ocf_id: string;
  name: string;
  description: string;
  allocation_type: AllocationType;
  vesting_conditions: VestingCondition[];
  comments?: string[];
}

// ===== Stock Plan Types =====

export type StockPlanCancellationBehavior =
  | 'RETIRE'
  | 'RETURN_TO_POOL'
  | 'HOLD_AS_CAPITAL_STOCK'
  | 'DEFINED_PER_PLAN_SECURITY';

export interface OcfStockPlanData {
  ocf_id: string;
  plan_name: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  initial_shares_reserved: string | number;
  default_cancellation_behavior?: StockPlanCancellationBehavior;
  stock_class_ids: string[];
  comments?: string[];
}

// ===== Equity Compensation Issuance Types =====

export type CompensationType = 'OPTION_NSO' | 'OPTION_ISO' | 'OPTION' | 'RSU' | 'CSAR' | 'SSAR';

export interface Vesting {
  date: string; // YYYY-MM-DD
  amount: string | number;
}

export type TerminationWindowReason =
  | 'VOLUNTARY_OTHER'
  | 'VOLUNTARY_GOOD_CAUSE'
  | 'VOLUNTARY_RETIREMENT'
  | 'INVOLUNTARY_OTHER'
  | 'INVOLUNTARY_DEATH'
  | 'INVOLUNTARY_DISABILITY'
  | 'INVOLUNTARY_WITH_CAUSE';

export interface TerminationWindow {
  reason: TerminationWindowReason;
  period: number;
  period_type: PeriodType;
}

export interface OcfEquityCompensationIssuanceData {
  compensation_type: CompensationType;
  quantity: string | number;
  exercise_price?: Monetary;
  base_price?: Monetary;
  early_exercisable?: boolean;
  vestings?: Vesting[];
  expiration_date?: string;
  termination_exercise_windows: TerminationWindow[];
  comments?: string[];
}

// ===== Convertible & Warrant Issuance Types =====

export type ConvertibleType = 'NOTE' | 'SAFE' | 'SECURITY';
export type SimpleTrigger = 'AUTOMATIC' | 'OPTIONAL';

export interface OcfConvertibleIssuanceDataNative {
  investment_amount: Monetary;
  convertible_type: ConvertibleType;
  conversion_triggers: SimpleTrigger[];
  seniority: number;
  pro_rata?: string | number;
  comments?: string[];
}

export interface OcfWarrantIssuanceDataNative {
  quantity: string | number;
  exercise_price: Monetary;
  purchase_price: Monetary;
  exercise_triggers: SimpleTrigger[];
  warrant_expiration_date?: string;
  vesting_terms_id?: string;
  comments?: string[];
}
