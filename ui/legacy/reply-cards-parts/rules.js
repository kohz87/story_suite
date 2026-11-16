// Describes a reply's reader edits and the rule lines its fired rules changed.

import { oneLine } from '../../../core/text.js';
import { STRINGS, fill } from '../../../core/strings.js';
import { activeDefinition, instanceOf } from '../../../modules/data-modules/adapters.js';
import { dmNameOf } from '../../../modules/data-modules/schema.js';

/** Applied reader edits on one reply, in receipt order. Skipped replay blocks do not describe changes. */
export function replyEdits(record, problems = [], index = null) {
    const skipped = new Set((Array.isArray(problems) ? problems : []).filter(problem => index === null || problem?.index === index)
        .flatMap(problem => Array.isArray(problem?.receipts) ? problem.receipts : []));
    return (Array.isArray(record?.receipts) ? record.receipts : [])
        .filter(receipt => receipt?.data?.edit === true && !skipped.has(receipt.id))
        .map(receipt => ({ text: oneLine(receipt.summary ?? '', 200) })).filter(row => row.text);
}

// ---- Rule lines ("Guild standing: probation") ---------------------------------------------------------------------------------
// A receipt keeps only the ids of the rules that fired (data.v2.result.rules) and which block and subject it acted on (its guard).
// What a rule changed is read from the states instead of stored: the fields its effects write, in the module's state after this
// reply against the state before it. A rule that left those fields as they were says nothing.

const humanize = id => String(id).replace(/[-_]+/g, ' ').trim();
// A label starts in lower case after the block's name ("Standing" → "standing"), unless its first word is an acronym ("HP").
const lowerFirst = text => (/^[A-Z]{2,}\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const shown = (schema, value) => (typeof value === 'string' ? value : dmNameOf(schema, value) ?? String(value));

/** The field names a list of effects writes, with the map key when the path names one: [{ field, key? }]. Reward templates count. */
function writtenBy(definition, effects, seen = new Set()) {
    const out = [];
    for (const effect of Array.isArray(effects) ? effects : []) {
        if (effect?.op === 'reward' && typeof effect.template === 'string' && !seen.has(effect.template)) {
            seen.add(effect.template);
            out.push(...writtenBy(definition, definition.rewards?.[effect.template]?.effects, seen));
        } else if (Array.isArray(effect?.path) && typeof effect.path[0] === 'string') {
            out.push({ field: effect.path[0], key: typeof effect.path[1] === 'string' ? effect.path[1] : null });
        }
    }
    return out;
}

/** The label a screen of the block gives a field (or a map's key): { 'field' | 'field.key': label }. */
function screenLabels(definition, module) {
    const labels = {};
    const visit = (node, row) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(child => visit(child, row)); return; }
        const bind = node.bind ?? node.value;
        let path = null;
        if (typeof node.label === 'string' && node.label.trim()) {
            if (bind?.query === 'dataModules.view' && bind.args?.module === module && typeof bind.path === 'string' && bind.path.startsWith('chat.')) path = bind.path.slice(5);
            else if (row && typeof bind === 'string' && bind.startsWith('$item.')) path = bind.slice(6);
        }
        if (path && !(path in labels)) labels[path] = node.label.trim();
        const rows = row || (definition.scope === 'character' && node.type === 'list' && node.bind?.args?.module === module && node.bind?.path === 'characters');
        visit(node.children, row);
        visit(node.item, rows);
        visit(node.pages, row);
        if (node.node) visit(node.node, row);
        if (node.root) visit(node.root, row);
    };
    for (const screen of Array.isArray(definition.screens) ? definition.screens : []) visit(screen?.layout?.root, false);
    return labels;
}

const defaultOf = (schema, key) => (schema?.type === 'map' ? schema.values?.default : schema?.default);

/** The lines for one fired rule of one block: [{ block, label, value }], one per field it changed between `before` and `after`. */
function changedByRule(definition, module, rule, subject, before, after, labels) {
    const read = (state, field) => {
        const fields = instanceOf(state, module, definition.scope === 'chat' ? 'chat' : subject)?.fields;
        return fields && Object.hasOwn(fields, field) ? fields[field] : undefined;
    };
    const block = oneLine((Array.isArray(definition.screens) ? definition.screens : []).find(screen => typeof screen?.title === 'string' && screen.title.trim())?.title ?? definition.name ?? module, 60);
    const out = [];
    for (const { field, key } of writtenBy(definition, rule.then)) {
        const schema = definition.state?.[field];
        if (!schema) continue;
        const now = read(after, field), was = read(before, field);
        if (now === undefined) continue;
        const pick = value => (schema.type === 'map' && key !== null && value && typeof value === 'object' ? value[key] : value);
        const had = was === undefined ? (schema.type === 'map' ? (key !== null ? defaultOf(schema) : Object.fromEntries((schema.keys ?? []).map(name => [name, defaultOf(schema)]))) : defaultOf(schema)) : was;
        const cells = schema.type === 'map' && key === null
            ? (schema.keys ?? Object.keys(now ?? {})).map(name => ({ key: name, now: now?.[name], was: had?.[name] }))
            : [{ key, now: pick(now), was: pick(had) }];
        for (const cell of cells) {
            if (same(cell.now, cell.was)) continue;
            const scalar = schema.type === 'map' ? schema.values : schema;
            const name = labels[cell.key ? `${field}.${cell.key}` : field] ?? labels[field] ?? (cell.key ? `${humanize(field)} ${cell.key}` : humanize(field));
            out.push({ block, label: oneLine(lowerFirst(name), 60), value: oneLine(shown(scalar, cell.now), 60) });
        }
    }
    return out;
}

/**
 * The rule lines of one reply: for each rule a data-module action fired, one line per field it changed: "<Block> <field>: <new value>".
 * `states` = { state, before }: the module state at this reply and at the carrier before it (null: the chat's start, every field at its
 * default). Without `state` nothing can be told, so no line. A rule that changed nothing has no line; the rule's id stays in the Inspector.
 */
export function replyRules(record, problems = [], index = null, states = {}) {
    const { state, before = null } = states ?? {};
    if (!state) return [];
    const skipped = new Set((Array.isArray(problems) ? problems : []).filter(problem => index === null || problem?.index === index)
        .flatMap(problem => Array.isArray(problem?.receipts) ? problem.receipts : []));
    const seen = new Set(), out = [];
    for (const receipt of Array.isArray(record?.receipts) ? record.receipts : []) {
        if (skipped.has(receipt?.id)) continue;
        const fired = receipt?.data?.v2?.result?.rules;
        const guard = receipt?.data?.v2?.guard?.predicate;
        if (!Array.isArray(fired) || typeof guard?.module !== 'string') continue;
        const module = guard.module, definition = activeDefinition(state, module);
        if (!definition) continue;
        const subject = guard.subject ?? 'chat', labels = screenLabels(definition, module);
        for (const id of fired) {
            const rule = (definition.rules ?? []).find(each => each.id === id);
            if (!rule) continue;
            for (const line of changedByRule(definition, module, rule, subject, before, state, labels)) {
                const text = fill(STRINGS.card.ruleField, line), key = `${module}|${subject}|${text}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ text, summary: text, kind: 'line', tone: 'accent', icon: 'fa-bolt', flag: '', note: '', check: null });
            }
        }
    }
    return out;
}
