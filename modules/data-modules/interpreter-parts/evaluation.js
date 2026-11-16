// Evaluates a checked definition's expressions, conditions, effects, timers, rules and rewards on a disposable instance.
import { DM_LIMITS as L, dmInt, dmOwn } from '../schema.js';
import { hashJson } from '../../../../../../core/replay.js';
import { STRINGS, fill } from '../../../../../../core/strings.js';
import { refuse } from './errors.js';
import { copy, bytes, atPath } from './values.js';
import { scalarHolds } from './scalars.js';
import { titlePart, entryAt, sameTitle } from './entry-names.js';
import { entryAddProblem } from './entry-lists.js';
import { cleanList } from './labels.js';

export function createEvaluation(definition, instance, { inputs = {}, source, cursor, subject = 'chat', lookup = null, lists = {} } = {}) {
    const original = copy(instance), reads = new Map(), notes = [], decisions = [], conds = [], fired = [], written = new Set();
    let visits = 0, frame = null;
    const charge = (n = 1) => {
        visits += n;
        if (visits > L.rootVisits) refuse('DM_BUDGET', '', `More than ${L.rootVisits} evaluation visits; nothing applied.`);
    };
    // A read of the prefix. A field this root wrote already holds the root's own value, which the root's other reads decided.
    const read = path => {
        const key = JSON.stringify(path);
        if (!reads.has(key) && !written.has(JSON.stringify(path.slice(1)))) reads.set(key, { path: copy(path), value: copy(atPath(original, path)) });
    };
    const integer = value => {
        if (!dmInt(value, -L.integer, L.integer)) refuse('DM_BOUNDS', '', 'Unsafe arithmetic intermediate.');
        return value;
    };
    const pathOf = (path, env) => path.map(key => Array.isArray(key) ? evaluate(key, env) : key);
    function evaluate(node, env = {}) {
        charge();
        if (!Array.isArray(node)) return node;
        const [op, a, b, c] = node;
        if (op === 'get') {
            const path = pathOf(a, env);
            const key = JSON.stringify(path);
            // A guard asking again: the fields of its prefix, except those the root wrote before this condition (recorded).
            if (lookup) return lookup(path, key);
            const value = atPath(instance.fields, path);
            // In a condition the value is not read for itself: only the answer matters (see `condition`).
            if (frame) { if (written.has(key)) frame.internal[key] = value; return value; }
            read(['fields', ...path]);
            return value;
        }
        if (op === 'arg' || op === 'bind' || op === 'reward' || op === 'timer') {
            const value = env[op]?.[a];
            if (value === undefined) refuse('DM_SCHEMA', op, `Missing ${op} ${a}.`);
            return value;
        }
        if (op === 'input') {
            const value = inputs[a]?.[b];
            if (value === undefined || value === null || typeof value === 'object') refuse('DEPENDENCY_UNAVAILABLE', a, `Waiting for input ${a}.${b}.`);
            return value;
        }
        const x = evaluate(a, env);
        if (op === 'not') return !x;
        if (op === 'and') return x && evaluate(b, env);
        if (op === 'or') return x || evaluate(b, env);
        const y = evaluate(b, env);
        if (['add', 'sub', 'mul', 'min', 'max', 'floorDiv', 'clamp'].includes(op)) {
            integer(x); integer(y);
            if (op === 'add') return integer(x + y);
            if (op === 'sub') return integer(x - y);
            if (op === 'mul') return integer(x * y);
            if (op === 'min') return Math.min(x, y);
            if (op === 'max') return Math.max(x, y);
            if (op === 'floorDiv') {
                if (y <= 0) refuse('DM_BOUNDS', '', 'Division needs a positive divisor.');
                return Math.floor(x / y);
            }
            const z = integer(evaluate(c, env));
            if (y > z) refuse('DM_BOUNDS', '', 'Clamp bounds are reversed.');
            return Math.min(z, Math.max(y, x));
        }
        if (op === 'eq') return x === y;
        if (op === 'ne') return x !== y;
        if (op === 'lt') return x < y;
        if (op === 'le') return x <= y;
        if (op === 'gt') return x > y;
        if (op === 'ge') return x >= y;
        refuse('DM_SCHEMA', '', `Unsupported interpreter operation ${op}.`);
    }
    // A condition (a kind's `when`, a rule's, a reward's) is a question with a yes or no. What it read matters only through that
    // answer, so the answer is recorded with the fields it saw that this root had written itself, and a guard asks the same
    // question again on its prefix: an earlier change that leaves the answer as it was does not make the action stale.
    function condition(ref, expression, env) {
        if (typeof expression === 'boolean') return expression;
        const before = frame;
        frame = { internal: {} };
        let outcome;
        try { outcome = Boolean(evaluate(expression, env)); } finally {
            const done = frame;
            frame = before;
            if (outcome !== undefined) conds.push({ ref, env: copy(env), outcome, internal: done.internal });
        }
        return outcome;
    }
    function field(path) {
        const schema = definition.state[path[0]];
        if (!schema || path.length !== (schema.type === 'map' ? 2 : 1)
            || (schema.type === 'map' && !schema.keys.includes(path[1]))) refuse('DM_SCHEMA', path.join('.'), 'Undeclared field path.');
        return schema.type === 'map' ? schema.values : schema;
    }
    function write(path, value, { witness = true } = {}) {
        const schema = field(path);
        if (schema.list === true) value = cleanList(value, schema.max);
        if (!scalarHolds(schema, value)) refuse('DM_BOUNDS', path.join('.'), 'Field value is outside its schema.');
        // Saved ops omit no-ops. Witness the ORIGINAL destination even then: later conditions may
        // use this root's internal value, which is valid only while its starting value is unchanged.
        // (an entry added to a List of entries witnesses the answers it depended on instead, see entryEffect)
        if (witness) read(['fields', ...path]);
        const parent = path.length === 1 ? instance.fields : instance.fields[path[0]];
        parent[path.at(-1)] = value;
        written.add(JSON.stringify(path));
    }
    // A List of entries line. The entry is found by `at`: its number in the list as it stood before this reply (1 is the first; an entry dropped earlier in the
    // reply keeps its number and is refused), else its title (the title part, case and spacing ignored). An add keeps a part the line leaves out at its default.
    // An add does not witness the whole list (a deleted earlier reply would make every later add stale): it records what it asked, that the list has room and no
    // entry has that title, and the guard asks the same again on the prefix; the add itself is an append.
    function entryEffect(effect, env) {
        const [name] = effect.path, schema = field([name]), args = env.arg ?? {};
        const list = [...(atPath(instance.fields, [name]) ?? [])];
        const parts = Object.fromEntries(Object.keys(schema.of).filter(key => dmOwn(args, key)).map(key => [key, args[key]]));
        // (where each entry stood when the reply began: null for one added since)
        const was = lists[name] = lists[name]?.at?.length === list.length ? lists[name] : { size: list.length, at: list.map((_, index) => index) };
        const titleKey = titlePart(definition, name);
        if (effect.op === 'entryAdd') {
            const problem = entryAddProblem(definition, name, list, parts);
            if (problem) refuse(problem.code, problem.path, problem.message);
            list.push(Object.fromEntries(Object.entries(schema.of).map(([key, sub]) => [key, dmOwn(parts, key) ? parts[key] : sub.default])));
            was.at.push(null);
            const fresh = !written.has(JSON.stringify([name]));
            if (fresh) conds.push({ ref: ['entryAdd', name], env: { arg: copy(parts) }, outcome: true, internal: {} });
            write([name], list, { witness: !fresh });
            return;
        }
        const find = () => {
            const at = entryAt(args.at);
            const number = /^#?(\d+)\.?$/.exec(at);
            if (number) {
                const n = Number(number[1]);
                if (n >= 1 && n <= was.size) {
                    const index = was.at.indexOf(n - 1);
                    if (index < 0) refuse('DM_BOUNDS', 'at', fill(STRINGS.blocks.entryDropped, { n }));
                    return index;
                }
            }
            // (not a number in range: a title, so that an entry called "1999" can be reached)
            const hits = titleKey ? list.map((entry, index) => (sameTitle(entry[titleKey], at) ? index : -1)).filter(index => index >= 0) : [];
            if (hits.length > 1) refuse('DM_BOUNDS', 'at', STRINGS.blocks.entryAmbiguous);
            if (!hits.length) refuse('DM_BOUNDS', 'at', STRINGS.blocks.entryMissing);
            return hits[0];
        };
        const at = find();
        if (effect.op === 'entryDrop') { list.splice(at, 1); was.at.splice(at, 1); }
        else {
            if (titleKey && dmOwn(parts, titleKey) && list.some((entry, index) => index !== at && sameTitle(entry[titleKey], parts[titleKey]))) refuse('DM_BOUNDS', titleKey, STRINGS.blocks.entryDuplicate);
            list[at] = { ...list[at], ...parts };
        }
        write([name], list);
    }
    function freezeReward(template, bindings, env) {
        const reward = definition.rewards[template];
        if (!reward) refuse('DM_SCHEMA', template, 'Unknown reward template.');
        const bind = Object.fromEntries(Object.entries(bindings).map(([key, node]) => [key, evaluate(node, env)]));
        const values = {}, ranges = {};
        for (const [name, range] of Object.entries(reward.values)) {
            charge();
            const r = range.table ? range.table[String(bind[range.binding])] : range;
            ranges[name] = copy(r);
            values[name] = r.pick === 'min' ? r.min : r.pick === 'max' ? r.max : r.min + Math.floor((r.max - r.min) / 2);
        }
        const decision = { template, templateHash: hashJson(reward), bind, values, ranges, recipient: subject, source: copy(source), cursor: cursor ? { sid: cursor.sid, swipeKey: cursor.swipeKey, block: cursor.block } : null };
        decisions.push(copy(decision));
        return decision;
    }
    function settle(offer) {
        const reward = definition.rewards[offer.template];
        if (offer.templateHash !== hashJson(reward)) refuse('DM_SCHEMA', offer.template, 'The frozen template is damaged.');
        const env = { bind: offer.bind, reward: offer.values };
        if (!condition(['reward', offer.template], reward.when, env)) refuse('DM_CONDITION', offer.template, 'Reward condition is not met.');
        effects(reward.effects, env);
    }
    function effects(list, env = {}) {
        for (const effect of list) {
            charge();
            if (['set', 'add', 'clamp'].includes(effect.op)) {
                const path = pathOf(effect.path, env);
                const schema = field(path);
                let value;
                if (effect.op === 'set') value = evaluate(effect.value, env);
                else {
                    const before = atPath(instance.fields, path);
                    if (effect.op === 'clamp') value = Math.min(evaluate(effect.max, env), Math.max(evaluate(effect.min, env), before));
                    else {
                        const amount = integer(evaluate(effect.value, env));
                        value = integer(before + amount);
                        if (effect.bounds === 'clamp') {
                            const applied = Math.max(schema.min, Math.min(schema.max, value));
                            if (applied !== value) notes.push(`Requested ${amount >= 0 ? '+' : ''}${amount}; applied ${applied - before >= 0 ? '+' : ''}${applied - before} (${applied}/${schema.max}).`);
                            value = applied;
                        }
                    }
                }
                write(path, value);
            } else if (['entryAdd', 'entrySet', 'entryDrop'].includes(effect.op)) entryEffect(effect, env);
            else if (effect.op === 'reward') settle(freezeReward(effect.template, effect.bind, env));
            else if (effect.op === 'offer') {
                read(['offers', effect.key]); read(['settled', effect.key]);
                if (dmOwn(instance.offers, effect.key) || dmOwn(instance.settled, effect.key)) refuse('CLAIMED', effect.key, 'This offer key has already been used.');
                if (Object.keys(instance.offers).length + Object.keys(instance.settled).length >= L.offers) refuse('DM_BUDGET', effect.key, 'Offer keys exhausted.');
                instance.offers[effect.key] = freezeReward(effect.template, effect.bind, env);
            } else if (effect.op === 'award') {
                read(['offers', effect.offer]); read(['settled', effect.offer]);
                const offer = instance.offers[effect.offer];
                if (!offer || dmOwn(instance.settled, effect.offer)) refuse('CLAIMED', effect.offer, 'No outstanding offer with this key.');
                settle(offer);
                instance.settled[effect.offer] = { source: copy(source), offer: hashJson(offer) };
                delete instance.offers[effect.offer];
            } else refuse('DM_SCHEMA', '', 'Unsupported effect.');
        }
    }
    function timers() {
        for (const timer of definition.timers) {
            charge();
            const minute = inputs[timer.clock]?.minutes;
            if (minute === null || minute === undefined) continue;
            if (!dmInt(minute)) refuse('DM_BOUNDS', timer.id, 'Invalid story minute.');
            read(['timers', timer.id]);
            const clock = instance.timers[timer.id];
            if (!clock || clock.lastMinute === null) { instance.timers[timer.id] = { lastMinute: minute, remainder: 0 }; continue; }
            const elapsed = minute - clock.lastMinute;
            if (elapsed <= 0) continue;
            if (elapsed > L.elapsedMinutes) refuse('DM_BUDGET', timer.id, `More than ${L.elapsedMinutes} elapsed minutes; cursor unchanged.`);
            const total = elapsed + clock.remainder, periods = Math.floor(total / timer.every);
            // One aggregate additive change per effect; never a catch-up loop.
            if (periods) effects(timer.effects, { timer: { periods } });
            clock.lastMinute = minute;
            clock.remainder = total % timer.every;
        }
    }
    function rules() {
        for (const rule of definition.rules) { charge(); if (condition(['rule', rule.id], rule.when, {})) { fired.push(rule.id); effects(rule.then); } }
    }
    // The reply-end functions, in the order they are written: each asks its condition about the fields as the one before left them.
    function replyEnd() {
        (definition.replyEnd ?? []).forEach((entry, at) => { charge(); if (condition(['reply-end', at], entry.when, {})) effects(entry.effects); });
    }
    return { evaluate, condition, effects, timers, rules, replyEnd, charge, read,
        finish() {
            for (const [key, schema] of Object.entries(definition.state)) if (!scalarHolds(schema, instance.fields[key])) refuse('DM_BOUNDS', key, 'Invalid instance field.');
            if (bytes(instance) > L.instanceBytes) refuse('DM_BUDGET', '', 'Instance storage exhausted.');
            return { reads: [...reads.values()], visits, notes, decisions, conds, fired, lists };
        },
    };
}
