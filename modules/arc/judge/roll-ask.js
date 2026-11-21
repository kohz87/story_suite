// Story Director v2, part **arc**: asking the Director judge about tomorrow's daily roll (switch story-director.world-events): one Quick call per
// story day, in the background, for the events the roll will fire (chronicle setting `judge`) or every eligible one (arc setting `dailyPass`).
// Each answer becomes a stored mark for (event, day): `veto` (a refusal's reason, secrets kept out), `weight` 2 / 0.5 (likelier, less likely; the
// pass only) or 1 (judged, nothing changed). A failed call or one that does not read marks every item 1 (the roll as code made it), so it is not
// asked again; a call that could not be made now is asked again later. The marks reach the chat by the chronicle's store command before a reply.

import { judgeContext } from './context.js';
import { SECRET_REASON, sharesSecret } from './scrub.js';
import { readRoll, rollPrompt, rollSystem } from './roll-prompt.js';
import { judgeScope } from './world-ask.js';

const TRANSIENT = new Set(['BUSY', 'ABORTED', 'UNAVAILABLE', 'FEATURE_OFF']);
const CALL_MS = 20000;
const SCOPES = 3;

/** The marks for `items` from the judge's answer rows (`pass`: likelier / less likely count). */
export function marksOf(items, rows, day, { pass = false, secrets = [] } = {}) {
    const texts = (Array.isArray(secrets) ? secrets : []).map(item => item?.text).filter(text => typeof text === 'string' && text.trim());
    const marks = {};
    items.forEach((item, index) => {
        const row = rows?.[index + 1];
        const key = `${item.id}|${day}`;
        if (row?.verdict === 'refuse') {
            const why = String(row.rest ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
            marks[key] = { veto: !why || /^secret\b/i.test(why) || sharesSecret(why, texts) ? SECRET_REASON : why };
        } else marks[key] = { weight: pass && row?.verdict === 'likelier' ? 2 : pass && row?.verdict === 'less' ? 0.5 : 1 };
    });
    return marks;
}

/** The asker: `kick(view, look, pass)` asks once per (chat, day) for `look` (look-ahead.js's `{ day, items }`); `drain(scope, day)` its marks when done. */
export function createRollAsker() {
    const scopes = new Map();
    const mineOf = scope => {
        const found = scopes.get(scope) ?? new Map();
        scopes.delete(scope);
        scopes.set(scope, found);
        while (scopes.size > SCOPES) scopes.delete(scopes.keys().next().value);
        return found;
    };
    return {
        kick(view, look, pass) {
            if (typeof view?.model?.callModel !== 'function' || !look?.items?.length) return false;
            const mine = mineOf(judgeScope(view));
            if (mine.has(look.day)) return false;
            mine.set(look.day, { status: 'pending' });
            const ask = (name, args) => { try { return view.query(name, args); } catch { return null; } };
            const brief = ask('chronicle.world.brief', {}) ?? {};
            const request = { role: 'quick', module: 'story-director roll judge', feature: 'story-director.world-events', system: rollSystem(pass), maxTokens: 200, timeoutMs: CALL_MS, prompt: rollPrompt({ world: judgeContext({ brief, ask, place: String(ask('scene.place', {})?.name ?? '') }), items: look.items }) };
            Promise.resolve().then(() => view.model.callModel(request)).then(out => {
                if (!out?.ok && TRANSIENT.has(out?.error)) { mine.delete(look.day); return; }
                mine.set(look.day, { status: 'done', marks: marksOf(look.items, out?.ok ? readRoll(out.text) : null, look.day, { pass, secrets: brief.secrets }), calls: 1 });
            }, () => mine.delete(look.day));
            return true;
        },
        drain(scope, day) {
            const entry = scopes.get(scope)?.get(day);
            if (entry?.status !== 'done') return null;
            scopes.get(scope).set(day, { status: 'stored' });
            return { marks: entry.marks, calls: entry.calls };
        },
        clear() { scopes.clear(); },
    };
}

/** The one asker of this module (in memory). */
export const rollAsker = createRollAsker();
