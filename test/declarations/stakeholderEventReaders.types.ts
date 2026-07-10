/** Built-declaration contracts for stakeholder event readers, converters, and writers. */

import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';
import type {
  DamlStakeholderRelationshipChangeData,
  damlStakeholderRelationshipChangeEventToNative,
} from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/damlToOcf';
import type { GetStakeholderRelationshipChangeEventAsOcfResult } from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/getStakeholderRelationshipChangeEventAsOcf';
import type { stakeholderRelationshipChangeEventDataToDaml } from '../../dist/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import type {
  DamlStakeholderStatusChangeData,
  damlStakeholderStatusChangeEventToNative,
} from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/damlToOcf';
import type { GetStakeholderStatusChangeEventAsOcfResult } from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/getStakeholderStatusChangeEventAsOcf';
import type { stakeholderStatusChangeEventDataToDaml } from '../../dist/functions/OpenCapTable/stakeholderStatusChangeEvent/stakeholderStatusChangeEventDataToDaml';
import type {
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  StakeholderRelationshipType,
  StakeholderStatus,
} from '../../dist/types/native';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type RelationshipEvent = GetStakeholderRelationshipChangeEventAsOcfResult['event'];
type StatusEvent = GetStakeholderStatusChangeEventAsOcfResult['event'];

const relationshipEventIsExact: Assert<IsExactly<RelationshipEvent, OcfStakeholderRelationshipChangeEvent>> = true;
const statusEventIsExact: Assert<IsExactly<StatusEvent, OcfStakeholderStatusChangeEvent>> = true;
const relationshipResultIsExact: Assert<
  IsExactly<
    GetStakeholderRelationshipChangeEventAsOcfResult,
    { event: OcfStakeholderRelationshipChangeEvent; contractId: string }
  >
> = true;
const statusResultIsExact: Assert<
  IsExactly<GetStakeholderStatusChangeEventAsOcfResult, { event: OcfStakeholderStatusChangeEvent; contractId: string }>
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

const relationshipWriterOutputIsExact: Assert<
  IsExactly<
    ReturnType<typeof stakeholderRelationshipChangeEventDataToDaml>,
    DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>
  >
> = true;
const statusWriterOutputIsExact: Assert<
  IsExactly<ReturnType<typeof stakeholderStatusChangeEventDataToDaml>, DamlDataTypeFor<'stakeholderStatusChangeEvent'>>
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
void relationshipWriterOutputIsExact;
void statusWriterOutputIsExact;
void relationshipWriterOutputIsNotAny;
void statusWriterOutputIsNotAny;
void relationshipAtLeastOneShapeIsExact;
void statusUnionIsExact;
void startedOnlyRelationship;
void endedOnlyRelationship;
void bothRelationships;
void neitherRelationship;
void undefinedRelationship;
void wrongStatusDamlInput;
void wrongRelationshipDamlInput;
void wrongStatusEvent;
void wrongRelationshipEvent;
void wrongStatusWriterOutput;
void wrongRelationshipWriterOutput;
void invalidStatus;
