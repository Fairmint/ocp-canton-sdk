import type { Assert, ContainsAny, IsAny, IsExactly, IsOptional } from '../typeContracts/typeAssertions';

type CompilerAny = ReturnType<typeof JSON.parse>;
interface CleanRecursive {
  readonly value: string;
  readonly next?: CleanRecursive;
  readonly children: readonly CleanRecursive[];
}
interface DirtyRecursive {
  readonly value: CompilerAny;
  readonly next?: DirtyRecursive;
}
interface StructuralBase {
  readonly child: StructuralDerived;
}
interface StructuralDerived extends StructuralBase {
  readonly payload: CompilerAny;
}
interface DirtyCallable {
  (value: string): number;
  readonly metadata: { readonly raw: CompilerAny };
}
interface DirtyCallableConstructible {
  (value: string): number;
  new (raw: CompilerAny): { readonly value: string };
}
type DirtyUnknownReturningFunction = (value: { readonly raw: CompilerAny }) => unknown;
type CleanFunction = (this: { readonly traceId: string }, value: readonly [string, number]) => boolean;
type DirtyTupleWithExtra = readonly [string] & { readonly metadata: CompilerAny };

export type TypeAssertionsSelfTest = Assert<
  IsExactly<
    readonly [
      IsAny<CompilerAny>,
      ContainsAny<CompilerAny>,
      ContainsAny<never>,
      ContainsAny<unknown>,
      ContainsAny<string | { readonly nested: CompilerAny }>,
      ContainsAny<readonly [string, CompilerAny]>,
      ContainsAny<DirtyTupleWithExtra>,
      ContainsAny<DirtyUnknownReturningFunction>,
      ContainsAny<DirtyCallable>,
      ContainsAny<DirtyCallableConstructible>,
      ContainsAny<CleanFunction>,
      ContainsAny<CleanRecursive>,
      ContainsAny<DirtyRecursive>,
      ContainsAny<StructuralBase>,
      IsExactly<{ readonly authUrl: CompilerAny }, { readonly authUrl: string }>,
      IsExactly<{ readonly id: string }, { readonly id: string }>,
      IsExactly<{ readonly id: string; readonly extra?: number }, { readonly id: string }>,
      IsExactly<
        { readonly kind: 'a' } | { readonly kind: 'b'; readonly extra?: number },
        { readonly kind: 'a' } | { readonly kind: 'b' }
      >,
      IsOptional<{ readonly required: string }, 'required'>,
      IsOptional<{ readonly optional?: string }, 'optional'>,
    ],
    readonly [
      true,
      true,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      false,
      true,
    ]
  >
>;
