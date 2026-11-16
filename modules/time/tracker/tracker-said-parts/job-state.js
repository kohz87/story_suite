// Predicates determining whether a record is a job, an open offer, or taken on as a quest.

import { QUEST_TYPE_WORDS, lineKey } from '../../../world/changes.js';

// Work {{user}} took on (0.8.6): a hook or event that a `~` names a quest (`type: quest`, or a
// category such as bounty), or that is a job — it has, or the `~` gives it, a giver, a reward or
// a quest category — and the `~` moves it on (a giver, reward, goal, step or difficulty). So
// `~ Wolf pelts — step: tracking the pack` on a hook the planner offered with its reward makes
// the bounty a quest (0.9.4), while a step on a plain thread ("River stranger") does not
// (0.9.2: models write `step:` for any progress). Beats are the world's, never a quest.
export const BECOMES_QUEST = new Set(['hook', 'event']);
const JOB_FIELDS = ['giver', 'reward'];
const MOVES_ON = ['giver', 'reward', 'goal', 'step', 'difficulty'];

const isQuestType = value => {
    const type = lineKey(value ?? '');
    return type === 'quest' || Object.hasOwn(QUEST_TYPE_WORDS, type);
};

export const isJob = record => BECOMES_QUEST.has(record.kind)
    && (JOB_FIELDS.some(name => String(record.fields?.[name] ?? '').trim()) || isQuestType(record.fields?.type));

/** (0.9.15) An offer: a job (a giver, a reward or a quest type) the reader has not taken on yet. */
export function isOffer(record) {
    return record?.status === 'active' && isJob(record);
}

export function takesOnQuest(record, op) {
    if (!BECOMES_QUEST.has(record.kind)) return false;
    const fields = op.fields ?? {};
    if (isQuestType(fields.type)) return true;
    const given = name => String(fields[name] ?? '').trim();
    const job = JOB_FIELDS.some(name => given(name) || String(record.fields?.[name] ?? '').trim()) || isQuestType(record.fields?.type);
    return job && MOVES_ON.some(given);
}
