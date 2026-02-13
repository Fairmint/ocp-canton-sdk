/**
 * Clean TypeScript types that provide a better developer experience compared to the raw DAML types. These types use
 * simple string literals for enums and standard TypeScript objects for complex types.
 */

/**
 * Enum - Email Type Type of e-mail address OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/EmailType.schema.json
 */
export type EmailType = 'PERSONAL' | 'BUSINESS' | 'OTHER';

/**
 * Enum - Address Type Type of address (legal, contact, or other) OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/AddressType.schema.json
 */
export type AddressType = 'LEGAL' | 'CONTACT' | 'OTHER';
/**
 * Enum - Phone Type Type of phone number (home, mobile, business, other) OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/PhoneType.schema.json
 */
export type PhoneType = 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER';

/**
 * Type - Phone Type representation of a phone number OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Phone.schema.json
 */
export interface Phone {
  /** Type of phone number (e.g., home, mobile, business, other) */
  phone_type: PhoneType;
  /** The phone number (e.g., E.164 formatted string) */
  phone_number: string;
}

/**
 * Type - Name OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Name.schema.json
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
 * Enum - Stock Class Type Type of stock class (common or preferred) OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StockClassType.schema.json
 */
export type StockClassType = 'PREFERRED' | 'COMMON';

/**
 * Conversion Mechanisms (shared) Mechanism by which conversion occurs (see schema for full list) OCF (primitive):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/conversion_mechanisms/ConversionMechanism.schema.json
 */
export type ConversionMechanism = 'RATIO_CONVERSION' | 'PERCENT_CONVERSION' | 'FIXED_AMOUNT_CONVERSION';

/**
 * Enum - Conversion Trigger Type Type of conversion trigger OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/ConversionTriggerType.schema.json
 */
export type ConversionTrigger =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_ON_DATE'
  | 'ELECTIVE_AT_WILL';

/**
 * Extended Conversion Trigger Type for Warrants and Convertibles Includes additional trigger types used by these
 * instruments
 */
export type ConversionTriggerType =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_IN_RANGE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_AT_WILL'
  | 'UNSPECIFIED';

// ===== Capitalization Definition Rules =====

/** Type - Capitalization Definition Rules Rules for how capitalization is calculated for conversion purposes */
export interface CapitalizationDefinitionRules {
  /** Include outstanding shares in capitalization calculation */
  include_outstanding_shares?: boolean;
  /** Include outstanding options in capitalization calculation */
  include_outstanding_options?: boolean;
  /** Include outstanding unissued options in capitalization calculation */
  include_outstanding_unissued_options?: boolean;
  /** Include this security in capitalization calculation */
  include_this_security?: boolean;
  /** Include other converting securities in capitalization calculation */
  include_other_converting_securities?: boolean;
  /** Include option pool top-up for promised options */
  include_option_pool_topup_for_promised_options?: boolean;
  /** Include additional option pool top-up */
  include_additional_option_pool_topup?: boolean;
  /** Include new money in capitalization calculation */
  include_new_money?: boolean;
}

// ===== Warrant Conversion Mechanism Types =====

/** Warrant Conversion Mechanism - Custom Custom conversion description for non-standard warrant conversions */
export interface WarrantMechanismCustom {
  type: 'CUSTOM_CONVERSION';
  /** Description of custom conversion mechanism */
  custom_conversion_description: string;
}

/** Warrant Conversion Mechanism - Fixed Percent of Capitalization Converts to a fixed percentage of capitalization */
export interface WarrantMechanismPercentCapitalization {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  /** Percentage of capitalization to convert to (as decimal string, e.g., "0.05" for 5%) */
  converts_to_percent: string;
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

/** Warrant Conversion Mechanism - Fixed Amount Converts to a fixed quantity of shares */
export interface WarrantMechanismFixedAmount {
  type: 'FIXED_AMOUNT_CONVERSION';
  /** Fixed quantity of shares to convert to */
  converts_to_quantity: string;
}

/** Warrant Conversion Mechanism - Valuation Based Conversion based on company valuation */
export interface WarrantMechanismValuationBased {
  type: 'VALUATION_BASED_CONVERSION';
  /** Type of valuation (e.g., "409A", "FMV") */
  valuation_type?: string;
  /** Valuation amount */
  valuation_amount?: { amount: string; currency: string };
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

/** Warrant Conversion Mechanism - Share Price Based Conversion based on share price with optional discount */
export interface WarrantMechanismSharePriceBased {
  type: 'SHARE_PRICE_BASED_CONVERSION';
  /** Description of the share price basis */
  description?: string;
  /** Whether a discount applies */
  discount: boolean;
  /** Discount percentage (as decimal string, e.g., "0.20" for 20%) */
  discount_percentage?: string;
  /** Fixed discount amount */
  discount_amount?: { amount: string; currency: string };
}

/** Union type for all Warrant Conversion Mechanisms */
export type WarrantConversionMechanism =
  | WarrantMechanismCustom
  | WarrantMechanismPercentCapitalization
  | WarrantMechanismFixedAmount
  | WarrantMechanismValuationBased
  | WarrantMechanismSharePriceBased;

/** Warrant Conversion Right Describes the conversion rights associated with a warrant */
export interface WarrantConversionRight {
  type: 'WARRANT_CONVERSION_RIGHT';
  /** Mechanism by which conversion occurs */
  conversion_mechanism: WarrantConversionMechanism;
  /** Whether this converts to a future financing round */
  converts_to_future_round?: boolean;
  /** Stock class ID to convert to (if not future round) */
  converts_to_stock_class_id?: string;
}

/** Warrant Exercise Trigger Describes when and how a warrant can be exercised */
export interface WarrantExerciseTrigger {
  /** Type of trigger */
  type: ConversionTriggerType;
  /** Unique identifier for this trigger */
  trigger_id: string;
  /** Conversion right associated with this trigger */
  conversion_right: WarrantConversionRight;
  /** Human-readable nickname for the trigger */
  nickname?: string;
  /** Description of trigger conditions */
  trigger_description?: string;
  /** Date when trigger becomes active (YYYY-MM-DD) */
  trigger_date?: string;
  /** Condition that activates the trigger */
  trigger_condition?: string;
}

// ===== Convertible Conversion Mechanism Types =====

/** Convertible Conversion Mechanism - Custom Custom conversion description for non-standard conversions */
export interface ConvertibleMechanismCustom {
  type: 'CUSTOM_CONVERSION';
  /** Description of custom conversion mechanism */
  custom_conversion_description?: string;
}

/** Exit Multiple Ratio Represents a multiplier as a fraction */
export interface ExitMultiple {
  numerator: string;
  denominator: string;
}

/** Convertible Conversion Mechanism - SAFE Conversion terms for Simple Agreement for Future Equity */
export interface ConvertibleMechanismSafe {
  type: 'SAFE_CONVERSION';
  /** Whether Most Favored Nation clause applies */
  conversion_mfn: boolean;
  /** Discount on conversion (as decimal string, e.g., "0.20" for 20%) */
  conversion_discount?: string;
  /** Valuation cap for conversion */
  conversion_valuation_cap?: { amount: string; currency: string };
  /** Timing of conversion relative to financing */
  conversion_timing?: 'PRE_MONEY' | 'POST_MONEY';
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
  /** Exit multiple for liquidity events */
  exit_multiple?: ExitMultiple;
}

/** Convertible Conversion Mechanism - Fixed Percent of Capitalization */
export interface ConvertibleMechanismPercentCapitalization {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  /** Percentage of capitalization to convert to */
  converts_to_percent: string;
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

/** Convertible Conversion Mechanism - Fixed Amount */
export interface ConvertibleMechanismFixedAmount {
  type: 'FIXED_AMOUNT_CONVERSION';
  /** Fixed quantity to convert to */
  converts_to_quantity: string;
}

/** Convertible Conversion Mechanism - Valuation Based */
export interface ConvertibleMechanismValuationBased {
  type: 'VALUATION_BASED_CONVERSION';
  /** Type of valuation */
  valuation_type?: string;
  /** Valuation amount */
  valuation_amount?: { amount: string; currency: string };
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

/** Convertible Conversion Mechanism - Share Price Based */
export interface ConvertibleMechanismSharePriceBased {
  type: 'SHARE_PRICE_BASED_CONVERSION';
  /** Description of the share price basis */
  description?: string;
  /** Whether a discount applies */
  discount: boolean;
  /** Discount percentage */
  discount_percentage?: string;
  /** Fixed discount amount */
  discount_amount?: { amount: string; currency: string };
}

/** Interest Rate entry for Convertible Notes */
export interface ConvertibleInterestRate {
  /** Interest rate (as decimal string, e.g., "0.08" for 8%) */
  rate: string;
  /** Date interest starts accruing (YYYY-MM-DD) */
  accrual_start_date: string;
  /** Date interest stops accruing (YYYY-MM-DD) */
  accrual_end_date?: string;
}

/** Convertible Conversion Mechanism - Convertible Note Full conversion terms for convertible promissory notes */
export interface ConvertibleMechanismNote {
  type: 'CONVERTIBLE_NOTE_CONVERSION';
  /** Interest rate schedule */
  interest_rates: ConvertibleInterestRate[] | null;
  /** Day count convention for interest calculation */
  day_count_convention?: 'ACTUAL_365' | '30_360';
  /** How interest is paid */
  interest_payout?: 'DEFERRED' | 'CASH';
  /** Interest accrual period */
  interest_accrual_period?: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  /** Type of interest compounding */
  compounding_type?: 'SIMPLE' | 'COMPOUNDING';
  /** Discount on conversion */
  conversion_discount?: string;
  /** Valuation cap for conversion */
  conversion_valuation_cap?: { amount: string; currency: string };
  /** Description of capitalization definition */
  capitalization_definition?: string;
  /** Rules for capitalization calculation */
  capitalization_definition_rules?: CapitalizationDefinitionRules;
  /** Exit multiple for liquidity events */
  exit_multiple?: ExitMultiple | null;
  /** Whether Most Favored Nation clause applies */
  conversion_mfn?: boolean;
}

/** Union type for all Convertible Conversion Mechanisms */
export type ConvertibleConversionMechanism =
  | ConvertibleMechanismCustom
  | ConvertibleMechanismSafe
  | ConvertibleMechanismPercentCapitalization
  | ConvertibleMechanismFixedAmount
  | ConvertibleMechanismValuationBased
  | ConvertibleMechanismSharePriceBased
  | ConvertibleMechanismNote;

/** Convertible Conversion Right Describes the conversion rights associated with a convertible instrument */
export interface ConvertibleConversionRight {
  type: 'CONVERTIBLE_CONVERSION_RIGHT';
  /** Mechanism by which conversion occurs */
  conversion_mechanism: ConvertibleConversionMechanism;
  /** Whether this converts to a future financing round */
  converts_to_future_round?: boolean;
  /** Stock class ID to convert to (if not future round) */
  converts_to_stock_class_id?: string;
}

/** Convertible Conversion Trigger Describes when and how a convertible instrument can convert */
export interface ConvertibleConversionTrigger {
  /** Type of trigger */
  type: ConversionTriggerType;
  /** Unique identifier for this trigger */
  trigger_id: string;
  /** Conversion right associated with this trigger */
  conversion_right: ConvertibleConversionRight;
  /** Human-readable nickname for the trigger */
  nickname?: string;
  /** Description of trigger conditions */
  trigger_description?: string;
  /** Date when trigger becomes active (YYYY-MM-DD) */
  trigger_date?: string;
  /** Condition that activates the trigger */
  trigger_condition?: string;
}

/**
 * Enum - Rounding Type Rounding method for numeric values OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/RoundingType.schema.json
 */
export type RoundingType = 'DOWN' | 'UP' | 'NEAREST' | 'NORMAL';

/**
 * Enum - Authorized Shares Enumeration of special values for authorized shares when not using a numeric value OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/AuthorizedShares.schema.json
 */
export type AuthorizedShares = 'NOT_APPLICABLE' | 'UNLIMITED';

/**
 * Initial shares authorized type (can be either numeric or enum) Type representing the number of shares initially
 * authorized
 */
export type InitialSharesAuthorized = string;

/**
 * Type - Monetary Type representation of a money amount and currency OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Monetary.schema.json
 */
export interface Monetary {
  /** Amount of money in the given currency (decimal string, e.g. "100.00") */
  amount: string;
  /** Three-letter ISO currency code */
  currency: string;
}

/**
 * Type - Email Type representation of an email address OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/Email.schema.json
 */
export interface Email {
  /** Type of e-mail address (e.g. personal or business) */
  email_type: EmailType;
  /** A valid e-mail address */
  email_address: string;
}

/** Type - Address Type representation of an address */
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
 * Type - Tax ID Type representation of a tax identifier and issuing country OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/TaxID.schema.json
 */
export interface TaxId {
  /** Country code where the tax ID is issued (ISO 3166-1 alpha-2) */
  country: string;
  /** Tax identification string */
  tax_id: string;
}

/**
 * Stock Class Conversion Right (shared) OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/conversion_rights/StockClassConversionRight.schema.json
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
  /** Ratio components for RATIO_CONVERSION (decimal string) */
  ratio_numerator?: string;
  ratio_denominator?: string;
  /** Percent of capitalization this converts to ("0" < p <= "1", decimal string) */
  percent_of_capitalization?: string;
  /** Conversion price per share for fixed-amount conversion */
  conversion_price?: Monetary;
  /** Reference share price */
  reference_share_price?: Monetary;
  /** Reference valuation price per share */
  reference_valuation_price_per_share?: Monetary;
  /** Discount rate (0-1 decimal string) */
  discount_rate?: string;
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
 * Object - Issuer Object describing the issuer of the cap table (the company whose cap table this is). OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Issuer.schema.json
 */
export interface OcfIssuer {
  /** Identifier for the object */
  id: string;
  /** Legal name of the issuer */
  legal_name: string;
  /** Date of formation */
  formation_date: string;
  /** The country where the issuer company was legally formed (ISO 3166-1 alpha-2) */
  country_of_formation: string;
  /** Optional comments related to the issuer */
  comments?: string[];
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
 * Object - Stock Class Object describing a class of stock issued by the issuer OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/StockClass.schema.json
 */
export interface OcfStockClass {
  /** Identifier for the object */
  id: string;
  /** The type of this stock class (e.g. Preferred or Common) */
  class_type: StockClassType;
  /**
   * Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate IDs have a dash,
   * the prefix should end in the dash like CS-
   */
  default_id_prefix: string;
  /** The initial number of shares authorized for this stock class (numeric string or "UNLIMITED"/"NOT_APPLICABLE") */
  initial_shares_authorized: string;
  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;
  /**
   * Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so that stock
   * classes with a higher seniority have higher repayment priority. The following properties hold for all stock classes
   * for a given company: (a) transitivity: stock classes are absolutely stackable by seniority and in increasing
   * numerical order, (b) non-uniqueness: multiple stock classes can have the same Seniority number and therefore have
   * the same liquidation/repayment order. In practice, stock classes with same seniority may be created at different
   * points in time and (for example, an extension of an existing preferred financing round), and also a new stock class
   * can be created with seniority between two existing stock classes, in which case it is assigned some decimal number
   * between the numbers representing seniority of the respective classes.
   */
  seniority: string;
  /** The number of votes each share of this stock class gets */
  votes_per_share: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
  /** List of stock class conversion rights possible for this stock class */
  conversion_rights?: StockClassConversionRight[];
  /** Date on which the board approved the stock class */
  board_approval_date?: string;
  /** The liquidation preference per share for this stock class (decimal string) */
  liquidation_preference_multiple?: string;
  /** Per-share par value of this stock class */
  par_value?: Monetary;
  /** The participation cap multiple per share for this stock class (decimal string) */
  participation_cap_multiple?: string;
  /** Per-share price this stock class was issued for */
  price_per_share?: Monetary;
  /** Date on which the stockholders approved the stock class */
  stockholder_approval_date?: string;
}

/**
 * Enum - Stakeholder Type Stakeholder type (Individual or Institution) OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StakeholderType.schema.json
 */
export type StakeholderType = 'INDIVIDUAL' | 'INSTITUTION';

/**
 * Type - Contact Info OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ContactInfo.schema.json
 */
export interface ContactInfo {
  /** Contact name */
  name: Name;
  /** Phone numbers */
  phone_numbers?: Phone[];
  /** Email addresses */
  emails?: Email[];
}

/**
 * Type - Contact Info Without Name OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ContactInfoWithoutName.schema.json
 */
export interface ContactInfoWithoutName {
  /** Phone numbers */
  phone_numbers?: Phone[];
  /** Email addresses */
  emails?: Email[];
}

/**
 * Object - Stakeholder Object describing a stakeholder in the issuer's cap table OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Stakeholder.schema.json
 */
export interface OcfStakeholder {
  /** Identifier for the object */
  id: string;
  /** Stakeholder's name */
  name: Name;
  /** Stakeholder type (Individual or Institution) */
  stakeholder_type: StakeholderType;
  /** Alternate ID assigned by issuer */
  issuer_assigned_id?: string;
  /**
   * Deprecated singular relationship field (v1 compatibility).
   * Prefer `current_relationships`.
   */
  current_relationship?: StakeholderRelationshipType;
  /** Current relationship(s) to issuer */
  current_relationships?: StakeholderRelationshipType[];
  /** Current employment/engagement status */
  current_status?: StakeholderStatus;
  /** Primary contact information */
  primary_contact?: ContactInfo;
  /** Contact info without name */
  contact_info?: ContactInfoWithoutName;
  /** Mailing or legal addresses */
  addresses?: Address[];
  /** Tax identification numbers */
  tax_ids?: TaxId[];
  /** Unstructured comments */
  comments?: string[];
}

/**
 * Object - Stock Legend Template Object describing a stock legend template OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/StockLegendTemplate.schema.json
 */
export interface OcfStockLegendTemplate {
  /** Identifier for the object */
  id: string;
  /** Name for the stock legend template */
  name: string;
  /** The full text of the stock legend */
  text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Type - Object Reference A type representing a reference to any kind of OCF object OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ObjectReference.schema.json
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
 * Object - Document Object describing a document OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Document.schema.json
 */
export interface OcfDocument {
  /** Identifier for the object */
  id: string;
  /** Relative file path to the document within the OCF bundle */
  path?: string;
  /** External URI to the document (used when the file is hosted elsewhere) */
  uri?: string;
  /** MD5 hash of the document contents (32-character hex) */
  md5: string;
  /** References to related OCF objects */
  related_objects?: OcfObjectReference[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Enum - Valuation Type Enumeration of valuation types OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/ValuationType.schema.json
 */
export type ValuationType = '409A';

/**
 * Object - Valuation Object describing a valuation used in the cap table OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Valuation.schema.json
 */
export interface OcfValuation {
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
  /** Starting share number in the range (must be > 0, numeric string) */
  starting_share_number: string;
  /** Ending share number in the range (>= starting, numeric string) */
  ending_share_number: string;
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
  /** Number of shares, units, or amount vesting (decimal string) */
  amount: string;
}

export interface OcfStockIssuance {
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
  security_law_exemptions?: SecurityExemption[];
  /** Identifier of the stock class of the issued security */
  stock_class_id: string;
  /** Identifier for the stock plan, if applicable */
  stock_plan_id?: string;
  /** Share number ranges (if any) associated with this issuance */
  share_numbers_issued?: ShareNumberRange[];
  /** Price per share paid for the stock */
  share_price: Monetary;
  /** Quantity of shares issued (decimal string) */
  quantity: string;
  /** Reference to vesting terms object, if used instead of inline vestings */
  vesting_terms_id?: string;
  /** Vesting schedule entries associated directly with this issuance */
  vestings?: VestingSimple[];
  /** Cost basis for the shares issued */
  cost_basis?: Monetary;
  /** Stock legends that apply to this issuance (schema minItems: 1; implementation may allow empty) */
  stock_legend_ids?: string[];
  /** Type of stock issuance (e.g., RSA, Founders) */
  issuance_type?: StockIssuanceType;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
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

/**
 * Primitive - Vesting Period Type (Days/Months) Abstract type for periods of time; concrete days/months variants below.
 * OCF (primitive):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/vesting/VestingPeriod.schema.json
 * OCF (days):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingPeriodInDays.schema.json
 * OCF (months):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingPeriodInMonths.schema.json
 */
export type PeriodType = 'DAYS' | 'MONTHS';

/**
 * Allowed OCF day_of_month values for monthly vesting periods.
 */
export type VestingDayOfMonth =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
  | '22'
  | '23'
  | '24'
  | '25'
  | '26'
  | '27'
  | '28'
  | '29_OR_LAST_DAY_OF_MONTH'
  | '30_OR_LAST_DAY_OF_MONTH'
  | '31_OR_LAST_DAY_OF_MONTH'
  | 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH';

export interface VestingPeriodInDays {
  type: 'DAYS';
  length: number;
  occurrences: number;
  cliff_installment?: number;
}

export interface VestingPeriodInMonths {
  type: 'MONTHS';
  length: number;
  occurrences: number;
  day_of_month: VestingDayOfMonth;
  cliff_installment?: number;
}

export type VestingPeriod = VestingPeriodInDays | VestingPeriodInMonths;

/**
 * Primitive - Vesting Condition Trigger Type and specific triggers OCF (primitive):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/primitives/types/vesting/VestingConditionTrigger.schema.json
 * OCF (start):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingStartTrigger.schema.json
 * OCF (absolute):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingScheduleAbsoluteTrigger.schema.json
 * OCF (relative):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingScheduleRelativeTrigger.schema.json
 * OCF (event):
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/vesting/VestingEventTrigger.schema.json
 */
export type VestingTrigger =
  | { type: 'VESTING_START_DATE' }
  | { type: 'VESTING_SCHEDULE_ABSOLUTE'; date: string }
  | { type: 'VESTING_SCHEDULE_RELATIVE'; period: VestingPeriod; relative_to_condition_id: string }
  | { type: 'VESTING_EVENT' };

export interface VestingConditionPortion {
  /** Portion numerator (e.g., "25") */
  numerator: string;
  /** Portion denominator (e.g., "100") */
  denominator: string;
  /** If true, vest remainder after all integer tranches (optional; defaults to false in OCF schema) */
  remainder?: boolean;
}

export interface VestingCondition {
  /** Reference identifier for this condition (unique within the vesting terms) */
  id: string;
  /** Detailed description of the condition */
  description?: string;
  /** If specified, the fractional part of the whole security that vests */
  portion?: VestingConditionPortion;
  /** If specified, the fixed amount of the whole security to vest (decimal string) */
  quantity?: string;
  /** Describes how this vesting condition is met */
  trigger: VestingTrigger;
  /** List of ALL VestingCondition IDs that can trigger after this one */
  next_condition_ids: string[];
}

/**
 * Object - Vesting Terms Object describing the terms under which a security vests OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/VestingTerms.schema.json
 */
export interface OcfVestingTerms {
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
  comments?: string[];
}

// ===== Stock Plan Types =====

export type StockPlanCancellationBehavior =
  | 'RETIRE'
  | 'RETURN_TO_POOL'
  | 'HOLD_AS_CAPITAL_STOCK'
  | 'DEFINED_PER_PLAN_SECURITY';

export interface OcfStockPlan {
  id: string;
  /** Human-friendly name of the plan */
  plan_name: string;
  /** Date of board approval for the plan */
  board_approval_date?: string;
  /** Date of stockholder approval for the plan */
  stockholder_approval_date?: string;
  /** Initial number of shares reserved for the plan (decimal string) */
  initial_shares_reserved: string;
  /** Default cancellation behavior if not specified at the security level */
  default_cancellation_behavior?: StockPlanCancellationBehavior;
  /**
   * [DEPRECATED] Identifier of the StockClass object this plan is composed of.
   * Use `stock_class_ids` instead. Accepted for backward compatibility with older OCF data
   * that uses the deprecated singular field per the OCF StockPlan schema `oneOf`.
   */
  stock_class_id?: string;
  /** List of stock class ids associated with this plan (preferred over deprecated stock_class_id) */
  stock_class_ids?: string[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Equity Compensation Issuance Types =====

export type CompensationType = 'OPTION_NSO' | 'OPTION_ISO' | 'OPTION' | 'RSU' | 'CSAR' | 'SSAR';

export interface Vesting {
  /** Date when vesting occurs */
  date: string; // YYYY-MM-DD
  /** Number of shares, units, or amount vesting (decimal string) */
  amount: string;
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

export interface OcfEquityCompensationIssuance {
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
  /** Quantity granted/issued (decimal string) */
  quantity: string;
  /** Exercise price per share/unit */
  exercise_price?: Monetary;
  /** Base price used to value compensation (for SARs) */
  base_price?: Monetary;
  /** Whether early exercise is permitted */
  early_exercisable?: boolean;
  /** List of security law exemptions (and applicable jurisdictions) for this security */
  security_law_exemptions?: SecurityExemption[];
  /** Vesting events for the grant */
  vestings?: Vesting[];
  /** Expiration date of instrument */
  expiration_date?: string;
  /** Termination exercise windows after termination events */
  termination_exercise_windows?: TerminationWindow[];
  /** Unstructured text comments */
  comments?: string[];
}

// ===== Convertible & Warrant Issuance Types =====

export type ConvertibleType = 'NOTE' | 'SAFE' | 'SECURITY';
export type SimpleTrigger = 'AUTOMATIC' | 'OPTIONAL';

/**
 * Object - Convertible Issuance Transaction (native subset) Object describing convertible instrument issuance
 * transaction by the issuer and held by a stakeholder OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json
 */
export interface OcfConvertibleIssuance {
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
  /** Convertible - Conversion Trigger Array */
  conversion_triggers: ConvertibleConversionTrigger[];
  /** If different convertible instruments have seniority over one another, use this value to build a seniority stack */
  seniority: number;
  /** What pro-rata (if any) is the holder entitled to buy at the next round? (decimal string) */
  pro_rata?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Warrant Issuance Transaction (native subset) Object describing warrant issuance transaction by the issuer
 * and held by a stakeholder OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/WarrantIssuance.schema.json
 */
export interface OcfWarrantIssuance {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  /** Quantity of shares the warrant is exercisable for (decimal string) */
  quantity?: string;
  quantity_source?:
    | 'UNSPECIFIED'
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN';
  ratio_numerator?: string;
  ratio_denominator?: string;
  percent_of_outstanding?: string;
  /** The exercise price of the warrant */
  exercise_price?: Monetary;
  /** Actual purchase price of the warrant (sum up purported value of all consideration, including in-kind) */
  purchase_price: Monetary;
  /** Warrant Issuance - Exercise Trigger Array */
  exercise_triggers: WarrantExerciseTrigger[];
  /** What is expiration date of the warrant (if applicable) */
  warrant_expiration_date?: string;
  /** Identifier of the VestingTerms to which this security is subject */
  vesting_terms_id?: string;
  /** Conversion triggers for automatic warrant conversion */
  conversion_triggers?: WarrantExerciseTrigger[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

export interface OcfStockCancellation {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  balance_security_id?: string;
  reason_text: string;
  comments?: string[];
}

/**
 * Object - Warrant Cancellation Transaction Object describing a warrant cancellation transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/WarrantCancellation.schema.json
 */
export interface OcfWarrantCancellation {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being cancelled */
  security_id: string;
  /** Quantity of warrants being cancelled */
  quantity: string;
  /** Identifier for the security that holds the remainder balance (for partial cancellations) */
  balance_security_id?: string;
  /** Reason for the cancellation */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Convertible Cancellation Transaction Object describing a convertible cancellation transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/ConvertibleCancellation.schema.json
 */
export interface OcfConvertibleCancellation {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being cancelled */
  security_id: string;
  /** Amount of monetary value cancelled */
  amount: Monetary;
  /** Identifier for the security that holds the remainder balance (for partial cancellations) */
  balance_security_id?: string;
  /** Reason for the cancellation */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Equity Compensation Cancellation Transaction Object describing an equity compensation cancellation
 * transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/EquityCompensationCancellation.schema.json
 */
export interface OcfEquityCompensationCancellation {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being cancelled */
  security_id: string;
  /** Quantity of equity compensation being cancelled */
  quantity: string;
  /** Identifier for the security that holds the remainder balance (for partial cancellations) */
  balance_security_id?: string;
  /** Reason for the cancellation */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

export interface OcfIssuerAuthorizedSharesAdjustment {
  id: string;
  date: string;
  issuer_id: string;
  new_shares_authorized: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface OcfStockClassAuthorizedSharesAdjustment {
  id: string;
  date: string;
  stock_class_id: string;
  new_shares_authorized: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface OcfStockPlanPoolAdjustment {
  id: string;
  date: string;
  stock_plan_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  shares_reserved: string;
  comments?: string[];
}

export interface OcfEquityCompensationExercise {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  consideration_text?: string;
  resulting_security_ids: string[];
  comments?: string[];
}

/**
 * Object - Stock Transfer Transaction Object describing a transfer or secondary sale of a stock security OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/StockTransfer.schema.json
 */
export interface OcfStockTransfer {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being transferred */
  security_id: string;
  /** Quantity of non-monetary security units transferred */
  quantity: string;
  /** Array of identifiers for new securities created as a result of the transfer (min 1 item) */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial transfers) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security transfer */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Stock Repurchase Transaction Object describing a stock repurchase transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export interface OcfStockRepurchase {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being repurchased */
  security_id: string;
  /** Quantity of shares being repurchased */
  quantity: string;
  /** Price per share paid for repurchase */
  price: Monetary;
  /** Identifier for the security that holds the remainder balance (for partial repurchases) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security repurchase */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Transfer Transaction Types =====

/**
 * Object - Warrant Transfer Transaction Object describing a warrant transfer transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/WarrantTransfer.schema.json
 */
export interface OcfWarrantTransfer {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being transferred */
  security_id: string;
  /** Quantity of warrants being transferred */
  quantity: string;
  /** Array of identifiers for new securities created as a result of the transfer (min 1 item) */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial transfers) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security transfer */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Convertible Transfer Transaction Object describing a convertible transfer transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/ConvertibleTransfer.schema.json
 */
export interface OcfConvertibleTransfer {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being transferred */
  security_id: string;
  /** Amount of convertible being transferred */
  amount: Monetary;
  /** Array of identifiers for new securities created as a result of the transfer (min 1 item) */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial transfers) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security transfer */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Equity Compensation Transfer Transaction Object describing an equity compensation transfer transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/EquityCompensationTransfer.schema.json
 */
export interface OcfEquityCompensationTransfer {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being transferred */
  security_id: string;
  /** Quantity of equity compensation being transferred */
  quantity: string;
  /** Array of identifiers for new securities created as a result of the transfer (min 1 item) */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial transfers) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security transfer */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Acceptance Transaction Types =====

/**
 * Object - Stock Acceptance Transaction Object describing a stock acceptance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/acceptance/StockAcceptance.schema.json
 */
export interface OcfStockAcceptance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being accepted */
  security_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Warrant Acceptance Transaction Object describing a warrant acceptance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/acceptance/WarrantAcceptance.schema.json
 */
export interface OcfWarrantAcceptance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being accepted */
  security_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Convertible Acceptance Transaction Object describing a convertible acceptance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/acceptance/ConvertibleAcceptance.schema.json
 */
export interface OcfConvertibleAcceptance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being accepted */
  security_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Equity Compensation Acceptance Transaction Object describing an equity compensation acceptance transaction
 * OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/acceptance/EquityCompensationAcceptance.schema.json
 */
export interface OcfEquityCompensationAcceptance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being accepted */
  security_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Retraction Transaction Types =====

/**
 * Object - Stock Retraction Transaction Object describing a stock retraction transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/retraction/StockRetraction.schema.json
 */
export interface OcfStockRetraction {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being retracted */
  security_id: string;
  /** Reason for the retraction */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Warrant Retraction Transaction Object describing a warrant retraction transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/retraction/WarrantRetraction.schema.json
 */
export interface OcfWarrantRetraction {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being retracted */
  security_id: string;
  /** Reason for the retraction */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Convertible Retraction Transaction Object describing a convertible retraction transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/retraction/ConvertibleRetraction.schema.json
 */
export interface OcfConvertibleRetraction {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being retracted */
  security_id: string;
  /** Reason for the retraction */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Equity Compensation Retraction Transaction Object describing an equity compensation retraction transaction
 * OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/retraction/EquityCompensationRetraction.schema.json
 */
export interface OcfEquityCompensationRetraction {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being retracted */
  security_id: string;
  /** Reason for the retraction */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Exercise Transaction Types =====

/**
 * Object - Warrant Exercise Transaction Object describing a warrant exercise transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/WarrantExercise.schema.json
 */
export interface OcfWarrantExercise {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the warrant security being exercised */
  security_id: string;
  /** Identifier for the warrant's exercise trigger that resulted in this exercise */
  trigger_id: string;
  /** Quantity of warrants being exercised */
  quantity: string;
  /** Array of identifiers for new securities resulting from the exercise */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial exercises) */
  balance_security_id?: string;
  /** Unstructured text description of consideration provided in exchange for security exercise */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Conversion Transaction Types =====

/**
 * Object - Stock Conversion Transaction Object describing a stock conversion transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/StockConversion.schema.json
 */
export interface OcfStockConversion {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the stock security being converted */
  security_id: string;
  /** Quantity of stock being converted */
  quantity: string;
  /** Array of identifiers for new securities resulting from the conversion */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial conversions) */
  balance_security_id?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Convertible Conversion Transaction Object describing a convertible conversion transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export interface OcfConvertibleConversion {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the convertible security being converted */
  security_id: string;
  /** Array of identifiers for new securities resulting from the conversion */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial conversions) */
  balance_security_id?: string;
  /** Identifier of the trigger that caused conversion */
  trigger_id?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Release Transaction Types =====

/**
 * Object - Equity Compensation Release Transaction Object describing an equity compensation release transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/release/EquityCompensationRelease.schema.json
 */
export interface OcfEquityCompensationRelease {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the equity compensation security being released */
  security_id: string;
  /** Quantity of equity compensation being released */
  quantity: string;
  /** Array of identifiers for new securities resulting from the release */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial releases) */
  balance_security_id?: string;
  /** Settlement date for the release */
  settlement_date?: string;
  /** Unstructured text description of consideration provided */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Vesting Transaction Types =====

/**
 * Object - Vesting Start Transaction Object describing the start of vesting for a security OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/vesting/VestingStart.schema.json
 */
export interface OcfVestingStart {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security whose vesting is starting */
  security_id: string;
  /** ID of the vesting condition that is satisfied by this vesting start event */
  vesting_condition_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Vesting Event Transaction Object describing a vesting event for a security OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/vesting/VestingEvent.schema.json
 */
export interface OcfVestingEvent {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security whose vesting event is occurring */
  security_id: string;
  /** ID of the vesting condition that is satisfied by this vesting event */
  vesting_condition_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Vesting Acceleration Transaction Object describing a vesting acceleration for a security OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/vesting/VestingAcceleration.schema.json
 */
export interface OcfVestingAcceleration {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security whose vesting is being accelerated */
  security_id: string;
  /** Quantity of shares/units being accelerated */
  quantity: string;
  /** Reason for the vesting acceleration */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Stock Class Adjustment Transaction Types =====

/**
 * Object - Stock Class Split Transaction Object describing a stock class split transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/adjustment/StockClassSplit.schema.json
 */
export interface OcfStockClassSplit {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the stock class being split */
  stock_class_id: string;
  /** Split ratio - numerator (e.g., "2" for a 2-for-1 split) */
  split_ratio_numerator: string;
  /** Split ratio - denominator (e.g., "1" for a 2-for-1 split) */
  split_ratio_denominator: string;
  /** Date on which the board approved the split */
  board_approval_date?: string;
  /** Date on which stockholders approved the split */
  stockholder_approval_date?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Stock Class Conversion Ratio Adjustment Transaction Object describing a conversion ratio adjustment OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/adjustment/StockClassConversionRatioAdjustment.schema.json
 */
export interface OcfStockClassConversionRatioAdjustment {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the stock class whose conversion ratio is being adjusted */
  stock_class_id: string;
  /** New conversion ratio - numerator (decimal string) */
  new_ratio_numerator: string;
  /** New conversion ratio - denominator (decimal string) */
  new_ratio_denominator: string;
  /** Date on which the board approved the adjustment */
  board_approval_date?: string;
  /** Date on which stockholders approved the adjustment */
  stockholder_approval_date?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Stock Plan Return To Pool Transaction Object describing shares returned to the stock plan pool OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/adjustment/StockPlanReturnToPool.schema.json
 */
export interface OcfStockPlanReturnToPool {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the stock plan to which shares are being returned */
  stock_plan_id: string;
  /** Quantity of shares being returned to the pool */
  quantity: string;
  /** Reason for shares returning to pool */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Other Stock Transaction Types =====

/**
 * Object - Stock Reissuance Transaction Object describing a stock reissuance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/reissuance/StockReissuance.schema.json
 */
export interface OcfStockReissuance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being reissued */
  security_id: string;
  /** Array of identifiers for new securities resulting from the reissuance */
  resulting_security_ids: string[];
  /** Reason for the reissuance */
  reason_text?: string;
  /** Reference to a related split transaction */
  split_transaction_id?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Stock Consolidation Transaction Object describing a stock consolidation transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/consolidation/StockConsolidation.schema.json
 */
export interface OcfStockConsolidation {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Array of identifiers for securities being consolidated */
  security_ids: string[];
  /** Array of identifiers for new securities resulting from the consolidation */
  resulting_security_ids: string[];
  /** Reason for the consolidation */
  reason_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Equity Compensation Repricing =====

/**
 * Object - Equity Compensation Repricing Transaction Object describing an equity compensation repricing transaction
 * OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/repricing/EquityCompensationRepricing.schema.json
 */
export interface OcfEquityCompensationRepricing {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being repriced */
  security_id: string;
  /** Array of identifiers for new securities resulting from the repricing */
  resulting_security_ids: string[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Plan Security Transaction Types =====

/**
 * Object - Plan Security Issuance Transaction Object describing a plan security issuance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/issuance/PlanSecurityIssuance.schema.json
 */
export interface OcfPlanSecurityIssuance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the security being issued */
  security_id: string;
  /** A custom ID for this security */
  custom_id: string;
  /** Identifier for the stakeholder receiving the security */
  stakeholder_id: string;
  /** Identifier for the stock plan */
  stock_plan_id: string;
  /** Identifier for the stock class */
  stock_class_id?: string;
  /** Type of plan security */
  plan_security_type: 'OPTION' | 'RSU' | 'OTHER';
  /** Quantity of plan securities being issued */
  quantity: string;
  /** Exercise price per share/unit */
  exercise_price?: Monetary;
  /** Identifier for the vesting terms */
  vesting_terms_id?: string;
  /** Date on which the board approved the issuance */
  board_approval_date?: string;
  /** Date on which stockholders approved the issuance */
  stockholder_approval_date?: string;
  /** Unstructured text description of consideration */
  consideration_text?: string;
  /** Security law exemptions */
  security_law_exemptions?: SecurityExemption[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Exercise Transaction Object describing a plan security exercise transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/exercise/PlanSecurityExercise.schema.json
 */
export interface OcfPlanSecurityExercise {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being exercised */
  security_id: string;
  /** Quantity being exercised */
  quantity: string;
  /** Array of identifiers for new securities resulting from the exercise */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial exercises) */
  balance_security_id?: string;
  /** Unstructured text description of consideration */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Cancellation Transaction Object describing a plan security cancellation transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/PlanSecurityCancellation.schema.json
 */
export interface OcfPlanSecurityCancellation {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being cancelled */
  security_id: string;
  /** Quantity being cancelled */
  quantity: string;
  /** Identifier for the security that holds the remainder balance (for partial cancellations) */
  balance_security_id?: string;
  /** Reason for the cancellation */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Acceptance Transaction Object describing a plan security acceptance transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/acceptance/PlanSecurityAcceptance.schema.json
 */
export interface OcfPlanSecurityAcceptance {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being accepted */
  security_id: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Release Transaction Object describing a plan security release transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/release/PlanSecurityRelease.schema.json
 */
export interface OcfPlanSecurityRelease {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being released */
  security_id: string;
  /** Quantity being released */
  quantity: string;
  /** Array of identifiers for new securities resulting from the release */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial releases) */
  balance_security_id?: string;
  /** Settlement date for the release */
  settlement_date?: string;
  /** Unstructured text description of consideration */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Retraction Transaction Object describing a plan security retraction transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/retraction/PlanSecurityRetraction.schema.json
 */
export interface OcfPlanSecurityRetraction {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being retracted */
  security_id: string;
  /** Reason for the retraction */
  reason_text: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Plan Security Transfer Transaction Object describing a plan security transfer transaction OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/PlanSecurityTransfer.schema.json
 */
export interface OcfPlanSecurityTransfer {
  /** Identifier for the object */
  id: string;
  /** Date on which the transaction occurred */
  date: string;
  /** Identifier for the plan security being transferred */
  security_id: string;
  /** Quantity being transferred */
  quantity: string;
  /** Array of identifiers for new securities resulting from the transfer */
  resulting_security_ids: string[];
  /** Identifier for the security that holds the remainder balance (for partial transfers) */
  balance_security_id?: string;
  /** Unstructured text description of consideration */
  consideration_text?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Financing Object Type =====

/**
 * Object - Financing Object describing a financing round OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/Financing.schema.json
 */
export interface OcfFinancing {
  /** Identifier for the object */
  id: string;
  /** Name of the financing round */
  round_name: string;
  /** Date the financing round was announced or closed */
  financing_date: string;
  /** Type of financing round */
  financing_type?:
    | 'PRE_SEED'
    | 'SEED'
    | 'SERIES_A'
    | 'SERIES_B'
    | 'SERIES_C'
    | 'SERIES_D'
    | 'SERIES_E'
    | 'SERIES_F'
    | 'BRIDGE'
    | 'CONVERTIBLE_NOTE'
    | 'SAFE'
    | 'OTHER';
  /** Total amount raised in this financing round */
  amount_raised?: Monetary;
  /** Pre-money valuation */
  pre_money_valuation?: Monetary;
  /** Post-money valuation */
  post_money_valuation?: Monetary;
  /** Identifier for the stock class created or used in this financing */
  stock_class_id?: string;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

// ===== Stakeholder Change Event Types =====

/**
 * Type - Stakeholder Relationship Type The type of relationship a stakeholder has with the issuer OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StakeholderRelationshipType.schema.json
 */
export type StakeholderRelationshipType =
  | 'EMPLOYEE'
  | 'ADVISOR'
  | 'INVESTOR'
  | 'FOUNDER'
  | 'BOARD_MEMBER'
  | 'OFFICER'
  | 'OTHER';

/**
 * Type - Stakeholder Status The current status of a stakeholder's engagement with the issuer OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/enums/StakeholderStatus.schema.json
 */
export type StakeholderStatus =
  | 'ACTIVE'
  | 'LEAVE_OF_ABSENCE'
  | 'TERMINATION_VOLUNTARY_OTHER'
  | 'TERMINATION_VOLUNTARY_GOOD_CAUSE'
  | 'TERMINATION_VOLUNTARY_RETIREMENT'
  | 'TERMINATION_INVOLUNTARY_OTHER'
  | 'TERMINATION_INVOLUNTARY_DEATH'
  | 'TERMINATION_INVOLUNTARY_DISABILITY'
  | 'TERMINATION_INVOLUNTARY_WITH_CAUSE';

/**
 * Object - Stakeholder Relationship Change Event Object describing a change in a stakeholder's relationship with the
 * issuer OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/events/StakeholderRelationshipChangeEvent.schema.json
 */
export interface OcfStakeholderRelationshipChangeEvent {
  /** Identifier for the object */
  id: string;
  /** Date on which the event occurred */
  date: string;
  /** Identifier for the stakeholder whose relationship is changing */
  stakeholder_id: string;
  /** New relationship type(s) for the stakeholder */
  new_relationships: StakeholderRelationshipType[];
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}

/**
 * Object - Stakeholder Status Change Event Object describing a change in a stakeholder's status with the issuer OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/events/StakeholderStatusChangeEvent.schema.json
 */
export interface OcfStakeholderStatusChangeEvent {
  /** Identifier for the object */
  id: string;
  /** Date on which the event occurred */
  date: string;
  /** Identifier for the stakeholder whose status is changing */
  stakeholder_id: string;
  /** New status for the stakeholder */
  new_status: StakeholderStatus;
  /** Unstructured text comments related to and stored for the object */
  comments?: string[];
}
