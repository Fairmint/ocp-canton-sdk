import type { DisclosedContract } from '../../../types/common';
import type { OcfIssuer } from '../../../types/native';

/** Issuer input accepted by the high-level CreateCapTable command builder. */
export type IssuerDataInput = Omit<OcfIssuer, 'tax_ids'> & {
  /** Tax IDs are normalized to an empty array when omitted or null. */
  tax_ids?: OcfIssuer['tax_ids'] | null;
};

/** Parameters for creating the issuer and its CapTable. */
export interface CreateIssuerParams {
  /** IssuerAuthorization contract disclosed to the CreateCapTable choice. */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** Issuer party authorizing creation. */
  issuerParty: string;
  /** Canonical OCF issuer payload. */
  issuerData: IssuerDataInput;
}
