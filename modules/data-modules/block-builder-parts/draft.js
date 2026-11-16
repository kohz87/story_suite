// Reopening a block in the editor: the draft form of a definition, and only when the form can write it back unchanged.
import { DM_LIMITS as L } from '../schema.js';
import { validateDataModules } from '../check.js';
import { hashJson } from '../../../core/replay.js';
import { buildBlock } from './build.js';

/** Reopens an editor-built definition without storing a second representation of the block. */
export function blockDraft(definition) {
    const fieldOf = (key, schema) => ({ key, name: schema.label ?? key,
        type: schema.type === 'int' ? 'number' : schema.type === 'enum' ? 'choice' : schema.list ? 'list' : 'text',
        ...(schema.type === 'int' ? { min: schema.min, max: schema.max } : {}),
        ...(schema.type === 'text' ? { max: schema.max } : {}), ...(schema.type === 'enum' ? { values: [...schema.values] } : {}), default: schema.default,
        ...(schema.names ? { names: { ...schema.names } } : {}), ...(schema.prompt === false ? { prompt: false } : {}) });
    const fields = Object.entries(definition?.state ?? {}).map(([key, schema]) => (schema.type === 'entries'
        ? { key, name: schema.label ?? key, type: 'entries', max: schema.max ?? L.entriesDefault, of: Object.entries(schema.of).map(([part, sub]) => fieldOf(part, sub)),
            ...(schema.prompt === false ? { prompt: false } : {}) }
        : fieldOf(key, schema)));
    const effects = list => (list ?? []).map(effect => {
        const value = effect.value;
        const timerSet = effect.op === 'add' && Array.isArray(value) && value[0] === 'sub' && Array.isArray(value[2])
            && value[2][0] === 'get' && JSON.stringify(value[2][1]) === JSON.stringify(effect.path);
        return { field: effect.path?.[0], op: timerSet ? 'set' : effect.op, value: timerSet ? value[1]
            : Array.isArray(value) && value[0] === 'mul' && Array.isArray(value[1]) && value[1][0] === 'timer' ? value[2] : value };
    });
    const condition = when => ({ op: when?.[0], field: when?.[1]?.[1]?.[0], value: when?.[2] });
    const functions = [
        ...Object.entries(definition?.kinds ?? {}).filter(([, kind]) => kind.ui).map(([key, kind]) => ({ type: 'button', name: kind.title ?? key.replace(/^button-/, ''), effects: effects(kind.effects) })),
        ...(definition?.rules ?? []).map(rule => ({ type: 'rule', name: rule.id, when: condition(rule.when), effects: effects(rule.then) })),
        ...(definition?.timers ?? []).map(timer => ({ type: 'timer', name: timer.id, every: timer.every, effects: effects(timer.effects) })),
        ...(definition?.replyEnd ?? []).map((entry, at) => ({ type: 'reply-end', name: entry.id ?? `reply-end-${at + 1}`,
            ...(entry.when === true ? {} : { when: condition(entry.when) }), effects: effects(entry.effects) })),
        ...(definition?.cards ?? []).map((card, at) => ({ type: 'card', name: card.id ?? `card-${at + 1}`, when: condition(card.when), tone: card.tone,
            title: card.title, text: card.text, ...(card.button ? { button: definition.kinds?.[card.button]?.title ?? card.button.replace(/^button-/, '') } : {}) })),
    ];
    return { slug: definition?.slug, name: definition?.name ?? '', ...(definition?.role ? { role: definition.role } : {}), fields, functions, prompt: definition?.prompt ?? '',
        ...(definition?.layout ? { layout: definition.layout } : {}), ...(definition?.roles ? { roles: { ...definition.roles } } : {}), ...(definition?.tones ? { tones: { ...definition.tones } } : {}),
        show: definition?.show ? { ...definition.show } : { tab: true, card: false, tabName: definition?.name ?? '', icon: 'ph-bookmark-simple' } };
}

/** Open only definitions the form can write back without losing their behavior. */
export function editableBlockDraft(definition) {
    const { id, pack, ...raw } = definition ?? {};
    const original = validateDataModules([raw], { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'] });
    const draft = blockDraft(definition), rebuilt = buildBlock(draft);
    if (!original.ok || !rebuilt.ok) return null;
    if (hashJson(rebuilt.checked) === hashJson(original.definitions[0])) return draft;
    // Earlier editor versions generated one additional numeric change kind. Recognize only that
    // exact form, so opening an old block does not discard unrelated authored behavior.
    const legacy = { ...rebuilt.definition, kinds: { ...rebuilt.definition.kinds } };
    for (const [key, schema] of Object.entries(legacy.state)) if (schema.type === 'int') {
        const extent = Math.abs(schema.max);
        legacy.kinds[`change-${key}`] = { op: '~', labels: { by: { type: 'int', min: -extent, max: extent } },
            effects: [{ op: 'add', path: [key], value: ['arg', 'by'], bounds: 'clamp' }] };
    }
    const checkedLegacy = validateDataModules([legacy], { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'] });
    return checkedLegacy.ok && hashJson(checkedLegacy.definitions[0]) === hashJson(original.definitions[0]) ? draft : null;
}
