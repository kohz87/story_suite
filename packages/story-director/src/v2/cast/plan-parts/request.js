// Story Director v2, part **cast**: building `{ system, prompt }` requests for the cast planner.

import { MAX_DOING, MAX_PLACE, cutPoints, cutWords, flat } from '../domain.js';
import { MAX_PEOPLE_ASKED, MAX_SOUGHT } from './limits.js';
import { RECENT_CHARS, SOUGHT_CHARS, SOUGHT_SYSTEM, SYSTEM } from './prompts.js';

const FORMAT = `Answer with only lines, one per change, in this form:
~ cast ref | place | what they are doing now
> cast ref | what in the story pulls them to {{user}}
! cast ref | how they died   (only for a person marked "may die")`;

const JUDGE_FORMAT = `Answer with only lines, in this form, for the people whose drawn-to phrase the recent story touches (none at all is fine):
> cast ref | what in the story pulls them to {{user}}`;

const soughtFormat = ref => `Answer with only one line, in this form, or nothing at all (the ref is the first word of the person's line above, for example ${ref}):
? cast ref | "the words that ask for them, copied from the message or the reply"`;

const NONE = '(none)';

/** A person as the planner reads them: `{ ref, name, goal, routine, where, doing, drawnTo, met, mayDie }`. */
function personLine(person) {
    const parts = [
        `${person.ref} | ${cutPoints(person.name, 60)}`,
        person.goal ? `goal: ${cutPoints(person.goal, 120)}` : '',
        person.routine ? `routine: ${cutPoints(person.routine, 100)}` : '',
        `now at: ${cutPoints(person.where, MAX_PLACE) || 'unknown'}`,
        person.doing ? `doing: ${cutWords(person.doing, MAX_DOING)}` : '',
        person.drawnTo?.length ? `drawn to: ${person.drawnTo.map(phrase => cutPoints(phrase, 80)).join('; ')}` : '',
        person.kind ? `calling: ${cutPoints(person.kind.calling, 100) || 'none'} | about: ${cutPoints(person.kind.lead, 100)}` : '',
        person.met ? 'has met them' : 'has not met them',
        person.mayDie ? 'may die' : '',
    ];
    return `- ${parts.filter(Boolean).join(' | ')}`;
}

/**
 * The call's `{ system, prompt }`. `mode`: 'batch' (moves, comes, deaths) or 'judge' (comes only). `people` are the ones asked about (at
 * most MAX_PEOPLE_ASKED, the caller's order); `elapsed` the time that passed in words; `places` the world's place names.
 */
export function castRequest({ mode = 'batch', people = [], now = '', elapsed = '', place = '', places = [], recent = '', texts = null } = {}) {
    if (mode === 'sought') return soughtRequest({ people, now, place, texts });
    const list = people.slice(0, MAX_PEOPLE_ASKED).map(personLine);
    const body = [
        `Now: ${flat(now) || 'unknown'}${elapsed ? ` (${flat(elapsed)} since the cast last moved)` : ''}`,
        `{{user}} is at: ${flat(place) || 'unknown'}`,
        `Places of this world: ${places.slice(0, 30).map(name => cutPoints(name, MAX_PLACE)).join(', ') || NONE}`,
        '',
        'The cast:',
        list.join('\n') || NONE,
        '',
        'Recent story:',
        String(recent ?? '').slice(-RECENT_CHARS).trim() || NONE,
        '',
        mode === 'judge' ? JUDGE_FORMAT : FORMAT,
    ].join('\n');
    return { system: SYSTEM, prompt: body };
}

/** The 'sought' call: the unmet people who might fit (`kind`: calling and lead, no more) and the two texts it reads (`texts`: { reader, reply }). */
function soughtRequest({ people, now, place, texts }) {
    const cut = value => String(value ?? '').slice(-SOUGHT_CHARS).trim() || NONE;
    const body = [
        `Now: ${flat(now) || 'unknown'}`,
        `{{user}} is at: ${flat(place) || 'unknown'}`,
        '',
        'People who might fit (none of them has met {{user}}):',
        people.slice(0, MAX_SOUGHT).map(personLine).join('\n') || NONE,
        '',
        "{{user}}'s latest message:",
        cut(texts?.reader),
        '',
        "The story's last reply:",
        cut(texts?.reply),
        '',
        soughtFormat(people[0]?.ref ?? 'ref'),
    ].join('\n');
    return { system: SOUGHT_SYSTEM, prompt: body };
}
