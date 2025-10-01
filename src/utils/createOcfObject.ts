import { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';
import { CommandWithDisclosedContracts } from '../types';
import { LedgerJsonApiClient, findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface CreateOcfObjectParams {
  /** Contract ID of the Issuer contract */
  issuerContractId: string;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  /** The party that will act as the issuer */
  issuerParty: string;
  /** The OCF data to create - object_type field will determine which create function to call */
  ocfData: { object_type: string; [key: string]: unknown };
  /** Optional: Contract ID of a previous version to archive before creating the new one */
  previousContractId?: string;
}

export interface CreateOcfObjectResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Builds command(s) for creating OCF objects based on their object_type.
 * 
 * This function inspects the object_type field in the OCF data and routes to the
 * appropriate buildCreate*Command function. If previousContractId is provided,
 * it will also build an archive command for the old contract.
 * 
 * Returns an array of commands and their disclosed contracts that can be used
 * in a batch or executed directly.
 * 
 * Note: ISSUER object_type is not supported as it has different input requirements.
 * Use client.issuer.buildCreateIssuerCommand() directly for creating issuers.
 * 
 * @example
 * ```typescript
 * // Create new object
 * const commands = client.buildCreateOcfObjectCommand({
 *   issuerContractId: 'issuer-contract-id',
 *   featuredAppRightContractDetails: featuredAppRight,
 *   issuerParty: 'party::issuer',
 *   ocfData: {
 *     object_type: 'STAKEHOLDER',
 *     id: 'stakeholder-1',
 *     name: { legal_name: 'John Doe' },
 *     stakeholder_type: 'INDIVIDUAL'
 *   }
 * });
 * 
 * // Archive old and create new
 * const commands = client.buildCreateOcfObjectCommand({
 *   issuerContractId: 'issuer-contract-id',
 *   featuredAppRightContractDetails: featuredAppRight,
 *   issuerParty: 'party::issuer',
 *   previousContractId: 'old-contract-id',
 *   ocfData: { ... }
 * });
 * ```
 * 
 * @param params - Parameters for building the OCF object command(s)
 * @returns Array of commands with their disclosed contracts
 */
export type BuildCreateOcfObjectCommandFunction = (params: CreateOcfObjectParams) => CommandWithDisclosedContracts[];

export function buildCreateOcfObjectCommandFactory(client: any): BuildCreateOcfObjectCommandFunction {
  return (params: CreateOcfObjectParams): CommandWithDisclosedContracts[] => {
    const { issuerContractId, featuredAppRightContractDetails, issuerParty, ocfData, previousContractId } = params;
    
    const commands: CommandWithDisclosedContracts[] = [];
    
    // If previousContractId is provided, add archive command first
    if (previousContractId) {
      const archiveCommand = buildArchiveCommand(client, params.ocfData.object_type, {
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        contractId: previousContractId
      });
      commands.push(archiveCommand);
    }

    // Build create command
    const createCommand = (() => {
      switch (ocfData.object_type) {
        case 'ISSUER':
          throw new Error('ISSUER object_type is not supported by buildCreateOcfObjectCommand. Use client.issuer.buildCreateIssuerCommand() directly.');

        case 'STOCK_CLASS':
          return client.stockClass.buildCreateStockClassCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stockClassData: ocfData
          });

        case 'STAKEHOLDER':
          return client.stakeholder.buildCreateStakeholderCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stakeholderData: ocfData
          });

        case 'STOCK_LEGEND_TEMPLATE':
          return client.stockLegendTemplate.buildCreateStockLegendTemplateCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            templateData: ocfData
          });

        case 'VESTING_TERMS':
          return client.vestingTerms.buildCreateVestingTermsCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            vestingTermsData: ocfData
          });

        case 'STOCK_PLAN':
          return client.stockPlan.buildCreateStockPlanCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            planData: ocfData
          });

        case 'TX_STOCK_ISSUANCE':
          return client.stockIssuance.buildCreateStockIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData
          });

        case 'TX_STOCK_CANCELLATION':
          return client.stockCancellation.buildCreateStockCancellationCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            cancellationData: ocfData
          });

        case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.issuerAuthorizedSharesAdjustment.buildCreateIssuerAuthorizedSharesAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData
          });

        case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.stockClassAuthorizedSharesAdjustment.buildCreateStockClassAuthorizedSharesAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData
          });

        case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
          return client.stockPlanPoolAdjustment.buildCreateStockPlanPoolAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData
          });

        case 'TX_EQUITY_COMPENSATION_ISSUANCE':
          return client.stockPlan.buildCreateEquityCompensationIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData
          });

        case 'TX_EQUITY_COMPENSATION_EXERCISE':
          return client.stockPlan.buildCreateEquityCompensationExerciseCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            exerciseData: ocfData
          });

        case 'DOCUMENT':
          return client.document.buildCreateDocumentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            documentData: ocfData
          });

        case 'TX_WARRANT_ISSUANCE':
          return client.warrantIssuance.buildCreateWarrantIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData
          });

        case 'TX_CONVERTIBLE_ISSUANCE':
          return client.convertibleIssuance.buildCreateConvertibleIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData
          });

        default:
          throw new Error(`Unsupported object type: ${ocfData.object_type}`);
      }
    })();
    
    commands.push(createCommand);
    return commands;
  };
}

/**
 * Builds an archive command for the given object type.
 */
function buildArchiveCommand(
  client: any,
  objectType: string,
  params: {
    issuerContractId: string;
    featuredAppRightContractDetails: DisclosedContract;
    issuerParty: string;
    contractId: string;
  }
): CommandWithDisclosedContracts {
  const { issuerContractId, featuredAppRightContractDetails, issuerParty, contractId } = params;
  
  // Archive commands follow pattern: archive*ByIssuer with buildArchive*ByIssuerCommand
  switch (objectType) {
    case 'STOCK_CLASS': {
      return client.stockClass.buildArchiveStockClassByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockClassContractId: contractId
      });
    }
    case 'STAKEHOLDER': {
      return client.stakeholder.buildArchiveStakeholderByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stakeholderContractId: contractId
      });
    }
    case 'STOCK_LEGEND_TEMPLATE': {
      return client.stockLegendTemplate.buildArchiveStockLegendTemplateByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockLegendTemplateContractId: contractId
      });
    }
    case 'VESTING_TERMS': {
      return client.vestingTerms.buildArchiveVestingTermsByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        vestingTermsContractId: contractId
      });
    }
    case 'STOCK_PLAN': {
      return client.stockPlan.buildArchiveStockPlanByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockPlanContractId: contractId
      });
    }
    case 'TX_STOCK_ISSUANCE': {
      return client.stockIssuance.buildArchiveStockIssuanceByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockIssuanceContractId: contractId
      });
    }
    case 'TX_STOCK_CANCELLATION': {
      return client.stockCancellation.buildArchiveStockCancellationByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockCancellationContractId: contractId
      });
    }
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT': {
      return client.issuerAuthorizedSharesAdjustment.buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        issuerAuthorizedSharesAdjustmentContractId: contractId
      });
    }
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT': {
      return client.stockClassAuthorizedSharesAdjustment.buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockClassAuthorizedSharesAdjustmentContractId: contractId
      });
    }
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT': {
      return client.stockPlanPoolAdjustment.buildArchiveStockPlanPoolAdjustmentByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        stockPlanPoolAdjustmentContractId: contractId
      });
    }
    case 'DOCUMENT': {
      return client.document.buildArchiveDocumentByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        documentContractId: contractId
      });
    }
    case 'TX_WARRANT_ISSUANCE': {
      return client.warrantIssuance.buildArchiveWarrantIssuanceByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        warrantIssuanceContractId: contractId
      });
    }
    case 'TX_CONVERTIBLE_ISSUANCE': {
      return client.convertibleIssuance.buildArchiveConvertibleIssuanceByIssuerCommand({
        issuerContractId,
        featuredAppRightContractDetails,
        issuerParty,
        convertibleIssuanceContractId: contractId
      });
    }
    default:
      throw new Error(`Archive not supported for object type: ${objectType}`);
  }
}

/**
 * Template ID mapping for OCF object types to their corresponding Daml template IDs.
 * Used to find the created contract in the transaction tree response.
 */
function getTemplateIdForObjectType(objectType: string): string {
  switch (objectType) {
    case 'STOCK_CLASS':
      return Fairmint.OpenCapTable.StockClass.StockClass.templateId;
    case 'STAKEHOLDER':
      return Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId;
    case 'STOCK_LEGEND_TEMPLATE':
      return Fairmint.OpenCapTable.StockLegendTemplate.StockLegendTemplate.templateId;
    case 'VESTING_TERMS':
      return Fairmint.OpenCapTable.VestingTerms.VestingTerms.templateId;
    case 'STOCK_PLAN':
      return Fairmint.OpenCapTable.StockPlan.StockPlan.templateId;
    case 'TX_STOCK_ISSUANCE':
      return Fairmint.OpenCapTable.StockIssuance.StockIssuance.templateId;
    case 'TX_STOCK_CANCELLATION':
      return Fairmint.OpenCapTable.StockCancellation.StockCancellation.templateId;
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
      return Fairmint.OpenCapTable.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId;
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
      return Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId;
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
      return Fairmint.OpenCapTable.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId;
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
      return Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance.templateId;
    case 'TX_EQUITY_COMPENSATION_EXERCISE':
      return Fairmint.OpenCapTable.EquityCompensationExercise.EquityCompensationExercise.templateId;
    case 'DOCUMENT':
      return Fairmint.OpenCapTable.Document.Document.templateId;
    case 'TX_WARRANT_ISSUANCE':
      return Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance.templateId;
    case 'TX_CONVERTIBLE_ISSUANCE':
      return Fairmint.OpenCapTable.ConvertibleIssuance.ConvertibleIssuance.templateId;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

/**
 * Creates an OCF object by building the command(s) and executing them in a batch transaction.
 * 
 * This function uses buildCreateOcfObjectCommand internally and then submits the
 * command(s) to the ledger. If previousContractId is provided, it will archive the
 * old contract and create the new one in a single batch transaction.
 * 
 * Note: ISSUER object_type is not supported as it has different input requirements.
 * Use client.issuer.createIssuer() directly for creating issuers.
 * 
 * @example
 * ```typescript
 * // Create new object
 * const result = await client.createOcfObject({
 *   issuerContractId: 'issuer-contract-id',
 *   featuredAppRightContractDetails: featuredAppRight,
 *   issuerParty: 'party::issuer',
 *   ocfData: {
 *     object_type: 'STAKEHOLDER',
 *     id: 'stakeholder-1',
 *     name: { legal_name: 'John Doe' },
 *     stakeholder_type: 'INDIVIDUAL'
 *   }
 * });
 * 
 * // Archive old and create new in one transaction
 * const result = await client.createOcfObject({
 *   issuerContractId: 'issuer-contract-id',
 *   featuredAppRightContractDetails: featuredAppRight,
 *   issuerParty: 'party::issuer',
 *   previousContractId: 'old-contract-id',
 *   ocfData: { ... }
 * });
 * ```
 * 
 * @param params - Parameters for creating the OCF object
 * @returns Promise resolving to the result of the object creation
 */
export type CreateOcfObjectFunction = (params: CreateOcfObjectParams) => Promise<CreateOcfObjectResult>;

export function createOcfObjectFactory(client: any): CreateOcfObjectFunction {
  const buildCommands = buildCreateOcfObjectCommandFactory(client);
  
  return async (params: CreateOcfObjectParams): Promise<CreateOcfObjectResult> => {
    const commandsWithDisclosed = buildCommands(params);
    
    // Collect all commands and disclosed contracts
    const commands = commandsWithDisclosed.map(c => c.command);
    const allDisclosedContracts = commandsWithDisclosed.flatMap(c => c.disclosedContracts);
    
    // Remove duplicate disclosed contracts (same contractId)
    const uniqueDisclosedContracts = Array.from(
      new Map(allDisclosedContracts.map(dc => [dc.contractId, dc])).values()
    );
    
    const response = await client.client.submitAndWaitForTransactionTree({
      actAs: [params.issuerParty],
      commands,
      disclosedContracts: uniqueDisclosedContracts
    }) as SubmitAndWaitForTransactionTreeResponse;

    const templateId = getTemplateIdForObjectType(params.ocfData.object_type);
    const created = findCreatedEventByTemplateId(response, templateId);
    
    if (!created) {
      throw new Error('Expected CreatedTreeEvent not found');
    }

    return {
      contractId: created.CreatedTreeEvent.value.contractId,
      updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId,
      response
    };
  };
}
