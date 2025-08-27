import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlTimeToDateString } from '../../utils/typeConversions';

/**
 * OCF Issuer object according to the Open Cap Table Coalition schema
 * Object describing the issuer of the cap table (the company whose cap table this is)
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 */
export interface OcfIssuer {
  /** Object type identifier - must be "ISSUER" */
  object_type: 'ISSUER';
  
  /** Legal name of the issuer */
  legal_name: string;
  
  /** Doing Business As name */
  dba?: string;
  
  /** Date of formation (YYYY-MM-DD format) */
  formation_date?: string;
  
  /** The country where the issuer company was legally formed (ISO 3166-1 alpha-2) */
  country_of_formation: string;
  
  /** The state, province, or subdivision where the issuer company was legally formed */
  country_subdivision_of_formation?: string;
  
  /** The tax ids for this issuer company */
  tax_ids?: Array<{
    /** Tax identifier as string */
    tax_id: string;
    /** Issuing country code (ISO 3166-1 alpha-2) for the tax identifier */
    country: string;
  }>;
  
  /** A work email that the issuer company can be reached at */
  email?: {
    /** Type of email address (personal or business) */
    email_type: 'PERSONAL' | 'BUSINESS';
    /** The email address */
    email_address: string;
  };
  
  /** A phone number that the issuer company can be reached at */
  phone?: string;
  
  /** The headquarters address of the issuing company */
  address?: {
    /** What type of address is this (e.g. legal address, contact address, etc.) */
    address_type: 'LEGAL' | 'CONTACT' | 'OTHER';
    /** Street address (multi-line string) */
    street_suite?: string;
    /** City */
    city?: string;
    /** State, province, or equivalent identifier required for an address in this country */
    country_subdivision?: string;
    /** Country code for this address (ISO 3166-1 alpha-2) */
    country: string;
    /** Address postal code */
    postal_code?: string;
  };
  
  /** The initial number of shares authorized for this issuer */
  initial_shares_authorized?: string | number;
  
  /** Unique identifier for the issuer object */
  id?: string;
  
  /** Additional comments or notes about the issuer */
  comments?: string[];
}

export interface GetIssuerAsOcfParams {
  /** Contract ID of the Issuer contract to retrieve */
  contractId: string;
}

export interface GetIssuerAsOcfResult {
  /** The OCF Issuer object */
  issuer: OcfIssuer;
  /** The original contract ID */
  contractId: string;
}

/**
 * Retrieve an issuer contract by ID and return it as an OCF JSON object
 * 
 * This function fetches the issuer contract data from the ledger and transforms it
 * into the Open Cap Table Coalition (OCF) format according to the official schema.
 * 
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 * 
 * @example
 * ```typescript
 * const result = await getIssuerAsOcf(client, {
 *   contractId: "1234567890abcdef"
 * });
 * 
 * console.log(result.issuer);
 * // {
 * //   object_type: "ISSUER",
 * //   legal_name: "My Company Inc.",
 * //   country_of_formation: "US",
 * //   formation_date: "2020-01-15",
 * //   // ... other fields
 * // }
 * ```
 * 
 * @param client - The ledger JSON API client
 * @param params - Parameters for retrieving the issuer
 * @returns Promise resolving to the OCF Issuer object
 */
export async function getIssuerAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAsOcfParams
): Promise<GetIssuerAsOcfResult> {
  // Get the events for the Issuer contract
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.contractId
  });
  
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  
  // Type guard to ensure we have the expected issuer data structure
  function hasIssuerData(arg: unknown): arg is { issuer_data: Fairmint.OpenCapTable.Types.OcfIssuerData } {
    return typeof arg === 'object' && 
           arg !== null && 
           'issuer_data' in arg &&
           typeof (arg as any).issuer_data === 'object';
  }
  
  if (!hasIssuerData(createArgument)) {
    throw new Error('Issuer data not found in contract create argument');
  }
  
  const issuerData = createArgument.issuer_data;
  
  // Helper function to convert DAML Optional to JavaScript undefined
  const toUndefined = <T>(value: T | null): T | undefined => value === null ? undefined : value;
  
  // Helper function to convert DAML email type to OCF schema email type
  const convertEmailType = (damlEmailType: Fairmint.OpenCapTable.Types.OcfEmailType): 'PERSONAL' | 'BUSINESS' => {
    switch (damlEmailType) {
      case 'OcfEmailTypePersonal':
        return 'PERSONAL';
      case 'OcfEmailTypeBusiness':
        return 'BUSINESS';
      default:
        throw new Error(`Unknown email type: ${damlEmailType}`);
    }
  };

  // Helper function to convert DAML address type to OCF schema address type
  const convertAddressType = (damlAddressType: Fairmint.OpenCapTable.Types.OcfAddressType): 'LEGAL' | 'CONTACT' | 'OTHER' => {
    switch (damlAddressType) {
      case 'OcfAddressTypeLegal':
        return 'LEGAL';
      case 'OcfAddressTypeContact':
        return 'CONTACT';
      case 'OcfAddressTypeOther':
        return 'OTHER';
      default:
        throw new Error(`Unknown address type: ${damlAddressType}`);
    }
  };
  
  // Transform DAML issuer data to OCF format
  const ocfIssuer: OcfIssuer = {
    object_type: 'ISSUER',
    legal_name: issuerData.legal_name || '',
    country_of_formation: issuerData.country_of_formation || '',
    // Optional fields
    ...(issuerData.dba && { dba: issuerData.dba }),
    ...(issuerData.formation_date && { formation_date: damlTimeToDateString(issuerData.formation_date) }),
    ...(issuerData.country_subdivision_of_formation && { 
      country_subdivision_of_formation: issuerData.country_subdivision_of_formation 
    }),
    ...(issuerData.tax_ids && { tax_ids: issuerData.tax_ids }),
    ...(issuerData.email && { 
      email: {
        email_type: convertEmailType(issuerData.email.email_type),
        email_address: issuerData.email.email_address
      }
    }),
    ...(issuerData.phone && { phone: issuerData.phone }),
    ...(issuerData.address && { 
      address: {
        address_type: convertAddressType(issuerData.address.address_type),
        ...(issuerData.address.street_suite && { street_suite: toUndefined(issuerData.address.street_suite) }),
        ...(issuerData.address.city && { city: toUndefined(issuerData.address.city) }),
        ...(issuerData.address.country_subdivision && { country_subdivision: toUndefined(issuerData.address.country_subdivision) }),
        country: toUndefined(issuerData.address.country) || issuerData.country_of_formation, // Use country_of_formation as fallback
        ...(issuerData.address.postal_code && { postal_code: toUndefined(issuerData.address.postal_code) })
      }
    }),
    ...(issuerData.initial_shares_authorized && { 
      initial_shares_authorized: issuerData.initial_shares_authorized 
    }),
    // Use contract ID as the OCF object ID
    id: params.contractId
  };
  
  return {
    issuer: ocfIssuer,
    contractId: params.contractId
  };
}
