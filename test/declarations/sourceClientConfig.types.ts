/** Compile-time parity probes for source client factory signatures. */

import type { OcpClient as SourceOcpClient } from '../../src/OcpClient';
import type { OcpClientHostedPresetOptions } from '../../src/clientOptions';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<Left, Right> =
  IsAny<Left> extends true
    ? false
    : IsAny<Right> extends true
      ? false
      : [Left] extends [Right]
        ? [Right] extends [Left]
          ? true
          : false
        : false;

const sourceForStagingOptionsAreExact: Assert<
  IsExactly<Parameters<typeof SourceOcpClient.forStaging>[0], OcpClientHostedPresetOptions>
> = true;

void sourceForStagingOptionsAreExact;
