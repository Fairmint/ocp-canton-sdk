/** Compile-time contracts for exact vesting-reader result and converter-input families. */

import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { DamlVestingAccelerationData } from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import type { GetVestingAccelerationAsOcfResult } from '../../src/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import type { DamlVestingEventData } from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import type { GetVestingEventAsOcfResult } from '../../src/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import type { DamlVestingStartData } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import type { GetVestingStartAsOcfResult } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart } from '../../src/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type VestingStartEvent = GetVestingStartAsOcfResult['vestingStart'];
type VestingEventEvent = GetVestingEventAsOcfResult['vestingEvent'];
type VestingAccelerationEvent = GetVestingAccelerationAsOcfResult['vestingAcceleration'];

const vestingStartIsExact: Assert<IsExactly<VestingStartEvent, OcfVestingStart>> = true;
const vestingEventIsExact: Assert<IsExactly<VestingEventEvent, OcfVestingEvent>> = true;
const vestingAccelerationIsExact: Assert<IsExactly<VestingAccelerationEvent, OcfVestingAcceleration>> = true;
const vestingStartIsNotAny: Assert<IsExactly<IsAny<VestingStartEvent>, false>> = true;
const vestingEventIsNotAny: Assert<IsExactly<IsAny<VestingEventEvent>, false>> = true;
const vestingAccelerationIsNotAny: Assert<IsExactly<IsAny<VestingAccelerationEvent>, false>> = true;

const vestingStartDamlIsExact: Assert<IsExactly<DamlVestingStartData, DamlDataTypeFor<'vestingStart'>>> = true;
const vestingEventDamlIsExact: Assert<IsExactly<DamlVestingEventData, DamlDataTypeFor<'vestingEvent'>>> = true;
const vestingAccelerationDamlIsExact: Assert<
  IsExactly<DamlVestingAccelerationData, DamlDataTypeFor<'vestingAcceleration'>>
> = true;

declare const vestingStartResult: GetVestingStartAsOcfResult;
declare const vestingEventResult: GetVestingEventAsOcfResult;
declare const vestingAccelerationResult: GetVestingAccelerationAsOcfResult;

// @ts-expect-error vesting start cannot be used as a vesting event
const wrongVestingEvent: OcfVestingEvent = vestingStartResult.vestingStart;
// @ts-expect-error vesting event cannot be used as vesting acceleration
const wrongVestingAcceleration: OcfVestingAcceleration = vestingEventResult.vestingEvent;
// @ts-expect-error vesting acceleration cannot be used as vesting start
const wrongVestingStart: OcfVestingStart = vestingAccelerationResult.vestingAcceleration;

void vestingStartIsExact;
void vestingEventIsExact;
void vestingAccelerationIsExact;
void vestingStartIsNotAny;
void vestingEventIsNotAny;
void vestingAccelerationIsNotAny;
void vestingStartDamlIsExact;
void vestingEventDamlIsExact;
void vestingAccelerationDamlIsExact;
void wrongVestingEvent;
void wrongVestingAcceleration;
void wrongVestingStart;
