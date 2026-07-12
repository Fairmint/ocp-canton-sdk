/** Shared compile-time assertions for source, built, and package-facing type contracts. */

export type IsAny<Value> = 0 extends 1 & Value ? true : false;

export type Assert<Condition extends true> = IsAny<Condition> extends true ? never : Condition;

export type IsOptional<Value, Key extends keyof Value> =
  IsAny<Value> extends true
    ? never
    : IsAny<Key> extends true
      ? never
      : [Value] extends [never]
        ? never
        : [Key] extends [never]
          ? never
          : {} extends Pick<Value, Key>
            ? true
            : false;

type TypeEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type HasSeen<Value, Seen extends readonly unknown[]> = Seen extends readonly [infer Head, ...infer Tail]
  ? TypeEqual<Value, Head> extends true
    ? true
    : HasSeen<Value, Tail>
  : false;

type ArrayExtraValues<Value extends readonly unknown[]> = Value[Exclude<keyof Value, keyof (readonly unknown[])>];

type ConstructSignatureContainsAny<Value, Seen extends readonly unknown[]> = Value extends abstract new (
  ...args: infer Arguments
) => infer Instance
  ? true extends
      | ContainsAnyInternal<Arguments[number], Seen>
      | ContainsAnyInternal<Instance, Seen>
      | ContainsAnyInternal<Value[keyof Value], Seen>
    ? true
    : false
  : false;

type ContainsAnyMember<Value, Seen extends readonly unknown[]> =
  HasSeen<Value, Seen> extends true
    ? false
    : Value extends (...args: infer Arguments) => infer Result
      ? true extends
          | ContainsAnyInternal<Arguments[number], readonly [...Seen, Value]>
          | ContainsAnyInternal<Result, readonly [...Seen, Value]>
          | ContainsAnyInternal<ThisParameterType<Value>, readonly [...Seen, Value]>
          | ContainsAnyInternal<Value[keyof Value], readonly [...Seen, Value]>
          | ConstructSignatureContainsAny<Value, readonly [...Seen, Value]>
        ? true
        : false
      : Value extends abstract new (...args: infer Arguments) => infer Instance
        ? true extends
            | ContainsAnyInternal<Arguments[number], readonly [...Seen, Value]>
            | ContainsAnyInternal<Instance, readonly [...Seen, Value]>
            | ContainsAnyInternal<Value[keyof Value], readonly [...Seen, Value]>
          ? true
          : false
        : Value extends ReadonlyArray<infer Item>
          ? true extends
              | ContainsAnyInternal<Item, readonly [...Seen, Value]>
              | ContainsAnyInternal<ArrayExtraValues<Value>, readonly [...Seen, Value]>
            ? true
            : false
          : Value extends object
            ? true extends {
                [Key in keyof Value]-?: ContainsAnyInternal<Value[Key], readonly [...Seen, Value]>;
              }[keyof Value]
              ? true
              : false
            : false;

type ContainsAnyInternal<Value, Seen extends readonly unknown[]> =
  IsAny<Value> extends true
    ? true
    : true extends (Value extends unknown ? ContainsAnyMember<Value, Seen> : never)
      ? true
      : false;

/**
 * Detect `any` in structurally reachable members and conditionally visible call/construct signatures.
 * TypeScript does not expose every overload or generic default for complete reflection.
 */
export type ContainsAny<Value> = ContainsAnyInternal<Value, readonly []>;

type NormalizeExact<Value> = Value extends (...args: never[]) => unknown
  ? Value
  : Value extends abstract new (...args: never[]) => unknown
    ? Value
    : Value extends object
      ? { [Key in keyof Value]: Value[Key] }
      : Value;

/** Exact structural equality guarded against both top-level and nested `any`. */
export type IsExactly<Left, Right> =
  ContainsAny<Left> extends true
    ? false
    : ContainsAny<Right> extends true
      ? false
      : TypeEqual<NormalizeExact<Left>, NormalizeExact<Right>>;
