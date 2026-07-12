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
import type { Assert, IsExactly } from '../typeContracts/typeAssertions';

type CompilerAny = ReturnType<typeof JSON.parse>;

interface SourceSchemaIngestionAliases {
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
}

type Replace<Type, Replacement extends object> = Omit<Type, keyof Replacement> & Replacement;

const sourceAliasesMatchPublicContract: Assert<SchemaIngestionAliasContract<SourceSchemaIngestionAliases>> = true;

void sourceAliasesMatchPublicContract;

type MutatedPlanSecurityExercise<Quantity> = Omit<OcfPlanSecurityExercise, 'quantity'> & {
  quantity: Quantity;
};
type MutatedExerciseContract<Quantity> = SchemaIngestionAliasContract<
  Replace<
    SourceSchemaIngestionAliases,
    {
      planSecurityExercise: MutatedPlanSecurityExercise<Quantity>;
      planSecurityExerciseOutput: MutatedPlanSecurityExercise<Quantity>;
    }
  >
>;
type DirectAnyContract = SchemaIngestionAliasContract<
  Replace<
    SourceSchemaIngestionAliases,
    {
      planSecurityExercise: CompilerAny;
      planSecurityExerciseOutput: CompilerAny;
    }
  >
>;
type OptionalExtraContract = SchemaIngestionAliasContract<
  Replace<
    SourceSchemaIngestionAliases,
    {
      planSecurityAcceptance: OcfPlanSecurityAcceptance & { optional_extra?: string };
      planSecurityAcceptanceOutput: OcfPlanSecurityAcceptanceOutput & { optional_extra?: string };
    }
  >
>;

const memberTypeDriftIsRejected: Assert<IsExactly<MutatedExerciseContract<number>, false>> = true;
const nestedAnyIsRejected: Assert<IsExactly<MutatedExerciseContract<CompilerAny>, false>> = true;
const directAnyIsRejected: Assert<IsExactly<DirectAnyContract, false>> = true;
const optionalExtraIsRejected: Assert<IsExactly<OptionalExtraContract, false>> = true;
void memberTypeDriftIsRejected;
void nestedAnyIsRejected;
void directAnyIsRejected;
void optionalExtraIsRejected;

declare const sourceIssuance: OcfPlanSecurityIssuance;
declare const sourceExercise: OcfPlanSecurityExercise;
declare const sourceCancellation: OcfPlanSecurityCancellation;
declare const sourceRelease: OcfPlanSecurityRelease;
declare const sourceTransfer: OcfPlanSecurityTransfer;

// These probes intentionally require a compiler error. If a quantity silently
// widens to `any`, the corresponding `@ts-expect-error` becomes unused.
// @ts-expect-error schema quantity aliases must remain canonical decimal strings
const invalidSourceIssuanceQuantity: number = sourceIssuance.quantity;
// @ts-expect-error schema quantity aliases must remain canonical decimal strings
const invalidSourceExerciseQuantity: number = sourceExercise.quantity;
// @ts-expect-error schema quantity aliases must remain canonical decimal strings
const invalidSourceCancellationQuantity: number = sourceCancellation.quantity;
// @ts-expect-error schema quantity aliases must remain canonical decimal strings
const invalidSourceReleaseQuantity: number = sourceRelease.quantity;
// @ts-expect-error schema quantity aliases must remain canonical decimal strings
const invalidSourceTransferQuantity: number = sourceTransfer.quantity;

void invalidSourceIssuanceQuantity;
void invalidSourceExerciseQuantity;
void invalidSourceCancellationQuantity;
void invalidSourceReleaseQuantity;
void invalidSourceTransferQuantity;
