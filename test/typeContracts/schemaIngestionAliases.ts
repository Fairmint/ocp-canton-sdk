/**
 * Exact public-type contract for the schema-ingestion aliases that intentionally
 * remain outside the canonical `OcfObject` union.
 *
 * Keep the expected key sets independent from the SDK declarations. That makes
 * optionality changes, deleted fields, renamed root exports, and declaration
 * drift fail both the source and built-declaration compiler gates.
 */

export type IsExactly<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

type AllTrue<Checks extends readonly boolean[]> = false extends Checks[number] ? false : true;

type RequiredKeys<Value extends object> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? never : Key;
}[keyof Value];

type OptionalKeys<Value extends object> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? Key : never;
}[keyof Value];

type Property<Value extends object, Key extends PropertyKey> = Key extends keyof Value ? Value[Key] : never;

export type PlanSecurityIssuanceRequiredKeys =
  | 'compensation_type'
  | 'custom_id'
  | 'date'
  | 'expiration_date'
  | 'id'
  | 'object_type'
  | 'quantity'
  | 'security_id'
  | 'security_law_exemptions'
  | 'stakeholder_id'
  | 'termination_exercise_windows';

export type PlanSecurityIssuanceOptionalKeys =
  | 'base_price'
  | 'board_approval_date'
  | 'comments'
  | 'consideration_text'
  | 'early_exercisable'
  | 'exercise_price'
  | 'option_grant_type'
  | 'plan_security_type'
  | 'stock_class_id'
  | 'stock_plan_id'
  | 'stockholder_approval_date'
  | 'vesting_terms_id'
  | 'vestings';

export type PlanSecurityExerciseRequiredKeys =
  | 'date'
  | 'id'
  | 'object_type'
  | 'quantity'
  | 'resulting_security_ids'
  | 'security_id';
export type PlanSecurityExerciseOptionalKeys = 'balance_security_id' | 'comments' | 'consideration_text';

export type PlanSecurityCancellationRequiredKeys =
  | 'date'
  | 'id'
  | 'object_type'
  | 'quantity'
  | 'reason_text'
  | 'security_id';
export type PlanSecurityCancellationOptionalKeys = 'balance_security_id' | 'comments';

export type PlanSecurityAcceptanceRequiredKeys = 'date' | 'id' | 'object_type' | 'security_id';
export type PlanSecurityAcceptanceOptionalKeys = 'comments';

export type PlanSecurityReleaseRequiredKeys =
  | 'date'
  | 'id'
  | 'object_type'
  | 'quantity'
  | 'release_price'
  | 'resulting_security_ids'
  | 'security_id'
  | 'settlement_date';
export type PlanSecurityReleaseOptionalKeys = 'balance_security_id' | 'comments' | 'consideration_text';

export type PlanSecurityRetractionRequiredKeys = 'date' | 'id' | 'object_type' | 'reason_text' | 'security_id';
export type PlanSecurityRetractionOptionalKeys = 'comments';

export type PlanSecurityTransferRequiredKeys =
  | 'date'
  | 'id'
  | 'object_type'
  | 'quantity'
  | 'resulting_security_ids'
  | 'security_id';
export type PlanSecurityTransferOptionalKeys = 'balance_security_id' | 'comments' | 'consideration_text';

export type PublicQuantitySourceType =
  | 'HUMAN_ESTIMATED'
  | 'MACHINE_ESTIMATED'
  | 'UNSPECIFIED'
  | 'INSTRUMENT_FIXED'
  | 'INSTRUMENT_MAX'
  | 'INSTRUMENT_MIN';

export interface SchemaIngestionAliasTypeSet {
  planSecurityAcceptance: object;
  planSecurityAcceptanceOutput: object;
  planSecurityCancellation: object;
  planSecurityCancellationOutput: object;
  planSecurityExercise: object;
  planSecurityExerciseOutput: object;
  planSecurityIssuance: object;
  planSecurityIssuanceOutput: object;
  planSecurityRelease: object;
  planSecurityReleaseOutput: object;
  planSecurityRetraction: object;
  planSecurityRetractionOutput: object;
  planSecurityTransfer: object;
  planSecurityTransferOutput: object;
  quantitySource: unknown;
}

/** Validate all named source or emitted-declaration aliases in one compiler assertion. */
export type SchemaIngestionAliasContract<Types extends SchemaIngestionAliasTypeSet> = AllTrue<
  [
    IsExactly<RequiredKeys<Types['planSecurityIssuance']>, PlanSecurityIssuanceRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityIssuance']>, PlanSecurityIssuanceOptionalKeys>,
    IsExactly<Property<Types['planSecurityIssuance'], 'object_type'>, 'TX_PLAN_SECURITY_ISSUANCE'>,
    IsExactly<RequiredKeys<Types['planSecurityExercise']>, PlanSecurityExerciseRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityExercise']>, PlanSecurityExerciseOptionalKeys>,
    IsExactly<Property<Types['planSecurityExercise'], 'object_type'>, 'TX_PLAN_SECURITY_EXERCISE'>,
    IsExactly<RequiredKeys<Types['planSecurityCancellation']>, PlanSecurityCancellationRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityCancellation']>, PlanSecurityCancellationOptionalKeys>,
    IsExactly<Property<Types['planSecurityCancellation'], 'object_type'>, 'TX_PLAN_SECURITY_CANCELLATION'>,
    IsExactly<RequiredKeys<Types['planSecurityAcceptance']>, PlanSecurityAcceptanceRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityAcceptance']>, PlanSecurityAcceptanceOptionalKeys>,
    IsExactly<Property<Types['planSecurityAcceptance'], 'object_type'>, 'TX_PLAN_SECURITY_ACCEPTANCE'>,
    IsExactly<RequiredKeys<Types['planSecurityRelease']>, PlanSecurityReleaseRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityRelease']>, PlanSecurityReleaseOptionalKeys>,
    IsExactly<Property<Types['planSecurityRelease'], 'object_type'>, 'TX_PLAN_SECURITY_RELEASE'>,
    IsExactly<RequiredKeys<Types['planSecurityRetraction']>, PlanSecurityRetractionRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityRetraction']>, PlanSecurityRetractionOptionalKeys>,
    IsExactly<Property<Types['planSecurityRetraction'], 'object_type'>, 'TX_PLAN_SECURITY_RETRACTION'>,
    IsExactly<RequiredKeys<Types['planSecurityTransfer']>, PlanSecurityTransferRequiredKeys>,
    IsExactly<OptionalKeys<Types['planSecurityTransfer']>, PlanSecurityTransferOptionalKeys>,
    IsExactly<Property<Types['planSecurityTransfer'], 'object_type'>, 'TX_PLAN_SECURITY_TRANSFER'>,
    IsExactly<Types['planSecurityIssuanceOutput'], Types['planSecurityIssuance']>,
    IsExactly<Types['planSecurityExerciseOutput'], Types['planSecurityExercise']>,
    IsExactly<Types['planSecurityCancellationOutput'], Types['planSecurityCancellation']>,
    IsExactly<Types['planSecurityAcceptanceOutput'], Types['planSecurityAcceptance']>,
    IsExactly<Types['planSecurityReleaseOutput'], Types['planSecurityRelease']>,
    IsExactly<Types['planSecurityRetractionOutput'], Types['planSecurityRetraction']>,
    IsExactly<Types['planSecurityTransferOutput'], Types['planSecurityTransfer']>,
    IsExactly<Types['quantitySource'], PublicQuantitySourceType>,
  ]
>;
