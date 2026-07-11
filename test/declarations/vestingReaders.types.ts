/** Built-declaration contracts for exact vesting-reader result and converter-input families. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart, OcfVestingTerms, OcpClient } from '../../dist';
import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type { DamlVestingAccelerationData } from '../../dist/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import type { GetVestingAccelerationAsOcfResult } from '../../dist/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import type { DamlVestingEventData } from '../../dist/functions/OpenCapTable/vestingEvent/damlToOcf';
import type { GetVestingEventAsOcfResult } from '../../dist/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import type { DamlVestingStartData } from '../../dist/functions/OpenCapTable/vestingStart/damlToOcf';
import type { GetVestingStartAsOcfResult } from '../../dist/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import type { GetVestingTermsAsOcfResult } from '../../dist/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type VestingStartEvent = GetVestingStartAsOcfResult['vestingStart'];
type VestingEventEvent = GetVestingEventAsOcfResult['vestingEvent'];
type VestingAccelerationEvent = GetVestingAccelerationAsOcfResult['vestingAcceleration'];
type VestingTermsObject = GetVestingTermsAsOcfResult['vestingTerms'];
type PublicOpenCapTable = OcpClient['OpenCapTable'];
type PublicVestingStartData = Awaited<ReturnType<PublicOpenCapTable['vestingStart']['get']>>['data'];
type PublicVestingEventData = Awaited<ReturnType<PublicOpenCapTable['vestingEvent']['get']>>['data'];
type PublicVestingAccelerationData = Awaited<ReturnType<PublicOpenCapTable['vestingAcceleration']['get']>>['data'];
type PublicVestingTermsData = Awaited<ReturnType<PublicOpenCapTable['vestingTerms']['get']>>['data'];

const vestingStartIsExact: Assert<IsExactly<VestingStartEvent, OcfVestingStart>> = true;
const vestingEventIsExact: Assert<IsExactly<VestingEventEvent, OcfVestingEvent>> = true;
const vestingAccelerationIsExact: Assert<IsExactly<VestingAccelerationEvent, OcfVestingAcceleration>> = true;
const vestingTermsIsExact: Assert<IsExactly<VestingTermsObject, OcfVestingTerms>> = true;
const vestingStartIsNotAny: Assert<IsExactly<IsAny<VestingStartEvent>, false>> = true;
const vestingEventIsNotAny: Assert<IsExactly<IsAny<VestingEventEvent>, false>> = true;
const vestingAccelerationIsNotAny: Assert<IsExactly<IsAny<VestingAccelerationEvent>, false>> = true;
const vestingTermsIsNotAny: Assert<IsExactly<IsAny<VestingTermsObject>, false>> = true;
const publicVestingStartIsExact: Assert<IsExactly<PublicVestingStartData, OcfVestingStart>> = true;
const publicVestingEventIsExact: Assert<IsExactly<PublicVestingEventData, OcfVestingEvent>> = true;
const publicVestingAccelerationIsExact: Assert<IsExactly<PublicVestingAccelerationData, OcfVestingAcceleration>> = true;
const publicVestingTermsIsExact: Assert<IsExactly<PublicVestingTermsData, OcfVestingTerms>> = true;

const vestingStartDamlIsExact: Assert<IsExactly<DamlVestingStartData, DamlDataTypeFor<'vestingStart'>>> = true;
const vestingEventDamlIsExact: Assert<IsExactly<DamlVestingEventData, DamlDataTypeFor<'vestingEvent'>>> = true;
const vestingAccelerationDamlIsExact: Assert<
  IsExactly<DamlVestingAccelerationData, DamlDataTypeFor<'vestingAcceleration'>>
> = true;
const vestingTermsDamlIsExact: Assert<
  IsExactly<DamlDataTypeFor<'vestingTerms'>, Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData>
> = true;

declare const vestingStartResult: GetVestingStartAsOcfResult;
declare const vestingEventResult: GetVestingEventAsOcfResult;
declare const vestingAccelerationResult: GetVestingAccelerationAsOcfResult;

// @ts-expect-error built vesting start cannot be used as a vesting event
const wrongVestingEvent: OcfVestingEvent = vestingStartResult.vestingStart;
// @ts-expect-error built vesting event cannot be used as vesting acceleration
const wrongVestingAcceleration: OcfVestingAcceleration = vestingEventResult.vestingEvent;
// @ts-expect-error built vesting acceleration cannot be used as vesting start
const wrongVestingStart: OcfVestingStart = vestingAccelerationResult.vestingAcceleration;
// @ts-expect-error built root OcpClient vesting-start data cannot be used as vesting terms
const wrongPublicVestingTerms: OcfVestingTerms = null;

void vestingStartIsExact;
void vestingEventIsExact;
void vestingAccelerationIsExact;
void vestingTermsIsExact;
void vestingStartIsNotAny;
void vestingEventIsNotAny;
void vestingAccelerationIsNotAny;
void vestingTermsIsNotAny;
void publicVestingStartIsExact;
void publicVestingEventIsExact;
void publicVestingAccelerationIsExact;
void publicVestingTermsIsExact;
void vestingStartDamlIsExact;
void vestingEventDamlIsExact;
void vestingAccelerationDamlIsExact;
void vestingTermsDamlIsExact;
void wrongVestingEvent;
void wrongVestingAcceleration;
void wrongVestingStart;
void wrongPublicVestingTerms;
