import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';
import type { OcpClient } from '../OcpClient';
import type {
  CommandWithDisclosedContracts,
  OcfConvertibleIssuanceDataNative,
  OcfDocumentData,
  OcfEquityCompensationExerciseTxData,
  OcfEquityCompensationIssuanceData,
  OcfIssuerAuthorizedSharesAdjustmentTxData,
  OcfStakeholderData,
  OcfStockCancellationTxData,
  OcfStockClassAuthorizedSharesAdjustmentTxData,
  OcfStockClassData,
  OcfStockIssuanceData,
  OcfStockLegendTemplateData,
  OcfStockPlanData,
  OcfStockPlanPoolAdjustmentTxData,
  OcfVestingTermsData,
  OcfWarrantIssuanceDataNative,
} from '../types';

export interface CreateOcfObjectParams {
  /** Contract ID of the Issuer contract */
  issuerContractId: string;
  /** Details of the Issuer contract for disclosed contracts (required when previousContractId is provided) */
  issuerContractDetails?: DisclosedContract;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  /** The party that will act as the issuer */
  issuerParty: string;
  /** The OCF data to create - object_type field will determine which create function to call */
  ocfData: { object_type: string; [key: string]: unknown };
  /** Optional: Contract ID of a previous version to archive before creating the new one */
  previousContractId?: string;
}

/**
 * Builds command(s) for creating OCF objects based on their object_type.
 *
 * This function inspects the object_type field in the OCF data and routes to the appropriate buildCreate*Command
 * function. If previousContractId is provided, it will also build an archive command for the old contract.
 *
 * Returns an array of commands and their disclosed contracts that can be used in a batch or executed directly.
 *
 * Note: ISSUER object_type is not supported as it has different input requirements. Use
 * client.issuer.buildCreateIssuerCommand() directly for creating issuers.
 *
 * @example
 *   ```typescript
 *   // Create new object
 *   const commands = client.buildCreateOcfObjectCommand({
 *     issuerContractId: 'issuer-contract-id',
 *     featuredAppRightContractDetails: featuredAppRight,
 *     issuerParty: 'party::issuer',
 *     ocfData: {
 *       object_type: 'STAKEHOLDER',
 *       id: 'stakeholder-1',
 *       name: { legal_name: 'John Doe' },
 *       stakeholder_type: 'INDIVIDUAL'
 *     }
 *   });
 *
 *   // Archive old and create new
 *   const commands = client.buildCreateOcfObjectCommand({
 *     issuerContractId: 'issuer-contract-id',
 *     featuredAppRightContractDetails: featuredAppRight,
 *     issuerParty: 'party::issuer',
 *     previousContractId: 'old-contract-id',
 *     ocfData: { ... }
 *   });
 *   ```;
 *
 * @param params - Parameters for building the OCF object command(s)
 * @returns Array of commands with their disclosed contracts
 */
export type BuildCreateOcfObjectCommandFunction = (params: CreateOcfObjectParams) => CommandWithDisclosedContracts[];

export function buildCreateOcfObjectCommandFactory(client: OcpClient): BuildCreateOcfObjectCommandFunction {
  return (params: CreateOcfObjectParams): CommandWithDisclosedContracts[] => {
    const {
      issuerContractId,
      issuerContractDetails,
      featuredAppRightContractDetails,
      issuerParty,
      ocfData,
      previousContractId,
    } = params;

    const commands: CommandWithDisclosedContracts[] = [];

    // If previousContractId is provided, add archive command first
    if (previousContractId) {
      if (!issuerContractDetails) {
        throw new Error(
          'issuerContractDetails is required when previousContractId is provided (needed for disclosed contracts in archive command)'
        );
      }
      const archiveCommand = buildArchiveCommand(client, params.ocfData.object_type, {
        issuerContractDetails,
        featuredAppRightContractDetails,
        issuerParty,
        contractId: previousContractId,
      });
      commands.push(archiveCommand);
    }

    // Build create command
    const createCommand = (() => {
      switch (ocfData.object_type) {
        case 'ISSUER':
          throw new Error(
            'ISSUER object_type is not supported by buildCreateOcfObjectCommand. Use client.issuer.buildCreateIssuerCommand() directly.'
          );

        case 'STOCK_CLASS':
          return client.OpenCapTable.stockClass.buildCreateStockClassCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stockClassData: ocfData as unknown as OcfStockClassData,
          });

        case 'STAKEHOLDER':
          return client.OpenCapTable.stakeholder.buildCreateStakeholderCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stakeholderData: ocfData as unknown as OcfStakeholderData,
          });

        case 'STOCK_LEGEND_TEMPLATE':
          return client.OpenCapTable.stockLegendTemplate.buildCreateStockLegendTemplateCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            templateData: ocfData as unknown as OcfStockLegendTemplateData,
          });

        case 'VESTING_TERMS':
          return client.OpenCapTable.vestingTerms.buildCreateVestingTermsCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            vestingTermsData: ocfData as unknown as OcfVestingTermsData,
          });

        case 'STOCK_PLAN':
          return client.OpenCapTable.stockPlan.buildCreateStockPlanCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            planData: ocfData as unknown as OcfStockPlanData,
          });

        case 'TX_STOCK_ISSUANCE':
          return client.OpenCapTable.stockIssuance.buildCreateStockIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as unknown as OcfStockIssuanceData,
          });

        case 'TX_STOCK_CANCELLATION':
          return client.OpenCapTable.stockCancellation.buildCreateStockCancellationCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            cancellationData: ocfData as unknown as OcfStockCancellationTxData,
          });

        case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.OpenCapTable.issuerAuthorizedSharesAdjustment.buildCreateIssuerAuthorizedSharesAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData as unknown as OcfIssuerAuthorizedSharesAdjustmentTxData,
          });

        case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.OpenCapTable.stockClassAuthorizedSharesAdjustment.buildCreateStockClassAuthorizedSharesAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData as unknown as OcfStockClassAuthorizedSharesAdjustmentTxData,
          });

        case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
          return client.OpenCapTable.stockPlanPoolAdjustment.buildCreateStockPlanPoolAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData as unknown as OcfStockPlanPoolAdjustmentTxData,
          });

        case 'TX_EQUITY_COMPENSATION_ISSUANCE':
          return client.OpenCapTable.equityCompensationIssuance.buildCreateEquityCompensationIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as unknown as OcfEquityCompensationIssuanceData,
          });

        case 'TX_EQUITY_COMPENSATION_EXERCISE':
          return client.OpenCapTable.equityCompensationExercise.buildCreateEquityCompensationExerciseCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            exerciseData: ocfData as unknown as OcfEquityCompensationExerciseTxData,
          });

        case 'DOCUMENT':
          return client.OpenCapTable.document.buildCreateDocumentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            documentData: ocfData as unknown as OcfDocumentData,
          });

        case 'TX_WARRANT_ISSUANCE':
          return client.OpenCapTable.warrantIssuance.buildCreateWarrantIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            // @ts-expect-error - exercise_triggers and conversion_triggers type mismatch: using unknown[] to avoid complex recursive types
            issuanceData: ocfData as unknown as OcfWarrantIssuanceDataNative,
          });

        case 'TX_CONVERTIBLE_ISSUANCE':
          return client.OpenCapTable.convertibleIssuance.buildCreateConvertibleIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            // @ts-expect-error - conversion_triggers type mismatch: using unknown[] to avoid complex recursive type
            issuanceData: ocfData as unknown as OcfConvertibleIssuanceDataNative,
          });

        default:
          throw new Error(`Unsupported object type: ${ocfData.object_type}`);
      }
    })();

    commands.push(createCommand);
    return commands;
  };
}

/** Builds an archive command for the given object type. */
function buildArchiveCommand(
  client: OcpClient,
  objectType: string,
  params: {
    issuerContractDetails: DisclosedContract;
    featuredAppRightContractDetails: DisclosedContract;
    issuerParty: string;
    contractId: string;
  }
): CommandWithDisclosedContracts {
  const { issuerContractDetails, featuredAppRightContractDetails, issuerParty: _issuerParty, contractId } = params;

  // Archive commands need disclosed contracts for both the issuer and featured app right
  const disclosedContracts = [issuerContractDetails, featuredAppRightContractDetails];

  // Build the basic archive command - all archive functions just need contractId
  switch (objectType) {
    case 'STOCK_CLASS':
      return {
        command: client.OpenCapTable.stockClass.buildArchiveStockClassByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STAKEHOLDER':
      return {
        command: client.OpenCapTable.stakeholder.buildArchiveStakeholderByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STOCK_LEGEND_TEMPLATE':
      return {
        command: client.OpenCapTable.stockLegendTemplate.buildArchiveStockLegendTemplateByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'VESTING_TERMS':
      return {
        command: client.OpenCapTable.vestingTerms.buildArchiveVestingTermsByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STOCK_PLAN':
      return {
        command: client.OpenCapTable.stockPlan.buildArchiveStockPlanByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_STOCK_ISSUANCE':
      return {
        command: client.OpenCapTable.stockIssuance.buildArchiveStockIssuanceByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_STOCK_CANCELLATION':
      return {
        command: client.OpenCapTable.stockCancellation.buildArchiveStockCancellationByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
      return {
        command: client.OpenCapTable.issuerAuthorizedSharesAdjustment.buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
      return {
        command:
          client.OpenCapTable.stockClassAuthorizedSharesAdjustment.buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand({
            contractId,
          }),
        disclosedContracts,
      };
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
      return {
        command: client.OpenCapTable.stockPlanPoolAdjustment.buildArchiveStockPlanPoolAdjustmentByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'DOCUMENT':
      return {
        command: client.OpenCapTable.document.buildArchiveDocumentByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_WARRANT_ISSUANCE':
      return {
        command: client.OpenCapTable.warrantIssuance.buildArchiveWarrantIssuanceByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_CONVERTIBLE_ISSUANCE':
      return {
        command: client.OpenCapTable.convertibleIssuance.buildArchiveConvertibleIssuanceByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    default:
      throw new Error(`Archive not supported for object type: ${objectType}`);
  }
}
