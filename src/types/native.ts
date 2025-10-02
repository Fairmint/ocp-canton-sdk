/**
 * Clean TypeScript types that provide a better developer experience
 * compared to the raw DAML types. These types use simple string literals
 * for enums and standard TypeScript objects for complex types.
 */

/**
 * Enum - Email Type
 * Type of e-mail address
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/EmailType.schema.json
 */
export type EmailType = 'PERSONAL' | 'BUSINESS' | 'OTHER';

/**
 * Enum - Address Type
 * Type of address (legal, contact, or other)
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/AddressType.schema.json
 */
export type AddressType = 'LEGAL' | 'CONTACT' | 'OTHER';
/**
 * Enum - Phone Type
 * Type of phone number (home, mobile, business, other)
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/PhoneType.schema.json
 */
export type PhoneType = 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER';

/**
 * Type - Phone
 * Type representation of a phone number
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Phone.schema.json
 */
export interface Phone {
  /** Type of phone number (e.g., home, mobile, business, other) */
  phone_type: PhoneType;
  /** The phone number (e.g., E.164 formatted string) */
  phone_number: string;
}

/**
 * Type - Name
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Name.schema.json
 */
export interface Name {
  /** Full legal name */
  legal_name: string;
  /** Given name */
  first_name?: string;
  /** Family name */
  last_name?: string;
}

/**
 * Enum - Stock Class Type
 * Type of stock class (common or preferred)
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StockClassType.schema.json
 */
export type StockClassType = 'PREFERRED' | 'COMMON';

/**
 * Conversion Mechanisms (shared)
 * Mechanism by which conversion occurs (see schema for full list)
 * OCF (primitive): https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/conversion_mechanisms/ConversionMechanism.schema.json
 */
export type ConversionMechanism = 'RATIO_CONVERSION' | 'PERCENT_CONVERSION' | 'FIXED_AMOUNT_CONVERSION';

/**
 * Enum - Conversion Trigger Type
 * Type of conversion trigger
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/ConversionTriggerType.schema.json
 */
export type ConversionTrigger =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_ON_DATE'
  | 'ELECTIVE_AT_WILL';

/**
 * Enum - Rounding Type
 * Rounding method for numeric values
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/RoundingType.schema.json
 */
export type RoundingType = 'DOWN' | 'UP' | 'NEAREST' | 'NORMAL';

/**
 * Enum - Authorized Shares
 * Enumeration of special values for authorized shares when not using a numeric value
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/AuthorizedShares.schema.json
 */
export type AuthorizedShares = 'NOT_APPLICABLE' | 'UNLIMITED';

/**
 * Initial shares authorized type (can be either numeric or enum)
 * Type representing the number of shares initially authorized
 */
export type InitialSharesAuthorized = number | string;

/**
 * Type - Monetary
 * Type representation of a money amount and currency
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Monetary.schema.json
 */
export interface Monetary {
  /** Amount of money in the given currency */
  amount: string | number;
  /** Three-letter ISO currency code */
  currency: string;
}

/**
 * Type - Email
 * Type representation of an email address
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Email.schema.json
 */
export interface Email {
  /** Type of e-mail address (e.g. personal or business) */
  email_type: EmailType;
  /** A valid e-mail address */
  email_address: string;
}

/**
 * Type - Address
 * Type representation of an address
 */
export interface Address {
  /** Type of address (legal, contact, or other) */
  address_type: AddressType;
  /** Street address and suite/apartment */
  street_suite?: string;
  /** City name */
  city?: string;
  /** Country subdivision/state/province code or name */
  country_subdivision?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Postal or ZIP code */
  postal_code?: string;
}

/**
 * Type - Tax ID
 * Type representation of a tax identifier and issuing country
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/TaxID.schema.json
 */
export interface TaxId {
  /** Country code where the tax ID is issued (ISO 3166-1 alpha-2) */
  country: string;
  /** Tax identification string */
  tax_id: string;
}

/**
 * Stock Class Conversion Right (shared)
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/conversion_rights/StockClassConversionRight.schema.json
 */
export interface StockClassConversionRight {
  /** Type descriptor of conversion right */
  type: string;
  /** Mechanism by which conversion occurs */
  conversion_mechanism: ConversionMechanism;
  /** Trigger that would cause conversion */
  conversion_trigger: ConversionTrigger;
  /** Identifier of stock class to which this converts */
  converts_to_stock_class_id: string;
  /** Legacy simple ratio value (if provided, denominator assumed 1) */
  ratio?: number;
  /** Ratio components for RATIO_CONVERSION */
  ratio_numerator?: number;
  ratio_denominator?: number;
  /** Percent of capitalization this converts to (0 < p <= 1) */
  percent_of_capitalization?: number;
  /** Conversion price per share for fixed-amount conversion */
  conversion_price?: Monetary;
  /** Reference share price */
  reference_share_price?: Monetary;
  /** Reference valuation price per share */
  reference_valuation_price_per_share?: Monetary;
  /** Discount rate (0-1 decimal) */
  discount_rate?: number;
  /** Valuation cap */
  valuation_cap?: Monetary;
  /** Floor price per share */
  floor_price_per_share?: Monetary;
  /** Ceiling price per share */
  ceiling_price_per_share?: Monetary;
  /** Custom description of conversion mechanics */
  custom_description?: string;
  /** How should fractional shares be rounded? */
  rounding_type?: RoundingType;
  /** Expiration date for this conversion right (YYYY-MM-DD) */
  expires_at?: string;
}

/**
 * Object - Issuer
 * Object describing the issuer of the cap table (the company whose cap table this is).
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Issuer.schema.json
 */
export interface OcfIssuerData {
  /** Identifier for the object */
  id: string;
  /** Legal name of the issuer */
  legal_name: string;
  /** Date of formation */
  formation_date: string;
  /** The country where the issuer company was legally formed (ISO 3166-1 alpha-2) */
  country_of_formation: string;
  /** Optional comments related to the issuer */
  comments: string[];
  /** The tax ids for this issuer company */
  tax_ids: TaxId[];
  /** The headquarters address of the issuing company */
  address?: Address;
  /** The code for the state, province, or subdivision where the issuer company was legally formed */
  country_subdivision_of_formation?: string;
  /** Text name of state, province, or subdivision where the issuer was legally formed if the code is not available */
  country_subdivision_name_of_formation?: string;
  /** Doing Business As name */
  dba?: string;
  /** A work email that the issuer company can be reached at */
  email?: Email;
  /** The initial number of shares authorized for this issuer */
  initial_shares_authorized?: InitialSharesAuthorized;
  /** A phone number that the issuer company can be reached at */
  phone?: Phone;
}

/**
 * Object - Stock Class
 * Object describing a class of stock issued by the issuer
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/StockClass.schema.json
 */
export interface OcfStockClassData {
  /** Identifier for the object */
  id: string;
  /** The type of this stock class (e.g. Preferred or Common) */
  class_type: StockClassType;
  /** Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate IDs have a dash, the prefix should end in the dash like CS- */
  default_id_prefix: string;
  /** The initial number of shares authorized for this stock class */
  initial_shares_authorized: string | number;
  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;
  /** Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so that stock classes with a higher seniority have higher repayment priority. The following properties hold for all stock classes for a given company: (a) transitivity: stock classes are absolutely stackable by seniority and in increasing numerical order, (b) non-uniqueness: multiple stock classes can have the same Seniority number and therefore have the same liquidation/repayment order. In practice, stock classes with same seniority may be created at different points in time and (for example, an extension of an existing preferred financing round), and also a new stock class can be created with seniority between two existing stock classes, in which case it is assigned some decimal number between the numbers representing seniority of the respective classes. */
  seniority: string | number;
  /** The number of votes each share of this stock class gets */
  votes_per_share: string | number;
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
  /** List of stock class conversion rights possible for this stock class */
  conversion_rights: StockClassConversionRight[];
  /** Date on which the board approved the stock class */
  board_approval_date?: string;
  /** The liquidation preference per share for this stock class */
  liquidation_preference_multiple?: string | number;
  /** Per-share par value of this stock class */
  par_value?: Monetary;
  /** The participation cap multiple per share for this stock class */
  participation_cap_multiple?: string | number;
  /** Per-share price this stock class was issued for */
  price_per_share?: Monetary;
  /** Date on which the stockholders approved the stock class */
  stockholder_approval_date?: string;
}

/**
 * Enum - Stakeholder Type
 * Stakeholder type (Individual or Institution)
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StakeholderType.schema.json
 */
export type StakeholderType = 'INDIVIDUAL' | 'INSTITUTION';

/**
 * Type - Contact Info
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ContactInfo.schema.json
 */
export interface ContactInfo {
  /** Contact name */
  name: Name;
  /** Phone numbers */
  phone_numbers: Phone[];
  /** Email addresses */
  emails: Email[];
}

/**
 * Type - Contact Info Without Name
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ContactInfoWithoutName.schema.json
 */
export interface ContactInfoWithoutName {
  /** Phone numbers */
  phone_numbers: Phone[];
  /** Email addresses */
  emails: Email[];
}

/**
 * Object - Stakeholder
 * Object describing a stakeholder in the issuer's cap table
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Stakeholder.schema.json
 */
export interface OcfStakeholderData {
  /** Identifier for the object */
  id: string;
  /** Stakeholder's name */
  name: Name;
  /** Stakeholder type (Individual or Institution) */
  stakeholder_type: StakeholderType;
  /** Alternate ID assigned by issuer */
  issuer_assigned_id?: string;
  /** Current relationship(s) to issuer */
  current_relationships: string[];
  /** Current employment/engagement status */
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
  /** Primary contact information */
  primary_contact?: ContactInfo;
  /** Contact info without name */
  contact_info?: ContactInfoWithoutName;
  /** Mailing or legal addresses */
  addresses: Address[];
  /** Tax identification numbers */
  tax_ids: TaxId[];
  /** Unstructured comments */
  comments: string[];
}

/**
 * Object - Stock Legend Template
 * Object describing a stock legend template
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/StockLegendTemplate.schema.json
 */
export interface OcfStockLegendTemplateData {
  /** Identifier for the object */
  id: string;
  /** Name for the stock legend template */
  name: string;
  /** The full text of the stock legend */
  text: string;
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
}

/**
 * Type - Object Reference
 * A type representing a reference to any kind of OCF object
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ObjectReference.schema.json
 */
export interface OcfObjectReference {
  /** Type of the referenced object */
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
  /** Identifier of the referenced object */
  object_id: string;
}

/**
 * Object - Document
 * Object describing a document
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Document.schema.json
 */
export interface OcfDocumentData {
  /** Identifier for the object */
  id: string;
  /** Relative file path to the document within the OCF bundle */
  path?: string;
  /** External URI to the document (used when the file is hosted elsewhere) */
  uri?: string;
  /** MD5 hash of the document contents (32-character hex) */
  md5: string;
  /** References to related OCF objects */
  related_objects: OcfObjectReference[];
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
}

/**
 * Enum - Valuation Type
 * Enumeration of valuation types
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/ValuationType.schema.json
 */
export type ValuationType = '409A';

/**
 * Object - Valuation
 * Object describing a valuation used in the cap table
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Valuation.schema.json
 */
export interface OcfValuationData {
  /** Identifier for the object */
  id: string;
  /** Identifier of the stock class for this valuation */
  stock_class_id: string;
  /** Entity which provided the valuation */
  provider?: string;
  /** Date on which board approved the valuation */
  board_approval_date?: string;
  /** This optional field tracks when the stockholders approved the valuation. */
  stockholder_approval_date?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
  /** Valued price per share */
  price_per_share: Monetary;
  /** Date on which this valuation is first valid */
  effective_date: string; // YYYY-MM-DD
  /** Seam for supporting different types of valuations in future versions */
  valuation_type: ValuationType;
}

// ===== Stock Issuance Types =====

export type StockIssuanceType = 'RSA' | 'FOUNDERS_STOCK';

export interface ShareNumberRange {
  /** Starting share number in the range (must be > 0) */
  starting_share_number: string | number;
  /** Ending share number in the range (>= starting) */
  ending_share_number: string | number;
}

export interface SecurityExemption {
  /** Description of the exemption relied upon */
  description: string;
  /** Jurisdiction where the exemption applies */
  jurisdiction: string;
}

export interface VestingSimple {
  /** Date when vesting occurs */
  date: string; // YYYY-MM-DD
  /** Number of shares, units, or amount vesting */
  amount: string | number;
}

export interface OcfStockIssuanceData {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string; // YYYY-MM-DD
  /** Identifier for the security by which it can be referenced by other transaction objects */
  security_id: string;
  /** A custom ID for this security (e.g. CS-1.) */
  custom_id: string;
  /** Identifier for the stakeholder that holds legal title to this security */
  stakeholder_id: string;
  /** Date of board approval for the security */
  board_approval_date?: string;
  /** Date on which the stockholders approved the security */
  stockholder_approval_date?: string;
  /** Unstructured text description of consideration provided in exchange for security issuance */
  consideration_text?: string;
  /** List of security law exemptions (and applicable jurisdictions) for this security */
  security_law_exemptions: SecurityExemption[];
  /** Identifier of the stock class of the issued security */
  stock_class_id: string;
  /** Identifier for the stock plan, if applicable */
  stock_plan_id?: string;
  /** Share number ranges (if any) associated with this issuance */
  share_numbers_issued: ShareNumberRange[];
  /** Price per share paid for the stock */
  share_price: Monetary;
  /** Quantity of shares issued */
  quantity: string | number;
  /** Reference to vesting terms object, if used instead of inline vestings */
  vesting_terms_id?: string;
  /** Vesting schedule entries associated directly with this issuance */
  vestings: VestingSimple[];
  /** Cost basis for the shares issued */
  cost_basis?: Monetary;
  /** Stock legends that apply to this issuance (schema minItems: 1; implementation may allow empty) */
  stock_legend_ids: string[];
  /** Type of stock issuance (e.g., RSA, Founders) */
  issuance_type?: StockIssuanceType;
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
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

/** Primitive - Vesting Period Type (Days/Months)
 * Abstract type for periods of time; concrete days/months variants below.
 * OCF (primitive): https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/vesting/VestingPeriod.schema.json
 * OCF (days):      https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingPeriodInDays.schema.json
 * OCF (months):    https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingPeriodInMonths.schema.json
 */
export type PeriodType = 'DAYS' | 'MONTHS';

export type VestingPeriod = { type: PeriodType; value: number };

/**
 * Primitive - Vesting Condition Trigger Type and specific triggers
 * OCF (primitive): https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/vesting/VestingConditionTrigger.schema.json
 * OCF (start):     https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingStartTrigger.schema.json
 * OCF (absolute):  https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingScheduleAbsoluteTrigger.schema.json
 * OCF (relative):  https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingScheduleRelativeTrigger.schema.json
 * OCF (event):     https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingEventTrigger.schema.json
 */
export type VestingTrigger =
  | { kind: 'START' }
  | { kind: 'SCHEDULE_ABSOLUTE'; at: string }
  | { kind: 'SCHEDULE_RELATIVE'; period: VestingPeriod; relative_to_condition_id: string }
  | { kind: 'EVENT' };

export interface VestingConditionPortion {
  /** Portion numerator (e.g., 25) */
  numerator: string | number;
  /** Portion denominator (e.g., 100) */
  denominator: string | number;
  /** If true, vest remainder after all integer tranches */
  remainder: boolean;
}

export interface VestingCondition {
  /** Reference identifier for this condition (unique within the vesting terms) */
  id: string;
  /** Detailed description of the condition */
  description?: string;
  /** If specified, the fractional part of the whole security that vests */
  portion?: VestingConditionPortion;
  /** If specified, the fixed amount of the whole security to vest */
  quantity?: string | number;
  /** Describes how this vesting condition is met */
  trigger: VestingTrigger;
  /** List of ALL VestingCondition IDs that can trigger after this one */
  next_condition_ids: string[];
}

/**
 * Object - Vesting Terms
 * Object describing the terms under which a security vests
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/VestingTerms.schema.json
 */
export interface OcfVestingTermsData {
  id: string;
  /** Concise name for the vesting schedule */
  name: string;
  /** Detailed description of the vesting schedule */
  description: string;
  /** Allocation/rounding type for the vesting schedule */
  allocation_type: AllocationType;
  /** Conditions and triggers that describe the graph of vesting schedules and events */
  vesting_conditions: VestingCondition[];
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
}

// ===== Stock Plan Types =====

export type StockPlanCancellationBehavior =
  | 'RETIRE'
  | 'RETURN_TO_POOL'
  | 'HOLD_AS_CAPITAL_STOCK'
  | 'DEFINED_PER_PLAN_SECURITY';

export interface OcfStockPlanData {
  id: string;
  /** Human-friendly name of the plan */
  plan_name: string;
  /** Date of board approval for the plan */
  board_approval_date?: string;
  /** Date of stockholder approval for the plan */
  stockholder_approval_date?: string;
  /** Initial number of shares reserved for the plan */
  initial_shares_reserved: string | number;
  /** Default cancellation behavior if not specified at the security level */
  default_cancellation_behavior?: StockPlanCancellationBehavior;
  /** List of stock class ids associated with this plan */
  stock_class_ids: string[];
  /** Unstructured text comments related to and stored for the object */
  comments: string[];
}

// ===== Equity Compensation Issuance Types =====

export type CompensationType = 'OPTION_NSO' | 'OPTION_ISO' | 'OPTION' | 'RSU' | 'CSAR' | 'SSAR';

export interface Vesting {
  /** Date when vesting occurs */
  date: string; // YYYY-MM-DD
  /** Number of shares, units, or amount vesting */
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
  /** Reason for termination window */
  reason: TerminationWindowReason;
  /** Number of units in the termination window */
  period: number;
  /** Unit of time for the termination window */
  period_type: PeriodType;
}

export interface OcfEquityCompensationIssuanceData {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  stock_plan_id?: string;
  stock_class_id?: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  vesting_terms_id?: string;
  /** Type of equity compensation instrument */
  compensation_type: CompensationType;
  /** Quantity granted/issued */
  quantity: string | number;
  /** Exercise price per share/unit */
  exercise_price?: Monetary;
  /** Base price used to value compensation (for SARs) */
  base_price?: Monetary;
  /** Whether early exercise is permitted */
  early_exercisable?: boolean;
  /** List of security law exemptions (and applicable jurisdictions) for this security */
  security_law_exemptions: SecurityExemption[];
  /** Vesting events for the grant */
  vestings: Vesting[];
  /** Expiration date of instrument */
  expiration_date?: string;
  /** Termination exercise windows after termination events */
  termination_exercise_windows: TerminationWindow[];
  /** Unstructured text comments */
  comments: string[];
}

// ===== Convertible & Warrant Issuance Types =====

export type ConvertibleType = 'NOTE' | 'SAFE' | 'SECURITY';
export type SimpleTrigger = 'AUTOMATIC' | 'OPTIONAL';

/**
 * Object - Convertible Issuance Transaction (native subset)
 * Object describing convertible instrument issuance transaction by the issuer and held by a stakeholder
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json
 */
export interface OcfConvertibleIssuanceDataNative {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  /** Amount invested and outstanding on date of issuance of this convertible */
  investment_amount: Monetary;
  /** What kind of convertible instrument is this (of the supported, enumerated types) */
  convertible_type: ConvertibleType;
  /** Convertible - Conversion Trigger Array (simplified) */
  conversion_triggers: unknown[];
  /** If different convertible instruments have seniority over one another, use this value to build a seniority stack */
  seniority: number;
  /** What pro-rata (if any) is the holder entitled to buy at the next round? */
  pro_rata?: string | number;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Warrant Issuance Transaction (native subset)
 * Object describing warrant issuance transaction by the issuer and held by a stakeholder
 * OCF: https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/WarrantIssuance.schema.json
 */
export interface OcfWarrantIssuanceDataNative {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  /** Quantity of shares the warrant is exercisable for */
  quantity?: string | number;
  quantity_source?:
    | 'UNSPECIFIED'
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN';
  ratio_numerator?: string | number;
  ratio_denominator?: string | number;
  percent_of_outstanding?: string | number;
  /** The exercise price of the warrant */
  exercise_price?: Monetary;
  /** Actual purchase price of the warrant (sum up purported value of all consideration, including in-kind) */
  purchase_price: Monetary;
  /** Warrant Issuance - Exercise Trigger Array (complex nested type) */
  exercise_triggers: unknown[];
  /** What is expiration date of the warrant (if applicable) */
  warrant_expiration_date?: string;
  /** Identifier of the VestingTerms to which this security is subject */
  vesting_terms_id?: string;
  /** Conversion triggers (complex nested type) */
  conversion_triggers?: unknown[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

export interface OcfStockCancellationTxData {
  id: string;
  date: string;
  security_id: string;
  quantity: string | number;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

export interface OcfIssuerAuthorizedSharesAdjustmentTxData {
  id: string;
  date: string;
  issuer_id: string;
  new_shares_authorized: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface OcfStockClassAuthorizedSharesAdjustmentTxData {
  id: string;
  date: string;
  stock_class_id: string;
  new_shares_authorized: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface OcfStockPlanPoolAdjustmentTxData {
  id: string;
  date: string;
  stock_plan_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  shares_reserved: string | number;
  comments?: string[];
}

export interface OcfEquityCompensationExerciseTxData {
  id: string;
  date: string;
  security_id: string;
  quantity: string | number;
  consideration_text?: string;
  resulting_security_ids: string[];
  comments?: string[];
}
