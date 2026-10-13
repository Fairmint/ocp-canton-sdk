import type { DisclosedContract } from '../../../types/common';
import type { OcfIssuer } from '../../../types/native';

/** Canonical issuer input accepted by the high-level CreateCapTable command builder. */
export type IssuerDataInput = OcfIssuer;

/** Parameters for creating the issuer and its CapTable. */
export interface CreateIssuerParams {
  /** IssuerAuthorization contract disclosed to the CreateCapTable choice. */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** Issuer party authorizing creation. */
  issuerParty: string;
  /** Canonical OCF issuer payload. */
  issuerData: IssuerDataInput;
}
