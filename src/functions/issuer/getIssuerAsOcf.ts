import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

/**
 * OCF Issuer object according to the Open Cap Table Coalition schema
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 */
export interface OcfIssuer {
  object_type: 'ISSUER';
  legal_name: string;
  dba?: string;
  formation_date?: string; // ISO 8601 date string (YYYY-MM-DD)
  country_of_formation: string; // ISO 3166-1 alpha-2 country code
  country_subdivision_of_formation?: string;
  tax_ids?: Array<{
    tax_id_type: string;
    tax_id: string;
  }>;
  email?: {
    email_type: 'PERSONAL' | 'BUSINESS';
    email_address: string;
  };
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  initial_shares_authorized?: string | number;
  id?: string;
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
  
  // Transform DAML issuer data to OCF format
  const ocfIssuer: OcfIssuer = {
    object_type: 'ISSUER',
    legal_name: issuerData.legal_name || '',
    country_of_formation: issuerData.country_of_formation || '',
    // Optional fields
    ...(issuerData.dba && { dba: issuerData.dba }),
    ...(issuerData.formation_date && { formation_date: issuerData.formation_date }),
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
        ...(issuerData.address.line1 && { line1: toUndefined(issuerData.address.line1) }),
        ...(issuerData.address.line2 && { line2: toUndefined(issuerData.address.line2) }),
        ...(issuerData.address.city && { city: toUndefined(issuerData.address.city) }),
        ...(issuerData.address.state && { state: toUndefined(issuerData.address.state) }),
        ...(issuerData.address.postal_code && { postal_code: toUndefined(issuerData.address.postal_code) }),
        ...(issuerData.address.country && { country: toUndefined(issuerData.address.country) })
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
