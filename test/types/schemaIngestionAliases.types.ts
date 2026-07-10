/** Compile-time inventory for named public schema-ingestion aliases at the source boundary. */

import type {
  OcfPlanSecurityAcceptance,
  OcfPlanSecurityAcceptanceOutput,
  OcfPlanSecurityCancellation,
  OcfPlanSecurityCancellationOutput,
  OcfPlanSecurityExercise,
  OcfPlanSecurityExerciseOutput,
  OcfPlanSecurityIssuance,
  OcfPlanSecurityIssuanceOutput,
  OcfPlanSecurityRelease,
  OcfPlanSecurityReleaseOutput,
  OcfPlanSecurityRetraction,
  OcfPlanSecurityRetractionOutput,
  OcfPlanSecurityTransfer,
  OcfPlanSecurityTransferOutput,
  QuantitySourceType,
} from '../../src';
import type { SchemaIngestionAliasContract } from '../typeContracts/schemaIngestionAliases';

type Assert<Condition extends true> = Condition;

const sourceAliasesMatchPublicContract: Assert<
  SchemaIngestionAliasContract<{
    planSecurityAcceptance: OcfPlanSecurityAcceptance;
    planSecurityAcceptanceOutput: OcfPlanSecurityAcceptanceOutput;
    planSecurityCancellation: OcfPlanSecurityCancellation;
    planSecurityCancellationOutput: OcfPlanSecurityCancellationOutput;
    planSecurityExercise: OcfPlanSecurityExercise;
    planSecurityExerciseOutput: OcfPlanSecurityExerciseOutput;
    planSecurityIssuance: OcfPlanSecurityIssuance;
    planSecurityIssuanceOutput: OcfPlanSecurityIssuanceOutput;
    planSecurityRelease: OcfPlanSecurityRelease;
    planSecurityReleaseOutput: OcfPlanSecurityReleaseOutput;
    planSecurityRetraction: OcfPlanSecurityRetraction;
    planSecurityRetractionOutput: OcfPlanSecurityRetractionOutput;
    planSecurityTransfer: OcfPlanSecurityTransfer;
    planSecurityTransferOutput: OcfPlanSecurityTransferOutput;
    quantitySource: QuantitySourceType;
  }>
> = true;

void sourceAliasesMatchPublicContract;
