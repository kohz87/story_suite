// Story Director v2, tracker part (note): the Director kinds' grammar lines.

/**
 * The Director kinds' grammar, one line per family where the kinds share a shape (the lean diet, 3 Nov): the kinds of a family
 * other than its carrier have no line of their own (the host leaves a kind with '' out), and the parser reads them as before.
 * `agenda` carries the five world-building threads, `hook` the hook and the quest, `time` itself.
 */
export const GRAMMAR = Object.freeze({
    agenda: '+ agenda|event|clock|beat|secret Name — summary | label: value. Labels: agenda now (where), then (what next), on, leg, arrive; event then, on; clock due, shown: none|sign|warning; beat on, reach (what it changes for {{user}}), encounter (the foes, for a fight); a secret is what must not be revealed yet. Write one whenever the story sets something moving, e.g. + agenda Person A\'s errand — buys goods at Place X | then: back at dusk; + event Festival at Place X — stalls fill the square; + clock Rising water — the level climbs | shown: sign; + beat Offer from Person B — an answer is wanted | reach: {{user}} must choose',
    event: '',
    clock: '',
    beat: '',
    secret: '',
    hook: '+ hook|quest Name — a hook is an open thread or lead (a job only offered stays in the story; once {{user}} accepts it, + quest with the hook\'s name alone: code keeps its summary and labels, add only new ones); a quest is a job {{user}} accepted, not an errand. When a job or lead is finished, paid, failed, given up or no longer matters, close it in the same reply: - quest Name — outcome (or - hook Name) | goal | giver | reward | step | due | difficulty | type. Write a hook when someone mentions a job, rumour or trouble {{user}} could follow, e.g. + hook Missing boatman — Person A says he vanished near Place X | giver: Person A | goal: ask at the docks; once {{user}} agrees: + quest Missing boatman | reward: 20 copper',
    quest: '',
    time: '~ time <date, clock time such as 9:30 am> (the scene\'s time) or ! time +2h (time passes), never both for one stretch',
});

// The grammar Story Director alone writes (no fight runner): a beat is a turn of the story only.
export const GRAMMAR_ALONE = Object.freeze({
    agenda: GRAMMAR.agenda.replace(', encounter (the foes, for a fight)', ''),
});

/** A kind's grammar line for the module set: `fights: false` takes GRAMMAR_ALONE's where it has one. */
export const grammarOf = (kind, { fights = true } = {}) => (fights ? GRAMMAR[kind] : GRAMMAR_ALONE[kind] ?? GRAMMAR[kind]);
