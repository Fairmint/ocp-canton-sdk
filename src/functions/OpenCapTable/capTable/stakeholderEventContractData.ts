import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import {
  assertSafeGeneratedDamlJson,
  generatedDamlDecoderSource,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
} from '../../../utils/generatedDamlValidation';
import {
  preflightDamlStakeholderStatus,
  preflightOptionalDamlStakeholderRelationship,
  validateStakeholderEventDamlSemantics,
} from '../shared/stakeholderEventValues';
import { validatePartyId } from '../../../utils/validation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { assertLosslessGeneratedDamlRoundTrip } from './damlCodecLosslessness';

/** Entity kinds that use a generated stakeholder-event contract wrapper. */
export type StakeholderEventEntityType = Extract<
  OcfEntityType,
  'stakeholderRelationshipChangeEvent' | 'stakeholderStatusChangeEvent'
>;

export function isStakeholderEventEntityType(entityType: OcfEntityType): entityType is StakeholderEventEntityType {
  return entityType === 'stakeholderRelationshipChangeEvent' || entityType === 'stakeholderStatusChangeEvent';
}

interface StakeholderEventCreateArgumentMap {
  stakeholderRelationshipChangeEvent: Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent;
  stakeholderStatusChangeEvent: Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent;
}

type StakeholderEventDataFor<EntityType extends StakeholderEventEntityType> =
  StakeholderEventCreateArgumentMap[EntityType]['event_data'];

interface StakeholderEventCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ):
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: { readonly at: string; readonly message: string } };
  };
  encode(value: T): unknown;
}

type StakeholderEventDecoderMap = {
  readonly [EntityType in StakeholderEventEntityType]: (createArgument: unknown) => StakeholderEventDataFor<EntityType>;
};

function createArgumentError(
  entityType: StakeholderEventEntityType,
  rootPath: string,
  message: string,
  context: Readonly<Record<string, unknown>>,
  source = rootPath
): OcpParseError {
  return new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      ...context,
    },
  });
}

function createStakeholderEventDecoder<const EntityType extends StakeholderEventEntityType>(
  entityType: EntityType,
  codec: StakeholderEventCreateArgumentCodec<StakeholderEventCreateArgumentMap[EntityType]>
): (createArgument: unknown) => StakeholderEventDataFor<EntityType> {
  return (createArgument) => {
    const rootPath = `damlToOcf.${entityType}.createArgument`;
    const context = { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] } as const;
    assertSafeGeneratedDamlJson(createArgument, rootPath);
    const wrapper = requireGeneratedRecord(createArgument, rootPath);
    rejectUnknownGeneratedFields(wrapper, rootPath, ['context', 'event_data']);
    const eventDataPath = `${rootPath}.event_data`;
    const eventData = requireGeneratedRecord(wrapper.event_data, eventDataPath);
    if (entityType === 'stakeholderRelationshipChangeEvent') {
      for (const field of ['relationship_started', 'relationship_ended'] as const) {
        preflightOptionalDamlStakeholderRelationship(eventData[field], `${eventDataPath}.${field}`);
      }
    } else {
      preflightDamlStakeholderStatus(eventData.new_status, `${eventDataPath}.new_status`);
    }

    let decoded: StakeholderEventCreateArgumentMap[EntityType];
    try {
      const result = codec.decoder.run(createArgument);
      if (!result.ok) {
        const source = generatedDamlDecoderSource(rootPath, result.error.at, result.error.message);
        throw createArgumentError(
          entityType,
          rootPath,
          `Invalid generated DAML create argument for ${entityType} at ${result.error.at}: ${result.error.message}`,
          { decoderPath: result.error.at, decoderMessage: result.error.message },
          source
        );
      }
      decoded = result.result;
    } catch (error) {
      if (error instanceof OcpParseError) throw error;
      throw createArgumentError(
        entityType,
        rootPath,
        `Unable to decode generated DAML create argument for ${entityType}: ${toSafeDiagnosticText(error)}`,
        { phase: 'decode' }
      );
    }

    validatePartyId(decoded.context.issuer, `${rootPath}.context.issuer`);
    validatePartyId(decoded.context.system_operator, `${rootPath}.context.system_operator`);

    let encoded: unknown;
    try {
      encoded = codec.encode(decoded);
    } catch (error) {
      throw createArgumentError(
        entityType,
        rootPath,
        `Unable to encode generated DAML create argument for ${entityType}: ${toSafeDiagnosticText(error)}`,
        { phase: 'encode' }
      );
    }

    assertSafeGeneratedDamlJson(encoded, `${rootPath}.__encoded`);
    assertLosslessGeneratedDamlRoundTrip(createArgument, encoded, {
      rootPath,
      description: `${entityType} create argument`,
      decodeSource: rootPath,
      context,
    });
    validateStakeholderEventDamlSemantics(entityType, decoded.event_data, eventDataPath);
    return decoded.event_data;
  };
}

const STAKEHOLDER_EVENT_DECODER_MAP = {
  stakeholderRelationshipChangeEvent: createStakeholderEventDecoder(
    'stakeholderRelationshipChangeEvent',
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent
  ),
  stakeholderStatusChangeEvent: createStakeholderEventDecoder(
    'stakeholderStatusChangeEvent',
    Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent
  ),
} as const satisfies StakeholderEventDecoderMap;

/** Decode the exact generated contract wrapper and return its correlated event payload. */
export function extractAndDecodeStakeholderEventData<const EntityType extends StakeholderEventEntityType>(
  entityType: EntityType,
  createArgument: unknown
): StakeholderEventDataFor<EntityType> {
  return STAKEHOLDER_EVENT_DECODER_MAP[entityType](createArgument);
}
