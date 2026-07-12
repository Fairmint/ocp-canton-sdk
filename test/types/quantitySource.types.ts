/** Compile-time proof of the source-level quantity-source enum alias. */

import type { QuantitySourceType } from '../../src';
import type { QuantitySourceContract } from '../typeContracts/quantitySource';

type Assert<Condition extends true> = Condition;

const sourceQuantitySourceMatchesContract: Assert<QuantitySourceContract<QuantitySourceType>> = true;

void sourceQuantitySourceMatchesContract;
