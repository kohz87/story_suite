// Building a data-module definition from the editor's draft form.
import { oneLine } from '../../../text.js';
import { DM_LIMITS as L } from '../schema.js';
import { validateDataModules } from '../check.js';
import { STRINGS, fill } from '../../strings.js';
import { problem, keyFor, number } from './shared-basics.js';
import { defaultTone } from './names.js';
import { uniqueBlockSlug } from './slugs.js';
import { blockKindCount, entriesTooBig } from './limits.js';
import { conditionOf, effectOf } from './rules.js';
import { partSchema, entriesSchema, entryKinds } from './field-schemas.js';

const B = STRINGS.blocks;

/** The draft is plain form data; errors point at the field or function to show beside its control. */
export function buildBlock(draft, { used = [], definitions = [] } = {}) {
    const name = oneLine(draft?.name);
    if (!name || [...name].length > 60) return problem('name', B.blockName);
    const slug = draft.slug ? keyFor(draft.slug) : uniqueBlockSlug(name, used);
    if (!slug) return problem('name', B.blockName);
    if (!Array.isArray(draft.fields)) return problem('fields', B.fieldName);
    if (blockKindCount(draft) > L.kinds) return problem('fields', B.kindLimit);
    // How the block is drawn (display only). Roles and tones belong to the cards layout; the roles also say which part of an entry is its title.
    const layout = ['cards', 'bars', 'fields'].includes(draft.layout) ? draft.layout : null, rolesOf = layout === 'cards' && draft.roles?.field && draft.roles?.title
        ? Object.fromEntries(['field', 'title', 'status', 'step'].filter(part => draft.roles[part]).map(part => [part, draft.roles[part]])) : null;
    const state = {}, kinds = {};
    for (const [index, field] of draft.fields.entries()) {
        const path = `fields.${index}`, label = oneLine(field?.name), key = keyFor(field?.key || label, 32);
        if (!label || [...label].length > 60 || !key || Object.hasOwn(state, key)) return problem(`${path}.name`, B.fieldName);
        let schema;
        if (field.type === 'entries') {
            const made = entriesSchema(field, path, label);
            if (made.error) return made.error;
            schema = made.schema;
        } else {
            const made = partSchema(field, path, label, { list: true, names: true });
            if (made.error) return made.error;
            schema = made.schema;
        }
        if (field.prompt === false) schema.prompt = false;
        state[key] = schema;
        // A field hidden from the story gets no line the story can write; the reader and the rules still change it.
        if (schema.prompt === false) continue;
        if (schema.type === 'entries') {
            for (const [name, kind] of Object.entries(entryKinds(key, schema, rolesOf))) {
                if (Object.hasOwn(kinds, name)) return problem(`${path}.name`, B.fieldName);
                kinds[name] = kind;
            }
            continue;
        }
        const labelSchema = schema.type === 'int' ? { type: 'int', min: schema.min, max: schema.max }
            : schema.type === 'enum' ? { type: 'enum', values: schema.values } : { type: 'text', max: schema.max };
        kinds[`set-${key}`] = { op: '~', labels: { to: labelSchema }, effects: [{ op: 'set', path: [key], value: ['arg', 'to'] }] };
    }
    const functions = Array.isArray(draft.functions) ? draft.functions : [];
    if (functions.length > 8) return problem('functions', B.functionLimit);
    const rules = [], timers = [], cards = [], cardAt = [], replyEnd = [];
    for (const [index, fn] of functions.entries()) {
        const path = `functions.${index}`;
        if (fn?.type === 'card') {
            const key = keyFor(fn.name || `card-${index + 1}`, 32), when = conditionOf(fn.when, state);
            if (!key) return problem(`${path}.name`, B.chooseFunction);
            if (!when) return problem(`${path}.when`, B.chooseField);
            cardAt.push(index);
            cards.push({ id: key, when, tone: fn.tone ?? 'info', title: oneLine(fn.title), text: oneLine(fn.text),
                ...(fn.button ? { button: `button-${keyFor(fn.button, 32)}` } : {}) });
            continue;
        }
        const effects = (Array.isArray(fn.effects) ? fn.effects : []).map(effect => effectOf(effect, state));
        if (!effects.length) return problem(`${path}.effects`, B.chooseFunction);
        for (const [effectIndex, effect] of effects.entries()) {
            const input = fn.effects[effectIndex];
            if (fn.type === 'timer' && (!effect || effect.op !== 'add')) return problem(`${path}.effects.${effectIndex}.value`, B.timerNumber);
            if (!effect) {
                const part = !state[input?.field] ? 'field' : !['set', 'add'].includes(input?.op) ? 'op' : 'value';
                return problem(`${path}.effects.${effectIndex}.${part}`, B.chooseFunction);
            }
        }
        const key = keyFor(fn.name || `${fn.type}-${index + 1}`, 32);
        if (!key) return problem(`${path}.name`, B.chooseFunction);
        if (fn.type === 'button') {
            const kind = `button-${key}`;
            if (Object.hasOwn(kinds, kind)) return problem(`${path}.name`, B.fieldName);
            kinds[kind] = { op: '!', ui: true, title: oneLine(fn.name || key), labels: {}, effects };
        } else if (fn.type === 'rule') {
            const when = conditionOf(fn.when, state);
            if (!when) return problem(`${path}.when`, B.chooseField);
            rules.push({ id: key, when, then: effects });
        } else if (fn.type === 'reply-end') {
            // (no condition: at the end of every reply)
            const when = fn.when ? conditionOf(fn.when, state) : true;
            if (!when) return problem(`${path}.when`, B.chooseField);
            replyEnd.push({ id: key, when, effects });
        } else if (fn.type === 'timer') timers.push({ id: key, clock: 'clock', every: number(fn.every),
            effects: effects.map(effect => ({ ...effect, value: ['mul', ['timer', 'periods'], effect.value] })) });
        else return problem(`${path}.type`, B.chooseFunction);
    }
    for (const [index, card] of cards.entries()) if (card.button && !Object.hasOwn(kinds, card.button)) return problem(`functions.${cardAt[index]}.button`, B.cardButton);
    const show = { ...(draft.show ?? { tab: true, card: false, tabName: '', icon: 'ph-bookmark-simple' }) };
    // (joining another tab needs a tab of its own to join with: `into` is dropped otherwise, and when empty)
    if (!show.tab || !show.into) delete show.into;
    // (a tone is kept only where it differs from the default)
    const roles = rolesOf;
    const tones = roles?.status ? Object.fromEntries(Object.entries(draft.tones ?? {}).filter(([value, tone]) => tone !== defaultTone(value))) : {};
    const output = { slug, name, schema: 1, stateVersion: 1, scope: 'chat', state, kinds,
        prompt: String(draft.prompt ?? ''), show: { ...show, tabName: oneLine(show.tabName) || [...name].slice(0, 24).join('') },
        ...(layout ? { layout } : {}), ...(roles ? { roles } : {}), ...(Object.keys(tones).length ? { tones } : {}),
        ...(draft.role ? { role: draft.role } : {}), ...(cards.length ? { cards } : {}), ...(replyEnd.length ? { replyEnd } : {}),
        rules, timers, ...(timers.length ? { imports: { clock: { query: 'director.time', mode: 'prefix', projection: ['minutes'] } } } : {}) };
    const checked = validateDataModules([output], { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'], definitions });
    if (checked.ok) {
        // A list that cannot hold its Most entries in the storage a block has is refused here, at the list's own Most entries, in one sentence.
        const big = entriesTooBig(output.state);
        if (big) {
            const at = draft.fields.findIndex(field => keyFor(field?.key || oneLine(field?.name), 32) === big.key);
            return problem(`fields.${at}.max`, fill(B.listTooBig, { name: `"${output.state[big.key].label ?? big.key}"`, max: output.state[big.key].max ?? L.entriesDefault, chars: big.chars, kb: big.kb, limit: L.instanceBytes / 1024, fit: big.fit }));
        }
    }
    return checked.ok ? { ok: true, definition: output, checked: checked.definitions[0] } : { ...checked, definition: output };
}
