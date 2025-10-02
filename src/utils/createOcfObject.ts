import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcpClient } from '../OcpClient';
import type { CommandWithDisclosedContracts } from '../types';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';

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
export type BuildCreateOcfObjectCommandFunction = (
  params: CreateOcfObjectParams
) => CommandWithDisclosedContracts[];

export function buildCreateOcfObjectCommandFactory(
  client: OcpClient
): BuildCreateOcfObjectCommandFunction {
  return (params: CreateOcfObjectParams): CommandWithDisclosedContracts[] => {
    const {
      issuerContractId,
      featuredAppRightContractDetails,
      issuerParty,
      ocfData,
      previousContractId,
    } = params;

    const commands: CommandWithDisclosedContracts[] = [];

    // If previousContractId is provided, add archive command first
    if (previousContractId) {
      const archiveCommand = buildArchiveCommand(client, params.ocfData.object_type, {
        issuerContractId,
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
          return client.stockClass.buildCreateStockClassCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stockClassData: ocfData as any,
          });

        case 'STAKEHOLDER':
          return client.stakeholder.buildCreateStakeholderCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            stakeholderData: ocfData as any,
          });

        case 'STOCK_LEGEND_TEMPLATE':
          return client.stockLegendTemplate.buildCreateStockLegendTemplateCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            templateData: ocfData as any,
          });

        case 'VESTING_TERMS':
          return client.vestingTerms.buildCreateVestingTermsCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            vestingTermsData: ocfData as any,
          });

        case 'STOCK_PLAN':
          return client.stockPlan.buildCreateStockPlanCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            planData: ocfData as any,
          });

        case 'TX_STOCK_ISSUANCE':
          return client.stockIssuance.buildCreateStockIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as any,
          });

        case 'TX_STOCK_CANCELLATION':
          return client.stockCancellation.buildCreateStockCancellationCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            cancellationData: ocfData as any,
          });

        case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.issuerAuthorizedSharesAdjustment.buildCreateIssuerAuthorizedSharesAdjustmentCommand(
            {
              issuerContractId,
              featuredAppRightContractDetails,
              issuerParty,
              adjustmentData: ocfData as any,
            }
          );

        case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
          return client.stockClassAuthorizedSharesAdjustment.buildCreateStockClassAuthorizedSharesAdjustmentCommand(
            {
              issuerContractId,
              featuredAppRightContractDetails,
              issuerParty,
              adjustmentData: ocfData as any,
            }
          );

        case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
          return client.stockPlanPoolAdjustment.buildCreateStockPlanPoolAdjustmentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            adjustmentData: ocfData as any,
          });

        case 'TX_EQUITY_COMPENSATION_ISSUANCE':
          return client.stockPlan.buildCreateEquityCompensationIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as any,
          });

        case 'TX_EQUITY_COMPENSATION_EXERCISE':
          return client.stockPlan.buildCreateEquityCompensationExerciseCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            exerciseData: ocfData as any,
          });

        case 'DOCUMENT':
          return client.document.buildCreateDocumentCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            documentData: ocfData as any,
          });

        case 'TX_WARRANT_ISSUANCE':
          return client.warrantIssuance.buildCreateWarrantIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as any,
          });

        case 'TX_CONVERTIBLE_ISSUANCE':
          return client.convertibleIssuance.buildCreateConvertibleIssuanceCommand({
            issuerContractId,
            featuredAppRightContractDetails,
            issuerParty,
            issuanceData: ocfData as any,
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

  // Archive commands just need the basic command - disclosed contracts come from the issuer
  const disclosedContracts = [
    {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: issuerContractId,
      createdEventBlob: '',
      synchronizerId: '',
    },
    featuredAppRightContractDetails,
  ];

  // Build the basic archive command - all archive functions just need contractId
  switch (objectType) {
    case 'STOCK_CLASS':
      return {
        command: client.stockClass.buildArchiveStockClassByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STAKEHOLDER':
      return {
        command: client.stakeholder.buildArchiveStakeholderByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STOCK_LEGEND_TEMPLATE':
      return {
        command: client.stockLegendTemplate.buildArchiveStockLegendTemplateByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'VESTING_TERMS':
      return {
        command: client.vestingTerms.buildArchiveVestingTermsByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'STOCK_PLAN':
      return {
        command: client.stockPlan.buildArchiveStockPlanByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_STOCK_ISSUANCE':
      return {
        command: client.stockIssuance.buildArchiveStockIssuanceByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_STOCK_CANCELLATION':
      return {
        command: client.stockCancellation.buildArchiveStockCancellationByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
      return {
        command:
          client.issuerAuthorizedSharesAdjustment.buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(
            { contractId }
          ),
        disclosedContracts,
      };
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
      return {
        command:
          client.stockClassAuthorizedSharesAdjustment.buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(
            { contractId }
          ),
        disclosedContracts,
      };
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
      return {
        command: client.stockPlanPoolAdjustment.buildArchiveStockPlanPoolAdjustmentByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    case 'DOCUMENT':
      return {
        command: client.document.buildArchiveDocumentByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_WARRANT_ISSUANCE':
      return {
        command: client.warrantIssuance.buildArchiveWarrantIssuanceByIssuerCommand({ contractId }),
        disclosedContracts,
      };
    case 'TX_CONVERTIBLE_ISSUANCE':
      return {
        command: client.convertibleIssuance.buildArchiveConvertibleIssuanceByIssuerCommand({
          contractId,
        }),
        disclosedContracts,
      };
    default:
      throw new Error(`Archive not supported for object type: ${objectType}`);
  }
}
