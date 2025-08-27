/**
 * Clean TypeScript types that provide a better developer experience
 * compared to the raw DAML types. These types use simple string literals
 * for enums and standard TypeScript objects for complex types.
 */

/** Email type */
export type EmailType = 'PERSONAL' | 'BUSINESS';

/** Address type */
export type AddressType = 'LEGAL' | 'CONTACT' | 'OTHER';

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

/** Initial shares authorized (can be numeric or special enum value) */
export type InitialSharesAuthorized = number | string | AuthorizedShares;

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

/** Tax ID object */
export interface TaxId {
  /** Type of tax identifier */
  tax_id_type: string;
  /** The tax identification number */
  tax_id: string;
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
  /** One share of this stock class converts into this many target stock class shares (required for RATIO_CONVERSION) */
  ratio: number;
  /** What is the effective conversion price per share of this stock class? (required for RATIO_CONVERSION) */
  conversion_price: Monetary;
  /** How should fractional shares be rounded? (required for RATIO_CONVERSION) */
  rounding_type: RoundingType;
  /** Expiration date after which the conversion right is no longer valid (optional) */
  expires_at?: Date;
}

/** OCF Issuer Data */
export interface OcfIssuerData {
  /** Legal name of the issuer */
  legal_name: string;
  /** The country where the issuer company was legally formed (ISO 3166-1 alpha-2) */
  country_of_formation: string;
  /** Doing Business As name */
  dba?: string;
  /** Date of formation */
  formation_date?: Date;
  /** The state, province, or subdivision where the issuer company was legally formed */
  country_subdivision_of_formation?: string;
  /** The tax ids for this issuer company */
  tax_ids?: TaxId[];
  /** A work email that the issuer company can be reached at */
  email?: Email;
  /** A phone number that the issuer company can be reached at */
  phone?: string;
  /** The headquarters address of the issuing company */
  address?: Address;
  /** The initial number of shares authorized for this issuer */
  initial_shares_authorized?: string | number;
}

/** OCF Stock Class Data */
export interface OcfStockClassData {
  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;
  /** The type of this stock class */
  class_type: StockClassType;
  /** Default prefix for certificate numbers */
  default_id_prefix: string;
  /** The initial number of shares authorized for this stock class */
  initial_shares_authorized: InitialSharesAuthorized;
  /** The number of votes each share of this stock class gets */
  votes_per_share: string | number;
  /** Seniority of the stock - determines repayment priority */
  seniority: string | number;
  /** Date on which the board approved the stock class */
  board_approval_date?: Date;
  /** Date on which the stockholders approved the stock class */
  stockholder_approval_date?: Date;
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
}
