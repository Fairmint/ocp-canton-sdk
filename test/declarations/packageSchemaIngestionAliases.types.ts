/** Compile-time inventory resolved through the package's published entry point. */

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
} from '@open-captable-protocol/canton';
import type { SchemaIngestionAliasContract } from '../typeContracts/schemaIngestionAliases';
import type { Assert } from '../typeContracts/typeAssertions';

const packageAliasesMatchPublicContract: Assert<
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

void packageAliasesMatchPublicContract;

declare const packageIssuance: OcfPlanSecurityIssuance;
declare const packageExercise: OcfPlanSecurityExercise;
declare const packageCancellation: OcfPlanSecurityCancellation;
declare const packageRelease: OcfPlanSecurityRelease;
declare const packageTransfer: OcfPlanSecurityTransfer;

// These probes intentionally require a compiler error. If a quantity silently
// widens to `any`, the corresponding `@ts-expect-error` becomes unused.
// @ts-expect-error package quantity aliases must remain canonical decimal strings
const invalidPackageIssuanceQuantity: number = packageIssuance.quantity;
// @ts-expect-error package quantity aliases must remain canonical decimal strings
const invalidPackageExerciseQuantity: number = packageExercise.quantity;
// @ts-expect-error package quantity aliases must remain canonical decimal strings
const invalidPackageCancellationQuantity: number = packageCancellation.quantity;
// @ts-expect-error package quantity aliases must remain canonical decimal strings
const invalidPackageReleaseQuantity: number = packageRelease.quantity;
// @ts-expect-error package quantity aliases must remain canonical decimal strings
const invalidPackageTransferQuantity: number = packageTransfer.quantity;

void invalidPackageIssuanceQuantity;
void invalidPackageExerciseQuantity;
void invalidPackageCancellationQuantity;
void invalidPackageReleaseQuantity;
void invalidPackageTransferQuantity;
