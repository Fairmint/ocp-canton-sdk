/** Compile-time proof of the emitted quantity-source enum alias. */

import type { QuantitySourceType } from '../../dist';
import type { QuantitySourceContract } from '../typeContracts/quantitySource';

type Assert<Condition extends true> = Condition;

const emittedQuantitySourceMatchesContract: Assert<QuantitySourceContract<QuantitySourceType>> = true;

void emittedQuantitySourceMatchesContract;
