import { OcpErrorCodes } from '../../src/errors';
import { findExerciseResults, requireExerciseResult } from '../../src/functions/OpenCapTable/shared/exerciseResult';
import {
  AUTHORIZATION_TEMPLATE_ID,
  AUTHORIZATION_TEMPLATE_NAME,
  FACTORY_TEMPLATE_ID,
  createdEvent,
  exercisedEvent,
  transaction,
} from './setupFixtures';

const CHOICE = 'IssuerAuthorization_TaAccept';

describe('exercise results of a ledger-effects transaction', () => {
  it('matches the template by module and entity in either template-ID form', () => {
    const response = transaction([exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, CHOICE, 'result-1')]);

    expect(findExerciseResults(response, { templateId: AUTHORIZATION_TEMPLATE_NAME, choice: CHOICE })).toEqual([
      'result-1',
    ]);
    expect(findExerciseResults(response, { templateId: AUTHORIZATION_TEMPLATE_ID, choice: CHOICE })).toEqual([
      'result-1',
    ]);
  });

  it('leaves out other choices, other contracts, other templates and events without a result', () => {
    const response = transaction([
      exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, 'IssuerAuthorization_Withdraw', 'other-choice'),
      exercisedEvent('c-2', AUTHORIZATION_TEMPLATE_ID, CHOICE, 'other-contract'),
      exercisedEvent('c-1', FACTORY_TEMPLATE_ID, CHOICE, 'other-template'),
      exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, CHOICE, undefined),
      { ExercisedEvent: { contractId: 'c-1', choice: CHOICE, exerciseResult: 'no template' } },
      createdEvent('c-1', AUTHORIZATION_TEMPLATE_ID, {}),
      'not an event',
      exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, CHOICE, 'wanted'),
    ]);

    expect(
      findExerciseResults(response, { templateId: AUTHORIZATION_TEMPLATE_NAME, choice: CHOICE, contractId: 'c-1' })
    ).toEqual(['wanted']);
  });

  it('finds nothing in a transaction without an event list', () => {
    const response = { transaction: { events: undefined } } as never;

    expect(findExerciseResults(response, { templateId: AUTHORIZATION_TEMPLATE_NAME, choice: CHOICE })).toEqual([]);
  });

  it('requires exactly one result', () => {
    const query = { templateId: AUTHORIZATION_TEMPLATE_NAME, choice: CHOICE };

    expect(() => requireExerciseResult(transaction([]), query)).toThrow(
      expect.objectContaining({
        name: 'OcpContractError',
        code: OcpErrorCodes.RESULT_NOT_FOUND,
        classification: 'missing_exercise_result',
        choice: CHOICE,
      })
    );
    expect(() =>
      requireExerciseResult(
        transaction([
          exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, CHOICE, 'a'),
          exercisedEvent('c-2', AUTHORIZATION_TEMPLATE_ID, CHOICE, 'b'),
        ]),
        query
      )
    ).toThrow(
      expect.objectContaining({ code: OcpErrorCodes.SCHEMA_MISMATCH, classification: 'ambiguous_exercise_result' })
    );
    expect(
      requireExerciseResult(
        transaction([exercisedEvent('c-1', AUTHORIZATION_TEMPLATE_ID, CHOICE, { ok: true })]),
        query
      )
    ).toEqual({ ok: true });
  });
});
