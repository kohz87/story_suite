// The Studio's gate field (mock MK-8): a gate built from chips. Each "way" is an "or" group of terms that must all hold; a chip opens a sheet to
// change or remove its term, "+ and" and "+ or: another way in" open the add sheet (the kinds, then a small form with the term shown as text).
// Under the ways, the gate as text and "Edit as text": the checked text box, the field's old form, which stays in the row (hidden while the
// builder shows) so an editor and its Go to work as before. Terms are read and written by model/gate.js and checked one by one with the game's
// own rules, so a problem shows on its chip. A term the builder cannot read is kept as written, on a "can't read" chip.

import { h } from '../../ui/kit/dom.js';
import { openSheet } from '../../ui/kit/sheet.js';
import { CAST_BUILT_IN_METERS } from '../../packs/limits.js';
import { setProblem } from './fields.js';
import { checkGateText, composeGate, parseGate } from '../model/gate.js';
import { buildRefs } from '../model/refs.js';

const KINDS = [
    ['Story', 'fired', 'Fired', 'An event happened', '✦'], ['Story', 'ended', 'Ended', 'An event is over', '✦'],
    ['Story', 'lapsed', 'Lapsed', 'An event\'s time ran out before it happened', '✦'],
    ['Story', 'set', 'Set', 'A condition came in, anywhere or in one region, place or route', '◐'], ['Story', 'cleared', 'Cleared', 'A condition went away', '◐'],
    ['Story', 'fact', 'Fact', 'A fact is in the Journal', '✎'],
    ['People', 'learned', 'Learned', 'You learned a secret, or a hidden lore entry', '♥'], ['People', 'died', 'Died', 'A person of the cast died', '♥'],
    ['People', 'departed', 'Departed', 'A person of the cast left the story', '♥'], ['People', 'meter', 'Meter', 'A meter is at least a number', '♥'],
    ['People', 'stage', 'Stage', 'A person reached a stage', '♥'],
    ['Place and words', 'place', 'At', 'The reader is at a place', '◍'], ['Place and words', 'quote', 'Quote', 'The story says these words', '❝'],
];
const HEAD = { place: 'place:', quote: 'quote:', meter: 'meter', stage: 'stage' };
const TAG = { place: 'at', quote: 'quote', meter: 'meter', stage: 'stage', raw: 'can\'t read' };
const SCOPE = { place: 'places', region: 'regions', realm: 'realms', route: 'routes' };
const modes = new Map();   // field → 'text' while it is edited as text (kept over the editor's redraws)
const notes = new Map();   // field → { after, before, way }: the "Way n removed. Undo" note
const facts = new WeakMap();

const list = (content, key) => (Array.isArray(content?.[key]) ? content[key].filter(item => item && typeof item === 'object') : []);
const person = (env, id) => list(env.content, 'cast').find(item => item.id === id) ?? null;
const nameOf = (env, id) => person(env, id)?.name ?? id;
const placeName = (env, id) => list(env.content, 'places').find(place => (place.id ?? place.slug) === id)?.name ?? id;
const cap = word => word.charAt(0).toUpperCase() + word.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const kindOf = term => (term.type === 'anchor' ? term.kind : term.type);
const termText = term => composeGate([[term]]);
const factIds = content => {
    if (!facts.has(content)) facts.set(content, (buildRefs({ content }).defs.fact ?? []).map(item => item.id));
    return facts.get(content);
};

/** A chip's words: what the term names, by display name where the pack has one. */
function labelOf(term, env) {
    const whose = of => (of && !env.owner ? `${nameOf(env, of)}'s ` : '');
    if (term.type === 'place') return placeName(env, term.id);
    if (term.type === 'quote') return `“${term.text}”`;
    if (term.type === 'meter') return whose(term.of) ? `${whose(term.of)}${term.name} ≥ ${term.at}` : `${cap(term.name)} ≥ ${term.at}`;
    if (term.type === 'stage') return whose(term.of) ? `${whose(term.of)}stage ≥ ${term.at}` : `Stage ≥ ${term.at}`;
    if (term.type === 'raw') return term.text;
    if (term.kind === 'died' || term.kind === 'departed') return nameOf(env, term.id);
    if (term.kind === 'learned') {
        const [who, what = ''] = term.id.split('/');
        return who === 'lore' ? `Lore · ${what}` : `${nameOf(env, who)} · ${what}`;
    }
    return term.ref === undefined ? term.id : `${term.id} @ ${term.ref}`;
}

// ---- the add / change sheet ------------------------------------------------------------------------------------------------------------------------

function select(label, hint, options, value, set) {
    const box = h('select', { class: 'sel2', 'aria-label': label }, h('option', { value: '', selected: !value }, 'Pick…'),
        options.map(([id, text]) => h('option', { value: id, selected: id === value }, text)));
    box.value = value ?? '';
    box.addEventListener('change', () => set(box.value));
    return h('div', { class: 'srow', dataset: { field: label } }, h('span', { class: 'lb' }, h('b', label), hint ? h('small', hint) : null), h('span', { class: 'ctl' }, box));
}

function input(label, hint, value, set, { number = false, suggest = [] } = {}) {
    const box = h('input', { type: number ? 'number' : 'text', class: number ? 'txt2 num' : 'txt2', 'aria-label': label, placeholder: '—', list: suggest.length ? 'st-gate-facts' : null });
    box.value = value ?? '';
    box.addEventListener('input', () => set(number ? (box.value === '' ? null : Number(box.value)) : box.value.trim(), false));
    box.addEventListener('change', () => set(number ? (box.value === '' ? null : Number(box.value)) : box.value.trim(), true));
    return h('div', { class: 'srow', dataset: { field: label } }, h('span', { class: 'lb' }, h('b', label), hint ? h('small', hint) : null),
        h('span', { class: 'ctl' }, box, suggest.length ? h('datalist', { id: 'st-gate-facts' }, suggest.map(id => h('option', { value: id }))) : null));
}

function whoRow(env, draft, redraw, hint, keep = () => true) {
    return select('Person', hint, list(env.content, 'cast').filter(keep).map(item => [item.id, item.name ?? item.id]), draft.of ?? draft.id, id => {
        if (draft.type === 'anchor') draft.id = id; else { draft.of = id; if (draft.type === 'stage') draft.at = ''; }
        redraw();
    });
}

/** The form rows for one draft term (it is changed in place; `redraw` draws the form again). */
function formRows(draft, env, redraw) {
    const set = key => value => { draft[key] = value; redraw(); };
    const kind = kindOf(draft);
    if (['fired', 'ended', 'lapsed'].includes(kind)) return [select('Event', 'An event of this pack', list(env.content, 'worldEvents').map(event => [event.id, event.title ?? event.id]), draft.id, set('id'))];
    if (kind === 'set' || kind === 'cleared') {
        const condition = list(env.content, 'conditions').find(item => item.name === draft.id);
        const scope = condition?.scope;
        const near = draft.ref !== undefined;
        const refs = scope ? list(env.content, SCOPE[scope] ?? '').map(item => [item.id ?? item.name ?? `${item.from}–${item.to}`, item.name ?? item.id ?? `${item.from}–${item.to}`]) : [];
        return [select('Condition', condition?.means ?? `${list(env.content, 'conditions').length} conditions`, list(env.content, 'conditions').map(item => [item.name, item.name]), draft.id, id => { draft.id = id; delete draft.ref; redraw(); }),
            scope ? h('div', { class: 'srow', dataset: { field: 'Where' } }, h('span', { class: 'lb' }, h('b', 'Where'), h('small', `${draft.id} is a ${scope} condition, so only ${SCOPE[scope]} are offered`)),
                h('span', { class: 'ctl sseg2' },
                    h('button', { type: 'button', 'aria-pressed': String(!near), onClick: () => { delete draft.ref; redraw(); } }, 'Anywhere'),
                    h('button', { type: 'button', 'aria-pressed': String(near), onClick: () => { draft.ref = draft.ref ?? ''; redraw(); } }, `In a ${scope}`))) : null,
            near && scope ? select(scope.charAt(0).toUpperCase() + scope.slice(1), plural(refs.length, scope), refs, draft.ref, set('ref')) : null];
    }
    if (kind === 'fact') return [input('Fact', 'Its id, as an event, a lore entry or a secret records it', draft.id, value => { draft.id = value; redraw(); }, { suggest: factIds(env.content) })];
    if (kind === 'died' || kind === 'departed') return [whoRow(env, draft, redraw, 'A person of the cast')];
    if (kind === 'learned') {
        const [who = '', what = ''] = (draft.id ?? '').split('/');
        const put = (a, b) => { draft.id = a ? `${a}/${b}` : ''; redraw(); };
        const owners = list(env.content, 'cast').filter(item => Array.isArray(item.secrets) && item.secrets.length).map(item => [item.id, item.name ?? item.id]);
        const things = who === 'lore' ? list(env.content, 'lore').filter(entry => entry.hidden === true && typeof entry.id === 'string').map(entry => [entry.id, entry.title ?? entry.id])
            : (person(env, who)?.secrets ?? []).filter(secret => typeof secret?.id === 'string').map(secret => [secret.id, secret.id]);
        return [select('Whose', 'A person\'s secret, or a hidden lore entry', [['lore', 'A hidden lore entry'], ...owners], who, value => put(value, '')),
            who ? select(who === 'lore' ? 'Entry' : 'Secret', `${plural(things.length, who === 'lore' ? 'hidden entry' : 'secret')}`, things, what, value => put(who, value)) : null];
    }
    if (kind === 'place') return [select('Place', 'Where the reader is', list(env.content, 'places').map(place => [place.id ?? place.slug, place.name ?? place.id]), draft.id, set('id'))];
    if (kind === 'quote') return [input('Words', 'The story must say them', draft.text, (value, done) => { draft.text = value; if (done) redraw(); else env.preview?.(); })];
    const owner = env.owner ? person(env, env.owner) : person(env, draft.of);
    const who = env.owner ? null : whoRow(env, draft, redraw, 'In a lore gate you pick the person');
    if (kind === 'meter') {
        const meters = [...new Set([...CAST_BUILT_IN_METERS, ...Object.keys(owner?.meters ?? {}).filter(key => key !== 'preset')])];
        return [who, select('Meter', owner ? `One of ${owner.name ?? owner.id}'s meters` : 'Pick the person first', meters.map(name => [name, name]), draft.name, set('name')),
            input('At least', 'A whole number from −100 to 100', draft.at, (value, done) => { draft.at = value; if (done) redraw(); else env.preview?.(); }, { number: true }),
            h('p', { class: 'fine' }, 'In a secret, a meter is always its owner\'s. In a lore gate you pick the person too.')];
    }
    const stages = (owner?.stages ?? []).map(stage => stage?.name).filter(Boolean);
    return [who, select('Stage', owner ? `${plural(stages.length, 'stage')}; reached or passed` : 'Pick the person first', stages.map(name => [name, name]), draft.at, value => { draft.at = value; draft.named = true; redraw(); })];
}

const complete = draft => {
    if ('of' in draft && !draft.of) return false;
    if (draft.type === 'quote') return Boolean(draft.text);
    if (draft.type === 'meter') return Boolean(draft.name) && Number.isInteger(draft.at);
    if (draft.type === 'stage') return draft.at !== '' && draft.at !== undefined;
    if (draft.type === 'anchor' && draft.ref === '') return false;
    return Boolean(draft.id) && !/\/$/.test(draft.id);
};

function blank(kind, env) {
    if (kind === 'place') return { type: 'place', id: '' };
    if (kind === 'quote') return { type: 'quote', text: '' };
    if (kind === 'meter') return { type: 'meter', name: 'trust', at: 30, ...(env.owner ? {} : { of: '' }) };
    if (kind === 'stage') return { type: 'stage', at: '', named: true, ...(env.owner ? {} : { of: '' }) };
    return { type: 'anchor', kind, id: '' };
}

/** Opens the sheet for way `way` (a new way when it is the count): the kinds, then the form; with `at`, that term's form, to change or remove. */
function openTerm(env, way, at = null) {
    const sheet = openSheet({}, { title: ' ', label: 'Gate term', id: 'st-gate' });
    const title = sheet.el.querySelector('.sh-h h3');
    const back = h('button', { type: 'button', class: 'btn2 st-gback', 'aria-label': 'Back to the kinds', onClick: () => kinds() }, '‹');
    const kinds = () => {
        back.remove();
        title.textContent = `Add to way ${way + 1}: what must hold?`;
        const groups = [...new Set(KINDS.map(row => row[0]))];
        sheet.body.replaceChildren(...groups.flatMap(group => [h('div', { class: 'secl2' }, group),
            h('div', { class: 'slist' }, KINDS.filter(row => row[0] === group).map(([, kind, name, hint, icon]) => h('button', { type: 'button', dataset: { kind }, onClick: () => form(blank(kind, env)) },
                h('i', { 'aria-hidden': 'true' }, icon), h('span', null, h('b', name, ' ', h('code', HEAD[kind] ?? `${kind}:`)), h('small', hint)), h('span', { 'aria-hidden': 'true' }, '›'))))]));
    };
    const form = draft => {
        const name = KINDS.find(row => row[1] === kindOf(draft));
        const what = name[3].split(',')[0];
        title.textContent = at === null ? `${name[2]}: ${what.charAt(0).toLowerCase()}${what.slice(1)}` : `Change a term: ${name[2].toLowerCase()}`;
        if (at === null) title.before(back);
        const shown = h('code', { class: 'st-gtext' });
        const ok = h('button', { type: 'button', class: 'btn2 pri st-gok' }, at === null ? 'Add' : 'Done');
        const preview = () => { const ready = complete(draft); shown.textContent = ready ? termText(draft) : '—'; ok.disabled = !ready; };
        env.preview = preview;
        ok.addEventListener('click', () => { if (!complete(draft)) return; sheet.close(); env.place(way, at, { ...draft }); });
        sheet.body.replaceChildren(...[
            h('div', { class: 'st-gform' }, formRows(draft, env, () => form(draft)).filter(Boolean)),
            h('div', { class: 'st-astext' }, h('small', 'As text'), shown),
            h('div', { class: 'st-gfoot' },
                at === null ? null : h('button', { type: 'button', class: 'btn2 dng st-gdel', onClick: () => { sheet.close(); env.place(way, at, null); } }, 'Remove'),
                h('button', { type: 'button', class: 'btn2 st-gcancel', onClick: () => sheet.close() }, 'Cancel'), ok)].filter(Boolean));
        preview();
    };
    if (at === null) kinds(); else form(JSON.parse(JSON.stringify(env.groups[way][at])));
    return sheet;
}

// ---- the builder ------------------------------------------------------------------------------------------------------------------------------------

function verdict(term, env) {
    const found = checkGateText(termText(term), env.content, env.owner);
    const worst = found.find(item => item.level === 'error') ?? found[0];
    if (term.type === 'raw') return { level: 'error', message: `The builder can't read this term.${worst ? ` ${worst.message}` : ''}` };
    return worst ?? null;
}

function wayNode(group, way, env) {
    const said = group.map(term => verdict(term, env));
    const chips = group.flatMap((term, at) => {
        const label = labelOf(term, env);
        const chip = h('span', { class: `st-term${term.type === 'raw' ? ' raw' : ''}`, dataset: { level: said[at]?.level ?? '', kind: kindOf(term) } },
            h('button', { type: 'button', class: 'st-chip', 'aria-label': `Change ${label}`, onClick: () => (term.type === 'raw' ? env.toText() : openTerm(env, way, at)) },
                h('b', { class: 'st-tag' }, TAG[term.type] ?? term.kind), h('span', label)),
            h('button', { type: 'button', class: 'st-x', 'aria-label': `Remove ${label}`, onClick: () => env.place(way, at, null) }, '×'));
        return at ? [h('small', { class: 'st-and' }, 'and'), chip] : [chip];
    });
    const lines = said.map((found, at) => (found ? h('small', { class: 'st-termbad', dataset: { level: found.level } }, `${found.level === 'error' ? '✕' : '!'} ${found.message} `,
        group[at].type === 'raw' ? h('button', { type: 'button', class: 'lnk st-fix', onClick: env.toText }, 'Fix it as text') : null) : null)).filter(Boolean);
    return { node: h('div', { class: 'st-way', dataset: { way: String(way) } }, h('div', { class: 'st-terms' }, chips, h('button', { type: 'button', class: 'btn2 st-and-add', onClick: () => openTerm(env, way) }, '+ and')), lines), said };
}

/** Builds a gate row. `spec`: `{ key, label, hint, value, content, ownerId }`; `onChange(key, text)` runs on a committed edit (a blank gate is `''`).
 * The builder shows the gate as ways of chips; "Edit as text" shows the checked text box, which re-checks each keystroke (the first error, else the
 * first warning, shows under it) and keeps the text as typed. Either way a change is committed at once, as one gate string. While the builder shows,
 * the text box is hidden, so Go to lands on "Edit as text" (`data-goto`) instead. */
export function gateField(spec, onChange) {
    const field = `${spec.key}|${spec.ownerId ?? ''}|${spec.rec ?? ''}`; // per record: one entry's text mode is not every entry's
    let text = String(spec.value ?? '').trim();
    const hint = h('small');
    const area = h('textarea', { class: 'txt2 st-long', rows: spec.rows ?? 2, placeholder: '—', 'aria-label': spec.label }, text);
    area.value = spec.value ?? '';
    const box = h('div', { class: 'st-gb' });
    const row = h('div', { class: 'srow wide st-gate', dataset: { key: spec.key, type: 'gate' } },
        h('span', { class: 'lb' }, h('b', spec.label), hint),
        h('span', { class: 'ctl' }, area, box));
    const env = { content: spec.content ?? {}, owner: spec.ownerId ?? null, groups: [] };
    const commit = (next, note = null) => {
        notes.delete(field);
        if (note) notes.set(field, { ...note, after: next });
        text = next; area.value = next;
        onChange?.(spec.key, next);
        draw();
    };
    env.toText = () => { modes.set(field, 'text'); draw(); area.focus?.(); };
    env.place = (way, at, term) => {
        const groups = env.groups.map(group => [...group]);
        if (way >= groups.length) groups.push([]);
        if (term && at === null) groups[way].push(term);
        else if (term) groups[way][at] = term;
        else groups[way].splice(at, 1);
        const gone = !term && !groups[way].length && env.groups.length > 1;
        commit(composeGate(groups), gone ? { before: text, way: way + 1 } : null);
    };
    const status = () => {
        const all = text ? checkGateText(text, env.content, env.owner) : [];
        const worst = all.find(item => item.level === 'error') ?? all[0];
        return { all, worst };
    };
    const ok = () => h('small', { class: 'st-ok' }, '✓ The game takes this gate.');
    function draw() {
        row.querySelector('.st-ok')?.remove();
        const asText = modes.get(field) === 'text';
        area.hidden = !asText;
        hint.textContent = asText ? spec.hint ?? '' : 'Any one way below opens it. Inside a way, every term must hold';
        const { all, worst } = status();
        if (asText) {
            box.replaceChildren(h('button', { type: 'button', class: 'btn2 st-tobuilder', onClick: () => { modes.delete(field); draw(); } }, 'Back to the builder'));
            setProblem(row, worst?.message ?? '');
            row.dataset.level = worst?.level ?? '';
            if (text && !worst) box.prepend(ok());
            return;
        }
        env.groups = parseGate(text).groups.filter(group => group.length);
        const note = notes.get(field);
        const ways = env.groups.map((group, way) => wayNode(group, way, env));
        const bad = ways.flatMap(way => way.said).filter(found => found?.level === 'error').length;
        const warned = ways.flatMap(way => way.said).filter(found => found?.level === 'warning').length;
        box.replaceChildren(...[...(env.groups.length
            ? [...ways.flatMap((way, at) => (at ? [h('div', { class: 'st-or' }, h('span', 'or')), way.node] : [way.node])),
                h('button', { type: 'button', class: 'btn2 st-or-add', onClick: () => openTerm(env, env.groups.length) }, '+ or: another way in'),
                h('div', { class: 'st-astext' }, h('small', 'As text'), h('code', { class: 'st-gtext' }, text), h('button', { type: 'button', class: 'lnk st-totext', dataset: { goto: '' }, onClick: env.toText }, 'Edit as text'))]
            : [h('div', { class: 'st-way st-empty' }, h('span', { class: 'none' }, 'No terms yet'),
                h('button', { type: 'button', class: 'lnk st-totext', dataset: { goto: '' }, onClick: env.toText }, 'Write it as text'),
                h('button', { type: 'button', class: 'btn2 pri st-first', onClick: () => openTerm(env, 0) }, '+ Add the first term'))]),
            note && note.after === text ? h('p', { class: 'fine st-gnote' }, `Way ${note.way} removed. `, h('button', { type: 'button', class: 'lnk st-undo-way', onClick: () => commit(note.before) }, 'Undo')) : null].filter(Boolean));
        const message = bad ? `✕ ${plural(bad, 'problem')}, on the chip${bad === 1 ? '' : 's'} above.` : (worst?.level === 'error' ? worst.message : warned || worst ? `! ${plural(Math.max(warned, all.length), 'warning')}. Warnings don't stop Export.` : '');
        setProblem(row, message);
        row.dataset.level = bad || worst?.level === 'error' ? 'error' : message ? 'warning' : '';
        if (text && !message) box.append(ok());
    }
    area.addEventListener('input', () => {
        const typed = area.value.trim();
        const found = typed ? checkGateText(typed, env.content, env.owner) : [];
        const worst = found.find(item => item.level === 'error') ?? found[0];
        row.querySelector('.st-ok')?.remove();
        setProblem(row, worst?.message ?? '');
        row.dataset.level = worst?.level ?? '';
    });
    area.addEventListener('change', () => { text = area.value.trim(); onChange?.(spec.key, text); draw(); });
    draw();
    return row;
}
