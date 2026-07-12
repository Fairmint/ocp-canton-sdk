/** Compile-time parity probes for source client factory signatures. */

import type { OcpClient as SourceOcpClient } from '../../src/OcpClient';
import type { OcpClientHostedPresetOptions } from '../../src/clientOptions';
import type { Assert, IsExactly } from '../typeContracts/typeAssertions';

const sourceForStagingOptionsAreExact: Assert<
  IsExactly<Parameters<typeof SourceOcpClient.forStaging>[0], OcpClientHostedPresetOptions>
> = true;

void sourceForStagingOptionsAreExact;
