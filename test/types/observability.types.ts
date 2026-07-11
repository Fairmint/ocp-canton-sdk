/** Compile-time contracts for observability helper subtype preservation. */

import { applyCommandContext } from '../../src';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const paramsWithCallerMetadata = {
  commands: [],
  actAs: ['issuer::party'],
  callerMetadata: 'preserved' as const,
};

const contextualizedParams = applyCommandContext(paramsWithCallerMetadata, {
  context: { workflowId: 'workflow-1' },
});

const sourceContextPreservesCallerSubtype: Assert<
  IsExactly<typeof contextualizedParams, typeof paramsWithCallerMetadata>
> = true;
const preservedCallerMetadata: 'preserved' = contextualizedParams.callerMetadata;

const paramsWithLiteralCommandId = {
  ...paramsWithCallerMetadata,
  commandId: 'command-from-params' as const,
};
const contextualizedWithCommandOverride = applyCommandContext(paramsWithLiteralCommandId, {
  context: { commandId: 'command-from-context' },
});
const sourceContextWidensOverriddenLiteral: Assert<
  IsExactly<typeof contextualizedWithCommandOverride.commandId, string>
> = true;
const sourceOverridePreservesCallerMetadata: 'preserved' = contextualizedWithCommandOverride.callerMetadata;

void sourceContextPreservesCallerSubtype;
void preservedCallerMetadata;
void sourceContextWidensOverriddenLiteral;
void sourceOverridePreservesCallerMetadata;
