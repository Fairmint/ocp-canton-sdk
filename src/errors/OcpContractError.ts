import { OcpErrorCodes, type OcpErrorCode } from './codes';
import { boundedDiagnosticText, toSafeDiagnosticContext } from './diagnostics';
import { contextOrUndefined, OcpError, type OcpErrorContext } from './OcpError';

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
  /** Structured failure classification override */
  classification?: string;
  /** Additional structured diagnostics context */
  context?: OcpErrorContext;
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
  readonly contractId: string | undefined;

  /** The DAML template ID */
  readonly templateId: string | undefined;

  /** The choice being exercised when the error occurred */
  readonly choice: string | undefined;

  constructor(message: string, options?: OcpContractErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.CHOICE_FAILED;
    const contractId =
      typeof options?.contractId === 'string' ? boundedDiagnosticText(options.contractId, 256) : undefined;
    const templateId =
      typeof options?.templateId === 'string' ? boundedDiagnosticText(options.templateId, 256) : undefined;
    const choice = typeof options?.choice === 'string' ? boundedDiagnosticText(options.choice, 256) : undefined;
    const context: OcpErrorContext =
      options?.context === undefined ? {} : { ...toSafeDiagnosticContext(options.context) };
    if (contractId !== undefined) {
      context.contractId = contractId;
    }
    if (templateId !== undefined) {
      context.templateId = templateId;
    }
    if (choice !== undefined) {
      context.choice = choice;
    }
    const errorContext = contextOrUndefined(context);
    super(message, code, options?.cause, {
      classification: options?.classification ?? 'contract_error',
      ...(errorContext !== undefined ? { context: errorContext } : {}),
    });
    this.name = 'OcpContractError';
    this.contractId = contractId;
    this.templateId = templateId;
    this.choice = choice;
    Object.defineProperties(this, {
      choice: { enumerable: false },
      contractId: { enumerable: false },
      templateId: { enumerable: false },
    });
  }
}
