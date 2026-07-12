/** Exact built-declaration contracts for stakeholder event readers, writers, operations, batches, and OcpClient. */

import type { OcpClient } from '../../dist/OcpClient';
import type {
  DamlDataTypeFor,
  OcfCreateDataFor,
  OcfEditDataFor,
  OcfReadDataTypeFor,
} from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../dist/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../dist/functions/OpenCapTable/capTable/ocfToDaml';
import type {
  DamlStakeholderRelationshipChangeData,
  damlStakeholderRelationshipChangeEventToNative,
} from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/damlToOcf';
import type { GetStakeholderRelationshipChangeEventAsOcfResult } from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/getStakeholderRelationshipChangeEventAsOcf';
import { stakeholderRelationshipChangeEventDataToDaml } from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import type {
  DamlStakeholderStatusChangeData,
  damlStakeholderStatusChangeEventToNative,
} from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/damlToOcf';
import type { GetStakeholderStatusChangeEventAsOcfResult } from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/getStakeholderStatusChangeEventAsOcf';
import { stakeholderStatusChangeEventDataToDaml } from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/stakeholderStatusChangeEventDataToDaml';
import type {
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  StakeholderRelationshipType,
  StakeholderStatus,
} from '../../dist/types/native';
import type {
  OcfStakeholderRelationshipChangeEventOutput,
  OcfStakeholderStatusChangeEventOutput,
} from '../../dist/types/output';
import type { DamlStakeholderRelationshipType, DamlStakeholderStatus } from '../../dist/utils/enumConversions';

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
type EveryTrue<T extends readonly boolean[]> = Exclude<T[number], true> extends never ? true : false;

type RelationshipEvent = GetStakeholderRelationshipChangeEventAsOcfResult['event'];
type StatusEvent = GetStakeholderStatusChangeEventAsOcfResult['event'];

const relationshipEventIsExact: Assert<
  IsExactly<RelationshipEvent, OcfStakeholderRelationshipChangeEventOutput>
> = true;
const statusEventIsExact: Assert<IsExactly<StatusEvent, OcfStakeholderStatusChangeEventOutput>> = true;
const relationshipResultIsExact: Assert<
  IsExactly<
    GetStakeholderRelationshipChangeEventAsOcfResult,
    { readonly event: OcfStakeholderRelationshipChangeEventOutput; readonly contractId: string }
  >
> = true;
const statusResultIsExact: Assert<
  IsExactly<
    GetStakeholderStatusChangeEventAsOcfResult,
    { readonly event: OcfStakeholderStatusChangeEventOutput; readonly contractId: string }
  >
> = true;

const relationshipEventIsNotAny: Assert<IsExactly<IsAny<RelationshipEvent>, false>> = true;
const statusEventIsNotAny: Assert<IsExactly<IsAny<StatusEvent>, false>> = true;
const relationshipResultIsNotAny: Assert<IsExactly<IsAny<GetStakeholderRelationshipChangeEventAsOcfResult>, false>> =
  true;
const statusResultIsNotAny: Assert<IsExactly<IsAny<GetStakeholderStatusChangeEventAsOcfResult>, false>> = true;

const relationshipDamlIsExact: Assert<
  IsExactly<DamlStakeholderRelationshipChangeData, DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>>
> = true;
const statusDamlIsExact: Assert<
  IsExactly<DamlStakeholderStatusChangeData, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>
> = true;
const relationshipConverterInputIsExact: Assert<
  IsExactly<
    Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0],
    DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>
  >
> = true;
const statusConverterInputIsExact: Assert<
  IsExactly<
    Parameters<typeof damlStakeholderStatusChangeEventToNative>[0],
    DamlDataTypeFor<'stakeholderStatusChangeEvent'>
  >
> = true;
const relationshipConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0]>, false>
> = true;
const statusConverterInputIsNotAny: Assert<
  IsExactly<IsAny<Parameters<typeof damlStakeholderStatusChangeEventToNative>[0]>, false>
> = true;
const relationshipConverterOutputIsExact: Assert<
  IsExactly<
    ReturnType<typeof damlStakeholderRelationshipChangeEventToNative>,
    OcfReadDataTypeFor<'stakeholderRelationshipChangeEvent'>
  >
> = true;
const statusConverterOutputIsExact: Assert<
  IsExactly<
    ReturnType<typeof damlStakeholderStatusChangeEventToNative>,
    OcfReadDataTypeFor<'stakeholderStatusChangeEvent'>
  >
> = true;

const relationshipWriterOutputIsExact: Assert<
  IsExactly<
    ReturnType<typeof stakeholderRelationshipChangeEventDataToDaml>,
    DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>
  >
> = true;
const relationshipWriterInputIsExact: Assert<
  IsExactly<Parameters<typeof stakeholderRelationshipChangeEventDataToDaml>[0], OcfStakeholderRelationshipChangeEvent>
> = true;
const statusWriterOutputIsExact: Assert<
  IsExactly<ReturnType<typeof stakeholderStatusChangeEventDataToDaml>, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>
> = true;
const statusWriterInputIsExact: Assert<
  IsExactly<Parameters<typeof stakeholderStatusChangeEventDataToDaml>[0], OcfStakeholderStatusChangeEvent>
> = true;
const relationshipWriterOutputIsNotAny: Assert<
  IsExactly<IsAny<ReturnType<typeof stakeholderRelationshipChangeEventDataToDaml>>, false>
> = true;
const statusWriterOutputIsNotAny: Assert<
  IsExactly<IsAny<ReturnType<typeof stakeholderStatusChangeEventDataToDaml>>, false>
> = true;

interface RelationshipEventCommon {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP';
  id: string;
  date: string;
  stakeholder_id: string;
  comments?: string[];
}

type ExpectedRelationshipEventShape = RelationshipEventCommon &
  (
    | {
        relationship_started: StakeholderRelationshipType;
        relationship_ended?: StakeholderRelationshipType;
      }
    | {
        relationship_started?: StakeholderRelationshipType;
        relationship_ended: StakeholderRelationshipType;
      }
  );

const relationshipAtLeastOneShapeIsExact: Assert<
  IsExactly<OcfStakeholderRelationshipChangeEvent, ExpectedRelationshipEventShape>
> = true;
const statusUnionIsExact: Assert<IsExactly<OcfStakeholderStatusChangeEvent['new_status'], StakeholderStatus>> = true;

const startedOnlyRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'started-only',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
  relationship_started: 'EMPLOYEE',
};
const endedOnlyRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'ended-only',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
  relationship_ended: 'EX_EMPLOYEE',
};
const bothRelationships: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'both',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
  relationship_started: 'ADVISOR',
  relationship_ended: 'EMPLOYEE',
};
const activeStatus: OcfStakeholderStatusChangeEvent = {
  object_type: 'CE_STAKEHOLDER_STATUS',
  id: 'active-status',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
  new_status: 'ACTIVE',
  comments: ['active'],
};
// @ts-expect-error built relationship events require a started or ended relationship
const neitherRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'neither',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
};
// @ts-expect-error built exact optional relationship fields cannot be explicitly undefined
const undefinedRelationship: OcfStakeholderRelationshipChangeEvent = {
  object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  id: 'undefined',
  date: '2026-07-10',
  stakeholder_id: 'stakeholder-1',
  relationship_started: undefined,
  relationship_ended: undefined,
};

declare const relationshipResult: GetStakeholderRelationshipChangeEventAsOcfResult;
declare const statusResult: GetStakeholderStatusChangeEventAsOcfResult;
declare const relationshipDaml: DamlStakeholderRelationshipChangeData;
declare const statusDaml: DamlStakeholderStatusChangeData;
declare const relationshipWriterOutput: ReturnType<typeof stakeholderRelationshipChangeEventDataToDaml>;
declare const statusWriterOutput: ReturnType<typeof stakeholderStatusChangeEventDataToDaml>;
declare const client: OcpClient;

const directRelationship = stakeholderRelationshipChangeEventDataToDaml(bothRelationships);
const directStatus = stakeholderStatusChangeEventDataToDaml(activeStatus);
const genericRelationship = convertToDaml('stakeholderRelationshipChangeEvent', bothRelationships);
const genericStatus = convertToDaml('stakeholderStatusChangeEvent', activeStatus);
const operationRelationship = convertOperationToDaml({
  type: 'stakeholderRelationshipChangeEvent',
  data: bothRelationships,
});
const operationStatus = convertOperationToDaml({ type: 'stakeholderStatusChangeEvent', data: activeStatus });
const createRelationship = buildOcfCreateData('stakeholderRelationshipChangeEvent', bothRelationships);
const createStatusOperation = buildOcfCreateDataFromOperation({
  type: 'stakeholderStatusChangeEvent',
  data: activeStatus,
});
const editRelationshipOperation = buildOcfEditDataFromOperation({
  type: 'stakeholderRelationshipChangeEvent',
  data: bothRelationships,
});
const editStatus = buildOcfEditData('stakeholderStatusChangeEvent', activeStatus);

const clientRelationship = client.OpenCapTable.stakeholderRelationshipChangeEvent.get({ contractId: 'contract-id' });
const clientStatus = client.OpenCapTable.stakeholderStatusChangeEvent.get({ contractId: 'contract-id' });
const objectTypeRelationship = client.OpenCapTable.getByObjectType({
  objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
  contractId: 'contract-id',
});
const objectTypeStatus = client.OpenCapTable.getByObjectType({
  objectType: 'CE_STAKEHOLDER_STATUS',
  contractId: 'contract-id',
});

const builtWriterDispatcherAndOperationTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof directRelationship, DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>>,
      IsExactly<typeof directStatus, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>,
      IsExactly<typeof genericRelationship, DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>>,
      IsExactly<typeof genericStatus, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>,
      IsExactly<typeof operationRelationship, DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>>,
      IsExactly<typeof operationStatus, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>,
    ]
  >
> = true;
const builtBatchTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<typeof createRelationship, OcfCreateDataFor<'stakeholderRelationshipChangeEvent'>>,
      IsExactly<typeof createStatusOperation, OcfCreateDataFor<'stakeholderStatusChangeEvent'>>,
      IsExactly<typeof editRelationshipOperation, OcfEditDataFor<'stakeholderRelationshipChangeEvent'>>,
      IsExactly<typeof editStatus, OcfEditDataFor<'stakeholderStatusChangeEvent'>>,
    ]
  >
> = true;
const builtClientTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<
        Awaited<typeof clientRelationship>['data'],
        OcfReadDataTypeFor<'stakeholderRelationshipChangeEvent'>
      >,
      IsExactly<Awaited<typeof clientStatus>['data'], OcfReadDataTypeFor<'stakeholderStatusChangeEvent'>>,
      IsExactly<
        Awaited<typeof objectTypeRelationship>['data'],
        OcfReadDataTypeFor<'stakeholderRelationshipChangeEvent'>
      >,
      IsExactly<Awaited<typeof objectTypeStatus>['data'], OcfReadDataTypeFor<'stakeholderStatusChangeEvent'>>,
      IsExactly<IsAny<Awaited<typeof objectTypeRelationship>['data']>, false>,
      IsExactly<IsAny<Awaited<typeof objectTypeStatus>['data']>, false>,
    ]
  >
> = true;
const builtGeneratedPayloadTypesAreExact: Assert<
  EveryTrue<
    [
      IsExactly<
        Exclude<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_started'], null>,
        DamlStakeholderRelationshipType
      >,
      IsExactly<
        Exclude<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_ended'], null>,
        DamlStakeholderRelationshipType
      >,
      IsExactly<Extract<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_started'], null>, null>,
      IsExactly<Extract<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_ended'], null>, null>,
      IsExactly<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['comments'], string[]>,
      IsExactly<DamlDataTypeFor<'stakeholderStatusChangeEvent'>['new_status'], DamlStakeholderStatus>,
      IsExactly<DamlDataTypeFor<'stakeholderStatusChangeEvent'>['comments'], string[]>,
      IsExactly<IsAny<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_started']>, false>,
      IsExactly<IsAny<DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>['relationship_ended']>, false>,
      IsExactly<IsAny<DamlDataTypeFor<'stakeholderStatusChangeEvent'>['new_status']>, false>,
    ]
  >
> = true;

// @ts-expect-error built stakeholder reader results are immutable snapshots
relationshipResult.event.id = 'mutated';
// @ts-expect-error built nested comments are recursively readonly
relationshipResult.event.comments?.push('mutated');
// @ts-expect-error built status reader results are immutable snapshots
statusResult.event.new_status = 'LEAVE_OF_ABSENCE';
// @ts-expect-error built client result wrappers expose readonly contract identities
(null as unknown as Awaited<typeof clientStatus>).contractId = 'mutated';

// @ts-expect-error built relationship DAML cannot be passed to the status converter
const wrongStatusDamlInput: Parameters<typeof damlStakeholderStatusChangeEventToNative>[0] = relationshipDaml;
// @ts-expect-error built status DAML cannot be passed to the relationship converter
const wrongRelationshipDamlInput: Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0] = statusDaml;
// @ts-expect-error a built relationship event cannot be used as a status event
const wrongStatusEvent: OcfStakeholderStatusChangeEvent = relationshipResult.event;
// @ts-expect-error a built status event cannot be used as a relationship event
const wrongRelationshipEvent: OcfStakeholderRelationshipChangeEvent = statusResult.event;
// @ts-expect-error built relationship writer output cannot be used as status DAML
const wrongStatusWriterOutput: DamlDataTypeFor<'stakeholderStatusChangeEvent'> = relationshipWriterOutput;
// @ts-expect-error built status writer output cannot be used as relationship DAML
const wrongRelationshipWriterOutput: DamlDataTypeFor<'stakeholderRelationshipChangeEvent'> = statusWriterOutput;
// @ts-expect-error built stakeholder status is a closed canonical union
const invalidStatus: OcfStakeholderStatusChangeEvent['new_status'] = 'SABBATICAL';
// @ts-expect-error built generic writers preserve stakeholder event/data correlation
convertToDaml('stakeholderStatusChangeEvent', bothRelationships);
// @ts-expect-error built operation writers preserve stakeholder event/data correlation
convertOperationToDaml({ type: 'stakeholderRelationshipChangeEvent', data: activeStatus });
// @ts-expect-error built generated batch writers preserve stakeholder event/data correlation
buildOcfCreateData('stakeholderRelationshipChangeEvent', activeStatus);

void relationshipEventIsExact;
void statusEventIsExact;
void relationshipResultIsExact;
void statusResultIsExact;
void relationshipEventIsNotAny;
void statusEventIsNotAny;
void relationshipResultIsNotAny;
void statusResultIsNotAny;
void relationshipDamlIsExact;
void statusDamlIsExact;
void relationshipConverterInputIsExact;
void statusConverterInputIsExact;
void relationshipConverterInputIsNotAny;
void statusConverterInputIsNotAny;
void relationshipConverterOutputIsExact;
void statusConverterOutputIsExact;
void relationshipWriterOutputIsExact;
void relationshipWriterInputIsExact;
void statusWriterOutputIsExact;
void statusWriterInputIsExact;
void relationshipWriterOutputIsNotAny;
void statusWriterOutputIsNotAny;
void relationshipAtLeastOneShapeIsExact;
void statusUnionIsExact;
void startedOnlyRelationship;
void endedOnlyRelationship;
void bothRelationships;
void activeStatus;
void neitherRelationship;
void undefinedRelationship;
void wrongStatusDamlInput;
void wrongRelationshipDamlInput;
void wrongStatusEvent;
void wrongRelationshipEvent;
void wrongStatusWriterOutput;
void wrongRelationshipWriterOutput;
void invalidStatus;
void builtWriterDispatcherAndOperationTypesAreExact;
void builtBatchTypesAreExact;
void builtClientTypesAreExact;
void builtGeneratedPayloadTypesAreExact;
void directRelationship;
void directStatus;
void genericRelationship;
void genericStatus;
void operationRelationship;
void operationStatus;
void createRelationship;
void createStatusOperation;
void editRelationshipOperation;
void editStatus;
void clientRelationship;
void clientStatus;
void objectTypeRelationship;
void objectTypeStatus;
