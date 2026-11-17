// Story Director v2, part **arc**: the Director judge's call (switch story-director.world-events). One Quick call judges the planner's beats, clocks and agendas
// against the world (accept / reshape / refuse) and writes the arc's world note. Asked once per plan, in the controller's plan step, never in a command: the verdicts
// and the note are stored with the arc, so a replay never asks again. A call that does not answer in time, fails or answers in no readable way leaves the code guard's
// result as it is (the judge never blocks a plan). → `{ read, refused, judge, world }`.

import { applyJudge } from './apply.js';
import { judgeContext } from './context.js';
import { JUDGE_SYSTEM, judgePrompt } from './prompt.js';
import { readJudge } from './read.js';
import { scrubJudge } from './scrub.js';
import { itemLine } from '../plan/read.js';

export const JUDGE_FEATURE = 'story-director.world-events';
const MODULE = 'story-director arc judge';
const JUDGE_MS = 20000;
const MAX_TOKENS = 500;
const NOT_A_CALL = new Set(['BUSY', 'ABORTED', 'UNAVAILABLE', 'FEATURE_OFF']);
const JUDGED = new Set(['beat', 'clock', 'agenda']);

/**
 * `read`: readPlan's result after the guard; `brief`: `chronicle.world.brief`; `ask(name, args)`: the host's query; `options`: the plan reader's options.
 * `judge` is `{ calls, accept, reshape, refuse, fell }` (stored with the arc; `fell`: the call gave no usable answer), null when no call was made;
 * `world` is the arc's world note ('' when there is none).
 */
export async function judgePlan({ api, read, brief, ask, place = '', options = {}, signal } = {}) {
    const judged = (read?.items ?? []).filter(item => JUDGED.has(item.kind));
    const none = { read, refused: [], judge: null, world: '' };
    if (!brief || !judged.length || typeof api?.callModel !== 'function') return none;
    const request = {
        role: 'quick', module: MODULE, feature: JUDGE_FEATURE, system: JUDGE_SYSTEM, signal, timeoutMs: JUDGE_MS, maxTokens: MAX_TOKENS,
        prompt: judgePrompt({ arc: read.arc ? `${read.arc.key}${read.arc.desc ? ` — ${read.arc.desc}` : ''}` : '', lines: judged.map(itemLine), world: judgeContext({ brief, ask, place }) }),
    };
    let out = null;
    try { out = await api.callModel(request); } catch { out = null; }
    if (!out?.ok && NOT_A_CALL.has(out?.error)) return none;
    // The secrets are kept out of the NOTE, the reasons and the reshaped lines before anything is applied or stored (scrub.js, final review H1).
    const answer = out?.ok ? scrubJudge(readJudge(out.text), brief.secrets) : null;
    if (!answer) return { ...none, judge: { calls: 1, accept: 0, reshape: 0, refuse: 0, fell: true } };
    const applied = applyJudge(read, answer, brief.guard, options);
    return { read: applied.read, refused: applied.refused, judge: { calls: 1, ...applied.tally, fell: false }, world: answer.note };
}
