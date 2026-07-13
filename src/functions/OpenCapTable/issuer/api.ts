/** Public CreateIssuer API, isolated from generated DAML converter declarations. */

import type { CommandWithDisclosedContracts } from '../../../types/common';
import { buildCreateIssuerCommand as buildGeneratedCreateIssuerCommand } from './createIssuer';
import type { CreateIssuerParams } from './types';

export type { CreateIssuerParams, IssuerDataInput } from './types';

/** Build the CreateCapTable command that creates an issuer and its CapTable. */
export function buildCreateIssuerCommand(params: CreateIssuerParams): CommandWithDisclosedContracts {
  return buildGeneratedCreateIssuerCommand(params);
}
