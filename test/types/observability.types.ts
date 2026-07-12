/** Compile-time contracts for the plain observability submit result. */

import { applyCommandContext, type AppliedCommandContext } from '../../src';

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

const sourceContextUsesPublicResult: Assert<IsExactly<typeof contextualizedParams, AppliedCommandContext>> = true;
const sourceWorkflowId: string | undefined = contextualizedParams.workflowId;
const sourceResultOmitsCallerMetadata: Assert<
  IsExactly<'callerMetadata' extends keyof typeof contextualizedParams ? true : false, false>
> = true;

const paramsWithLiteralCommandId = {
  ...paramsWithCallerMetadata,
  commandId: 'command-from-params' as const,
};
const contextualizedWithCommandOverride = applyCommandContext(paramsWithLiteralCommandId, {
  context: { commandId: 'command-from-context' },
});
const sourceCommandId: string | undefined = contextualizedWithCommandOverride.commandId;

// @ts-expect-error Arbitrary caller-specific members are not promised by a plain submit result.
contextualizedParams.callerMetadata;
// @ts-expect-error Applied command-context fields are immutable.
contextualizedParams.workflowId = 'mutated';

void sourceContextUsesPublicResult;
void sourceWorkflowId;
void sourceResultOmitsCallerMetadata;
void sourceCommandId;
