/** Exact public contract for the canonical quantity-source enum alias. */

type IsExactly<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

type PublicQuantitySourceType =
  | 'HUMAN_ESTIMATED'
  | 'MACHINE_ESTIMATED'
  | 'UNSPECIFIED'
  | 'INSTRUMENT_FIXED'
  | 'INSTRUMENT_MAX'
  | 'INSTRUMENT_MIN';

export type QuantitySourceContract<Value> = IsExactly<Value, PublicQuantitySourceType>;
