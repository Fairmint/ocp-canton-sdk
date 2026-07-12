/** Compile-time contracts for exact vesting-reader result and converter-input families. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart, OcfVestingTerms, OcpClient } from '../../src';
import type { DamlDataTypeFor } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { DamlVestingAccelerationData } from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import type { GetVestingAccelerationAsOcfResult } from '../../src/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import type { vestingAccelerationDataToDaml } from '../../src/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import type { DamlVestingEventData } from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import type { GetVestingEventAsOcfResult } from '../../src/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import type { vestingEventDataToDaml } from '../../src/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import type { DamlVestingStartData } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import type { GetVestingStartAsOcfResult } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import type { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import type { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import type { GetVestingTermsAsOcfResult } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type VestingStartEvent = GetVestingStartAsOcfResult['event'];
type VestingEventEvent = GetVestingEventAsOcfResult['event'];
type VestingAccelerationEvent = GetVestingAccelerationAsOcfResult['event'];
type VestingTermsObject = GetVestingTermsAsOcfResult['event'];
type PublicOpenCapTable = OcpClient['OpenCapTable'];
type PublicVestingStartData = Awaited<ReturnType<PublicOpenCapTable['vestingStart']['get']>>['data'];
type PublicVestingEventData = Awaited<ReturnType<PublicOpenCapTable['vestingEvent']['get']>>['data'];
type PublicVestingAccelerationData = Awaited<ReturnType<PublicOpenCapTable['vestingAcceleration']['get']>>['data'];
type PublicVestingTermsData = Awaited<ReturnType<PublicOpenCapTable['vestingTerms']['get']>>['data'];

const vestingStartIsExact: Assert<IsExactly<VestingStartEvent, OcfVestingStart>> = true;
const vestingEventIsExact: Assert<IsExactly<VestingEventEvent, OcfVestingEvent>> = true;
const vestingAccelerationIsExact: Assert<IsExactly<VestingAccelerationEvent, OcfVestingAcceleration>> = true;
const vestingTermsIsExact: Assert<IsExactly<VestingTermsObject, OcfVestingTerms>> = true;
const vestingStartResultIsExact: Assert<
  IsExactly<GetVestingStartAsOcfResult, { event: OcfVestingStart; contractId: string }>
> = true;
const vestingEventResultIsExact: Assert<
  IsExactly<GetVestingEventAsOcfResult, { event: OcfVestingEvent; contractId: string }>
> = true;
const vestingAccelerationResultIsExact: Assert<
  IsExactly<GetVestingAccelerationAsOcfResult, { event: OcfVestingAcceleration; contractId: string }>
> = true;
const vestingTermsResultIsExact: Assert<
  IsExactly<GetVestingTermsAsOcfResult, { event: OcfVestingTerms; contractId: string }>
> = true;
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
const vestingStartWriterIsExact: Assert<
  IsExactly<ReturnType<typeof vestingStartDataToDaml>, DamlDataTypeFor<'vestingStart'>>
> = true;
const vestingEventWriterIsExact: Assert<
  IsExactly<ReturnType<typeof vestingEventDataToDaml>, DamlDataTypeFor<'vestingEvent'>>
> = true;
const vestingAccelerationWriterIsExact: Assert<
  IsExactly<ReturnType<typeof vestingAccelerationDataToDaml>, DamlDataTypeFor<'vestingAcceleration'>>
> = true;
const vestingTermsWriterIsExact: Assert<
  IsExactly<ReturnType<typeof vestingTermsDataToDaml>, DamlDataTypeFor<'vestingTerms'>>
> = true;

declare const vestingStartResult: GetVestingStartAsOcfResult;
declare const vestingEventResult: GetVestingEventAsOcfResult;
declare const vestingAccelerationResult: GetVestingAccelerationAsOcfResult;

// @ts-expect-error vesting start cannot be used as a vesting event
const wrongVestingEvent: OcfVestingEvent = vestingStartResult.event;
// @ts-expect-error vesting event cannot be used as vesting acceleration
const wrongVestingAcceleration: OcfVestingAcceleration = vestingEventResult.event;
// @ts-expect-error vesting acceleration cannot be used as vesting start
const wrongVestingStart: OcfVestingStart = vestingAccelerationResult.event;
// @ts-expect-error root OcpClient vesting-start data cannot be used as vesting terms
const wrongPublicVestingTerms: OcfVestingTerms = null as unknown as PublicVestingStartData;

void vestingStartIsExact;
void vestingEventIsExact;
void vestingAccelerationIsExact;
void vestingTermsIsExact;
void vestingStartResultIsExact;
void vestingEventResultIsExact;
void vestingAccelerationResultIsExact;
void vestingTermsResultIsExact;
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
void vestingStartWriterIsExact;
void vestingEventWriterIsExact;
void vestingAccelerationWriterIsExact;
void vestingTermsWriterIsExact;
void wrongVestingEvent;
void wrongVestingAcceleration;
void wrongVestingStart;
void wrongPublicVestingTerms;
