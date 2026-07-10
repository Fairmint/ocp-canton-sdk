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

void sourceContextPreservesCallerSubtype;
void preservedCallerMetadata;
