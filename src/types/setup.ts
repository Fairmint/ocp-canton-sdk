/**
 * Native types of the OpenCapTable-v35 three-step cap table setup: `system_operator`'s authorization, the transfer
 * agent's acceptance, then the issuer's creation of the cap table.
 *
 * Field names of ledger state mirrored here keep their Daml names where the type mirrors a contract; call parameters
 * are camelCase. No type here refers to the generated Daml bindings.
 *
 * @module
 */

import type { CommandWithDisclosedContracts, DisclosedContract, SubmitAndWaitForTransactionResponse } from './common';

/**
 * The identity of an `OcpFactory`.
 *
 * Every `OcpFactory_AuthorizeIssuer` consumes the factory and recreates it with the next cap table number, so no
 * contract ID names it for long. The live contract is found by a template query filtered on these fields.
 */
export interface OcpFactoryIdentity {
  /** The factory's `factory_id`: non-empty with no `:`, since a derived ID is a cap table ID, a colon and a hash */
  readonly factoryId: string;
  /** The party that signs the factory (`system_operator`) */
  readonly systemOperator: string;
  /** Override for a ledger whose `OcpFactory` template ID differs from the SDK's bundled default */
  readonly templateId?: string;
}

/** A factory identity as the bundled `ocp-factory-contract-id.json` records it, with the file's own field names. */
export interface BundledOcpFactoryIdentity {
  readonly templateId: string;
  readonly system_operator: string;
  readonly factory_id: string;
}

/** The factory identities the Daml package ships, by network. A network is absent until its factory exists. */
export interface BundledOcpFactoryIdentities {
  readonly devnet?: BundledOcpFactoryIdentity;
  readonly mainnet?: BundledOcpFactoryIdentity;
}

/** The one live `OcpFactory` contract an identity names. */
export interface LiveOcpFactory {
  readonly contractId: string;
  /** The template ID the ledger reports for the contract */
  readonly templateId: string;
  readonly factoryId: string;
  readonly systemOperator: string;
  /** The number the next cap table gets; its ID is `<factoryId>-<nextCapTableNumber>` */
  readonly nextCapTableNumber: number;
}

/** Result of creating an `OcpFactory`. */
export interface CreateFactoryResult {
  readonly contractId: string;
  readonly templateId: string;
  readonly factoryId: string;
  readonly systemOperator: string;
  readonly updateId: string;
}

/** Result of `system_operator`'s authorization of an issuer. */
export interface AuthorizeIssuerResult {
  readonly updateId: string;
  /** The recreated factory: pass it as `factoryContractId` to authorize the next issuer without a lookup */
  readonly factoryContractId: string;
  /** The `IssuerAuthorization`, not yet accepted by the transfer agent */
  readonly authorizationContractId: string;
  /** The template ID the ledger reports for the authorization */
  readonly authorizationTemplateId: string;
  /** The cap table's ID, `<factory_id>-<n>` */
  readonly capTableId: string;
  readonly response: SubmitAndWaitForTransactionResponse;
}

/**
 * A transfer-agent-accepted `IssuerAuthorization`: what the issuer's `IssuerAuthorization_CreateCapTable` needs, with
 * the authorization's context. It carries the fields of a disclosed contract, since the issuer only observes the
 * authorization.
 */
export interface IssuerAuthorizationRef extends DisclosedContract {
  /** The cap table's ID, `<factory_id>-<n>` */
  readonly capTableId: string;
  /** The party that submits `IssuerAuthorization_CreateCapTable` */
  readonly issuer: string;
  readonly systemOperator: string;
  /** The transfer agent the authorization pins */
  readonly transferAgent: string;
}

/** Result of the transfer agent's acceptance. */
export interface AcceptIssuerAuthorizationResult {
  readonly updateId: string;
  /** The recreated authorization, signed by `system_operator` and the transfer agent */
  readonly authorization: IssuerAuthorizationRef;
  readonly response: SubmitAndWaitForTransactionResponse;
}

/**
 * The issuer's `IssuerAuthorization_CreateCapTable`, ready to submit: `disclosedContracts` holds the authorization,
 * which the issuer only observes.
 */
export interface CreateCapTableCommand extends CommandWithDisclosedContracts {
  /** The issuer: the only controller of the choice */
  readonly actAs: string[];
}

/** What `IssuerAuthorization_CreateCapTable` created. */
export interface CreateCapTableResult {
  /** The `CapTable` anchor, in Active status */
  readonly capTableContractId: string;
  /** The `Issuer` record, whose ID is claimed */
  readonly issuerContractId: string;
  /** The 256 initial ID shards' contract IDs, by 8-bit prefix, in prefix order (`00000000` to `11111111`) */
  readonly shards: ReadonlyMap<string, string>;
}

/** Result of withdrawing an authorization. */
export interface WithdrawAuthorizationResult {
  readonly updateId: string;
  readonly response: SubmitAndWaitForTransactionResponse;
}
