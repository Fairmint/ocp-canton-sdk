/**
 * Details about a contract that needs to be disclosed for cross-domain
 * contract interactions in Canton.
 * 
 * This interface is used when a contract from one domain needs to be
 * referenced in a transaction on another domain.
 */
export interface ContractDetails {
  /** The contract ID of the contract */
  contractId: string;
  /** The serialized created event blob of the contract */
  createdEventBlob: string;
  /** The synchronizer ID associated with the contract */
  synchronizerId: string;
  /** The template ID of the contract */
  templateId: string;
}
