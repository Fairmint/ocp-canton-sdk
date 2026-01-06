import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, EmailType, IssuerOcfData, PhoneType } from '../../../types';
import { addressToDaml, cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
  switch (emailType) {
    case 'PERSONAL':
      return 'OcfEmailTypePersonal';
    case 'BUSINESS':
      return 'OcfEmailTypeBusiness';
    case 'OTHER':
      return 'OcfEmailTypeOther';
    default: {
      const exhaustiveCheck: never = emailType;
      throw new Error(`Unknown email type: ${exhaustiveCheck as string}`);
    }
  }
}

function emailToDaml(email: IssuerOcfData['email']): Fairmint.OpenCapTable.Types.OcfEmail | null {
  if (!email) return null;
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address,
  };
}

function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
  switch (phoneType) {
    case 'HOME':
      return 'OcfPhoneHome';
    case 'MOBILE':
      return 'OcfPhoneMobile';
    case 'BUSINESS':
      return 'OcfPhoneBusiness';
    case 'OTHER':
      return 'OcfPhoneOther';
    default: {
      const exhaustiveCheck: never = phoneType;
      throw new Error(`Unknown phone type: ${exhaustiveCheck as string}`);
    }
  }
}

function phoneToDaml(phone: IssuerOcfData['phone']): Fairmint.OpenCapTable.Types.OcfPhone | null {
  if (!phone) return null;
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function issuerDataToDaml(issuerData: IssuerOcfData): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData {
  if (!issuerData.id) throw new Error('issuerData.id is required');
  return {
    id: issuerData.id,
    legal_name: issuerData.legal_name,
    country_of_formation: issuerData.country_of_formation,
    dba: optionalString(issuerData.dba),
    formation_date: dateStringToDAMLTime(issuerData.formation_date),
    country_subdivision_of_formation: optionalString(issuerData.country_subdivision_of_formation),
    country_subdivision_name_of_formation: optionalString(issuerData.country_subdivision_name_of_formation),
    tax_ids: issuerData.tax_ids,
    email: issuerData.email ? emailToDaml(issuerData.email) : null,
    phone: issuerData.phone ? phoneToDaml(issuerData.phone) : null,
    address: issuerData.address ? addressToDaml(issuerData.address) : null,
    initial_shares_authorized:
      issuerData.initial_shares_authorized !== undefined
        ? ((): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData['initial_shares_authorized'] => {
            const v = issuerData.initial_shares_authorized;
            if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))) {
              return {
                tag: 'OcfInitialSharesNumeric',
                value: typeof v === 'number' ? v.toString() : v,
              };
            }
            if (v === 'UNLIMITED') {
              return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesUnlimited' };
            }
            return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesNotApplicable' };
          })()
        : null,
    comments: cleanComments(issuerData.comments),
  };
}

export interface CreateIssuerParams {
  /** Details of the IssuerAuthorization contract for disclosed contracts */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  /**
   * Issuer data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
   *
   * - Legal_name: Legal name of the issuer
   * - Formation_date: Date of formation (YYYY-MM-DD)
   * - Country_of_formation: Country of formation (ISO 3166-1 alpha-2)
   * - Dba (optional): Doing Business As name
   * - Country_subdivision_of_formation (optional): Subdivision code of formation (ISO 3166-2)
   * - Country_subdivision_name_of_formation (optional): Text name of subdivision of formation
   * - Tax_ids (optional): Issuer tax IDs
   * - Email (optional): Work email
   * - Phone (optional): Phone number in ITU E.123 format
   * - Address (optional): Headquarters address
   * - Initial_shares_authorized (optional): Initial authorized shares (enum or numeric)
   * - Comments (optional): Additional comments
   */
  issuerData: IssuerOcfData;
}

export function buildCreateIssuerCommand(params: CreateIssuerParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.IssuerAuthorization.CreateCapTable = {
    issuer_data: issuerDataToDaml(params.issuerData),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      choice: 'CreateCapTable',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.issuerAuthorizationContractDetails.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      createdEventBlob: params.issuerAuthorizationContractDetails.createdEventBlob,
      synchronizerId: params.issuerAuthorizationContractDetails.synchronizerId,
    },
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
