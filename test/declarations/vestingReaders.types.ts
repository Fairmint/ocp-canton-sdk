/** Built-declaration contracts for exact vesting-reader result and converter-input families. */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart, OcfVestingTerms, OcpClient } from '../../dist';
import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type { ReadonlyDamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/damlEntityData';
import type { DamlVestingAccelerationData } from '../../dist/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import type { GetVestingAccelerationAsOcfResult } from '../../dist/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import type { vestingAccelerationDataToDaml } from '../../dist/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import type { DamlVestingEventData } from '../../dist/functions/OpenCapTable/vestingEvent/damlToOcf';
import type { GetVestingEventAsOcfResult } from '../../dist/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import type { vestingEventDataToDaml } from '../../dist/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import type { DamlVestingStartData } from '../../dist/functions/OpenCapTable/vestingStart/damlToOcf';
import type { GetVestingStartAsOcfResult } from '../../dist/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import type { vestingStartDataToDaml } from '../../dist/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import type { vestingTermsDataToDaml } from '../../dist/functions/OpenCapTable/vestingTerms/createVestingTerms';
import type { GetVestingTermsAsOcfResult } from '../../dist/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> =
  IsAny<A> extends true
    ? false
    : IsAny<B> extends true
      ? false
      : [A] extends [B]
        ? [B] extends [A]
          ? true
          : false
        : false;

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
  IsExactly<GetVestingStartAsOcfResult, { readonly event: OcfVestingStart; readonly contractId: string }>
> = true;
const vestingEventResultIsExact: Assert<
  IsExactly<GetVestingEventAsOcfResult, { readonly event: OcfVestingEvent; readonly contractId: string }>
> = true;
const vestingAccelerationResultIsExact: Assert<
  IsExactly<GetVestingAccelerationAsOcfResult, { readonly event: OcfVestingAcceleration; readonly contractId: string }>
> = true;
const vestingTermsResultIsExact: Assert<
  IsExactly<GetVestingTermsAsOcfResult, { readonly event: OcfVestingTerms; readonly contractId: string }>
> = true;
const vestingStartIsNotAny: Assert<IsExactly<IsAny<VestingStartEvent>, false>> = true;
const vestingEventIsNotAny: Assert<IsExactly<IsAny<VestingEventEvent>, false>> = true;
const vestingAccelerationIsNotAny: Assert<IsExactly<IsAny<VestingAccelerationEvent>, false>> = true;
const vestingTermsIsNotAny: Assert<IsExactly<IsAny<VestingTermsObject>, false>> = true;
const publicVestingStartIsExact: Assert<IsExactly<PublicVestingStartData, OcfVestingStart>> = true;
const publicVestingEventIsExact: Assert<IsExactly<PublicVestingEventData, OcfVestingEvent>> = true;
const publicVestingAccelerationIsExact: Assert<IsExactly<PublicVestingAccelerationData, OcfVestingAcceleration>> = true;
const publicVestingTermsIsExact: Assert<IsExactly<PublicVestingTermsData, OcfVestingTerms>> = true;

const vestingStartDamlIsExact: Assert<IsExactly<DamlVestingStartData, ReadonlyDamlDataTypeFor<'vestingStart'>>> = true;
const vestingEventDamlIsExact: Assert<IsExactly<DamlVestingEventData, ReadonlyDamlDataTypeFor<'vestingEvent'>>> = true;
const vestingAccelerationDamlIsExact: Assert<
  IsExactly<DamlVestingAccelerationData, ReadonlyDamlDataTypeFor<'vestingAcceleration'>>
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
declare const vestingTermsResult: GetVestingTermsAsOcfResult;
declare const publicVestingStartData: PublicVestingStartData;

// @ts-expect-error built vesting start cannot be used as a vesting event
const wrongVestingEvent: OcfVestingEvent = vestingStartResult.event;
// @ts-expect-error built vesting event cannot be used as vesting acceleration
const wrongVestingAcceleration: OcfVestingAcceleration = vestingEventResult.event;
// @ts-expect-error built vesting acceleration cannot be used as vesting start
const wrongVestingStart: OcfVestingStart = vestingAccelerationResult.event;
// @ts-expect-error built root OcpClient vesting-start data cannot be used as vesting terms
const wrongPublicVestingTerms: OcfVestingTerms = publicVestingStartData;
// @ts-expect-error built reader result payload is readonly
vestingStartResult.event = vestingStartResult.event;
// @ts-expect-error built reader result contract ID is readonly
vestingEventResult.contractId = 'replacement';
// @ts-expect-error built reader result payload is readonly
vestingAccelerationResult.event = vestingAccelerationResult.event;
// @ts-expect-error built reader result contract ID is readonly
vestingTermsResult.contractId = 'replacement';

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
