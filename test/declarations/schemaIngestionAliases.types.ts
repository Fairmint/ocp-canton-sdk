/** Compile-time inventory for named public schema-ingestion aliases emitted by the package root. */

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
} from '../../dist';
import type { SchemaIngestionAliasContract } from '../typeContracts/schemaIngestionAliases';

type Assert<Condition extends true> = Condition;

const emittedAliasesMatchPublicContract: Assert<
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

void emittedAliasesMatchPublicContract;
