import { OcpErrorCodes, type OcpErrorCode } from './codes';
import { OcpError } from './OcpError';

export interface OcpContractErrorOptions {
  /** The contract ID involved in the error */
  contractId?: string;
  /** The DAML template ID */
  templateId?: string;
  /** The choice being exercised when the error occurred */
  choice?: string;
  /** The original error that caused this error */
  cause?: Error;
  /** Specific contract error code (defaults to CHOICE_FAILED) */
  code?: OcpErrorCode;
}

/**
 * Errors from Canton/DAML contract interactions.
 *
 * Thrown when contract operations fail, such as exercising a choice,
 * fetching contract data, or when expected results are not found in
 * transaction trees.
 *
 * @example
 * ```typescript
 * throw new OcpContractError('UpdateCapTable result not found in transaction tree', {
 *   contractId: capTableContractId,
 *   choice: 'UpdateCapTable',
 *   code: OcpErrorCodes.RESULT_NOT_FOUND,
 * });
 * ```
 *
 * @example Catching contract errors
 * ```typescript
 * try {
 *   await ocp.OpenCapTable.capTable.update(...).execute();
 * } catch (error) {
 *   if (error instanceof OcpContractError) {
 *     console.error(`Contract error on ${error.choice}: ${error.message}`);
 *     console.error(`Contract ID: ${error.contractId}`);
 *   }
 * }
 * ```
 */
export class OcpContractError extends OcpError {
  /** The contract ID involved in the error */
  readonly contractId?: string;

  /** The DAML template ID */
  readonly templateId?: string;

  /** The choice being exercised when the error occurred */
  readonly choice?: string;

  constructor(message: string, options?: OcpContractErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.CHOICE_FAILED;
    super(message, code, options?.cause);
    this.name = 'OcpContractError';
    this.contractId = options?.contractId;
    this.templateId = options?.templateId;
    this.choice = options?.choice;
  }
}
