// Starts the Studio in a page: the theme, the frame, and what Open, the parts, search, Problems, Go to, Export, Undo and Redo, the draft
// prompt and the keys do. The Studio holds at most one world pack and one game pack (format 4), each an editing session (session.js:
// its document, history, check and draft slot); the active one is the one Overview, Problems, the foot bar, Undo and Export act on, and
// picking a part of the other makes that one active. The parts are drawn through views/route.js, whose editors get the editing context
// (`ctx`): `commit` and `setPortrait` change the pack as one undo step each, `openDoc` opens a document as if it had been picked, and a
// change redraws the page, keeping its scroll and the text box being typed in. Export is off while the pack has errors.

import { h } from '../ui/kit/dom.js';
import { applyTheme } from '../ui/theme/apply.js';
import { GLASS_DARK, GLASS_LIGHT } from '../ui/theme/tokens.js';
import { PORTRAIT_TYPES, sniffImage } from '../packs/portraits.js';
import { clearDraft, loadDraft, saveDraft } from './draft.js';
import { exportBlock, exportJson, exportZip } from './export.js';
import { bindKeys } from './keys.js';
import { openPicked } from './load.js';
import { openDoc as documentOf } from './model/doc.js';
import { buildRefs } from './model/refs.js';
import { PARTS, kindOf, partsOf } from './parts.js';
import { createSession } from './session.js';
import { createShell } from './shell.js';
import { renderOverview } from './views/overview.js';
import { renderProblems } from './views/problems.js';
import { PAGES, pageNodes, sectionNodes } from './views/route.js';
import { renderSearch, searchParts } from './views/search.js';

const THEME_KEY = 'storySuite.studio.theme';
const OTHER = { world: 'game', game: 'world' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const clock = at => { const d = new Date(at); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const day = at => { const d = new Date(at); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(at)}`; };

function saveFile(doc, { name, bytes }, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = name;
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Two portrait lists hold the same images (a draft can differ from the file in its portraits alone).
const samePictures = (a = [], b = []) => a.length === b.length && a.every((file, i) => file.name === b[i].name && file.bytes.length === b[i].bytes.length && file.bytes.every((byte, j) => byte === b[i].bytes[j]));
const titleOf = pack => (pack.doc ? [pack.doc.name ?? pack.doc.id ?? pack.name, pack.doc.version].filter(Boolean).join(' · ') : pack.name);
const kindLabel = pack => (pack.legacy ? (typeof pack.doc?.format === 'number' ? `Format ${pack.doc.format}` : 'Old format') : (pack.kind === 'game' ? 'Game' : 'World'));
// The problems of one section: those whose path is the key or under it.
const problemsAt = (pack, section) => {
    const at = section.where === 'top' ? section.key : `content.${section.key}`;
    return [...pack.check.errors, ...pack.check.warnings].filter(problem => problem.path === at || String(problem.path).startsWith(`${at}.`) || String(problem.path).startsWith(`${at}[`));
};

/**
 * Mounts the Studio on `root` (the `.su-root` element). `storage` remembers the theme; `download(file, type)` saves an export
 * (default: a browser download); `idb` is the IndexedDB the drafts use (default: the page's); `delay` is the check's debounce in ms.
 * Returns `{ open(files), show(partId, rec?), exportAs(kind), state, destroy() }`.
 */
export function startStudio({ doc = globalThis.document, root, storage = globalThis.localStorage, download = null, idb = undefined, delay = 300 } = {}) {
    const state = { packs: { world: null, game: null }, active: null, parts: [], current: null, focus: null, query: '', problemAt: -1, views: {}, theme: storage?.getItem?.(THEME_KEY) === 'light' ? 'light' : 'dark' };
    const urls = new Map(); // the world pack's portraits
    let heldFrom = null;
    const save = download ?? ((file, type) => saveFile(doc, file, type));
    const store = idb === undefined ? undefined : { idb };
    const drafts = {
        save: (kind, id, d) => saveDraft(kind, id, { text: d.text, doc: d.doc, portraits: d.portraits.map(({ name, bytes }) => ({ name, bytes })) }, store),
        clear: (kind, id) => clearDraft(kind, id, store),
    };

    const paintTheme = () => applyTheme(root, state.theme === 'light' ? GLASS_LIGHT : GLASS_DARK, { scheme: state.theme });
    const portrait = name => (urls.has(name) ? h('img', { class: 'st-thumb', src: urls.get(name), alt: '' }) : (name ? h('span', { class: 'st-thumb st-nopic', title: `${name} is not in what was opened` }, '?') : null));
    const go = (partId, rec = null, path = null) => show(partId, rec, { path });
    const active = () => state.packs[state.active];
    const mounts = id => PAGES[id].when({ pack: active(), world: state.packs.world, game: state.packs.game });

    // The reference index of a pack's present document (with the other open pack), built once per pair of snapshots.
    function refsOf(pack) {
        const other = state.packs[OTHER[pack.kind]]?.doc ?? null;
        if (pack.refsFor?.doc !== pack.doc || pack.refsFor?.other !== other) {
            let refs = null;
            try { refs = pack.doc && typeof pack.doc === 'object' ? buildRefs(pack.doc, other) : null; } catch { refs = null; }
            pack.refsFor = { doc: pack.doc, other, refs };
        }
        return pack.refsFor.refs;
    }
    const keepOf = (pack, id) => { if (!pack.keep.has(id)) pack.keep.set(id, {}); return pack.keep.get(id); };

    // A change made clears the last note; a refused one is said in the note line unless the editor shows it by the field already
    // (looked for once the editor's handler has run).
    function edited(result) {
        if (result?.ok) { if (!result.same) shell.setNotice(''); return result; }
        const text = result?.refusal ?? 'The change was not made.';
        queueMicrotask(() => {
            const shown = [...shell.el.querySelectorAll('.spage .st-problem')].some(node => !node.hidden && node.textContent.includes(text));
            if (!shown) shell.setNotice(text);
        });
        return result;
    }

    // The editor and page context (views/route.js): reads the pack's present document; commit and setPortrait are one undo step each;
    // say(text) puts a note in the note line, which a draw keeps (a change draws the page again inside commit).
    const ctxFor = (pack, extra = {}) => ({
        doc: pack.doc, kind: pack.kind, legacy: pack.legacy, other: state.packs[OTHER[pack.kind]]?.doc ?? null, get refs() { return refsOf(pack); }, problems: [], focus: null,
        commit: patches => edited(pack.commit(patches)), setPortrait: (name, bytes, more) => edited(pack.setPortrait(name, bytes, more)), openDoc: opened => openDocument(opened),
        say: text => shell.setNotice(text), keep: id => keepOf(pack, id), go, portrait, ...extra,
    });

    // The nav: the active pack's shared parts, the world's parts, the game's, and the page parts whose mount applies. A part page is
    // not drawn to find out (Pairing would check both packs in full on every change): `when` says it draws something (views/route.js).
    function navParts() {
        const lists = { world: state.packs.world ? partsOf(state.packs.world.doc) : [], game: state.packs.game ? partsOf(state.packs.game.doc) : [] };
        const out = [];
        for (const part of PARTS) {
            const owner = part.kind ? state.packs[part.kind] : active();
            if (!owner) continue;
            if (part.page) {
                if (mounts(part.page)) out.push({ ...part, sections: [], count: 0, always: true });
                continue;
            }
            const found = lists[owner.kind].find(item => item.id === part.id);
            if (found) out.push(found);
        }
        return out;
    }

    function refresh() {
        const pack = active();
        state.parts = navParts();
        const draft = pack.draft.at ? ` · Draft saved ${clock(pack.draft.at)}` : (pack.draft.message ? ' · Draft not saved' : '');
        shell.setSubtitle(`${kindLabel(pack)} · ${titleOf(pack)}${pack.legacy && pack.doc ? ' · Read-only' : ''}${draft}`);
        // An old-format pack is read-only and not checked (the Studio checks format 4): no problem count, no Export and no export note.
        const old = pack.legacy && Boolean(pack.doc);
        shell.setFooter(pack.check, { old });
        const zip = pack.doc && pack.kind === 'world' ? exportBlock(pack, state.packs.game) : null;
        const json = pack.doc ? exportBlock(pack) : null;
        shell.setExport(old ? { zip: false, json: false, blocked: null } : { zip: Boolean(pack.doc) && pack.kind === 'world' && !zip, json: Boolean(pack.doc) && !json, blocked: (json ?? zip)?.text ?? null });
        shell.setHistory(pack);
    }

    // The restore prompt for a pack whose saved draft differs from what was opened (until it is answered or the pack is edited).
    function offerNode(pack) {
        const offer = pack.offer;
        if (!offer) return null;
        const use = () => { pack.offer = null; drafts.clear(pack.kind, pack.draftId); redraw(); };
        const take = () => { pack.offer = null; const done = pack.restore(offer); if (!done.ok) shell.setNotice(done.refusal); redraw(); };
        return h('div', { class: 'cfm rec st-restore', role: 'group', 'aria-label': 'Restore your draft?' },
            h('b', 'Restore your draft?'), h('small', `Saved ${day(offer.at)} · changes not exported. Using the file deletes the draft.`),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 pri st-take', onClick: take }, 'Restore the draft'), h('button', { type: 'button', class: 'btn2 st-use', onClick: use }, 'Use the file')));
    }

    function setActive(kind) {
        if (!state.packs[kind] || state.active === kind) return;
        state.active = kind;
        state.problemAt = -1;
        refresh();
    }

    // A part with a "List · <page>" segment shows it when the page draws something.
    function withSegment(part, pack, nodes, focus) {
        const id = Object.keys(PAGES).find(key => PAGES[key].mount === 'segment' && PAGES[key].part === part.id);
        if (!id || !mounts(id)) return nodes;
        const view = pageNodes(id, ctxFor(pack, { focus }));
        if (!view.length) return nodes;
        const on = state.views[part.id] === id ? id : 'list';
        const segment = h('div', { class: 'sseg2 st-seg', role: 'group', 'aria-label': `${part.name}: list or ${PAGES[id].label.toLowerCase()}` },
            [['list', 'List'], [id, PAGES[id].label]].map(([value, label]) => h('button', { type: 'button', 'aria-pressed': String(on === value), dataset: { view: value }, onClick: () => { state.views[part.id] = value; show(part.id); } }, label)));
        return [segment, ...(on === 'list' ? nodes : view)];
    }

    function pageFor(part, focus) {
        const pack = part.kind ? state.packs[part.kind] : active();
        return [offerNode(pack), ...partNodes(part, pack, focus)];
    }

    // A section the pack holds nothing of yet (parts.js `absent`) is drawn from its empty value, which the first edit below that key writes,
    // in the same step (an edit of another key, or of the whole key, is left as it is).
    function firstEdit(pack, section) {
        if (!section.absent || section.value === undefined) return {};
        const below = patch => Array.isArray(patch?.path) && patch.path.length > 2 && patch.path[0] === 'content' && patch.path[1] === section.key;
        const start = { op: 'set', path: ['content', section.key], value: section.value };
        return { commit: patches => edited(pack.commit(Array.isArray(patches) && patches.some(below) && pack.doc?.content?.[section.key] === undefined ? [start, ...patches] : patches)) };
    }

    function partNodes(part, pack, focus) {
        const sections = part.sections.flatMap(section => sectionNodes(section, ctxFor(pack, { focus, problems: problemsAt(pack, section), ...firstEdit(pack, section) })));
        if (part.id === 'overview') {
            const other = state.packs[OTHER[pack.kind]];
            return renderOverview({
                doc: pack.doc, parts: partsOf(pack.doc), check: pack.check, name: pack.name, fresh: pack.fresh === true, old: Boolean(pack.legacy && pack.doc), portraits: pack.portraits, parseError: pack.parseError, onGo: go,
                cards: mounts('convert') ? pageNodes('convert', ctxFor(pack)) : [], fields: sections,
                other: other ? { kind: other.kind, title: titleOf(other) } : null, onSwitch: () => { setActive(other.kind); show('overview'); },
            });
        }
        if (part.id === 'problems') return renderProblems({ check: pack.check, onGo: go });
        if (part.page) return pageNodes(part.page, ctxFor(pack, { focus, check: pack.check }));
        return withSegment(part, pack, sections, focus);
    }

    function draw(part, keep) {
        const held = part.sections.filter(section => !section.absent);
        const desc = part.always || !held.length ? part.desc : `${part.desc}. ${held.map(s => `${s.key} ${s.count}`).join(' · ')}`;
        shell.setNav(state.parts, part.id);
        shell.setPage({ title: part.name, desc, nodes: pageFor(part, state.focus), section: true, keep });
        const rec = state.focus?.rec;
        const target = rec ? shell.el.querySelector(`.spage [data-rec="${CSS.escape(rec)}"]`) : null;
        target?.classList.add('st-hit');
        return target;
    }

    // `path` (Go to, F8): the field below the record, where its editor opens (`.st-at`, caret at `data-at`).
    function show(partId, rec = null, { section = true, path = null } = {}) {
        if (!active()) return false;
        const wanted = PARTS.find(item => item.id === partId);
        if (wanted?.kind) setActive(wanted.kind);
        const part = state.parts.find(item => item.id === partId) ?? state.parts[0];
        if (part.id !== state.current) active().keep.clear();
        state.current = part.id;
        state.focus = rec ? { rec, path: Array.isArray(path) ? path : null } : null;
        state.query = '';
        shell.setQuery('');
        const target = draw(part, false);
        if (!section) shell.showList();
        if (target) {
            target.scrollIntoView?.({ block: 'start' });
            // A marked control that is hidden (a gate's text box while its builder shows) hands over to its row's `data-goto` control.
            const marked = target.querySelector('.st-at');
            const field = marked?.closest('[hidden]') ? marked.closest('.srow')?.querySelector('[data-goto]') ?? null : marked;
            if (field) {
                const at = Number(field.dataset.at) || 0;
                field.focus({ preventScroll: true });
                field.setSelectionRange?.(at, at);
            } else target.focus({ preventScroll: true });
        }
        return true;
    }

    // Draws the current page again after a change, keeping its scroll and the box being typed in (with its caret).
    function redraw() {
        if (!active() || state.query) { if (active()) refresh(); return; }
        refresh();
        const part = state.parts.find(item => item.id === state.current);
        if (!part) { show(state.parts[0].id); return; }
        const typing = doc.activeElement?.closest?.('.spage') ? doc.activeElement : null;
        const rec = typing?.closest('[data-rec]')?.dataset.rec;
        const cls = typing?.classList?.[0];
        const caret = typing && 'selectionStart' in typing ? [typing.selectionStart, typing.selectionEnd] : null;
        // The box is found again as the same one among the record's boxes of its kind and label (a chip box is not the first text box).
        const label = typing?.getAttribute?.('aria-label') ?? null;
        const boxes = () => (rec && cls ? [...shell.el.querySelectorAll(`.spage [data-rec="${CSS.escape(rec)}"] ${typing.tagName.toLowerCase()}.${CSS.escape(cls)}`)] : []);
        const alike = list => list.filter(node => node.getAttribute('aria-label') === label);
        const nth = Math.max(0, alike(boxes()).indexOf(typing));
        draw(part, true);
        if (!rec || !cls) return;
        const after = boxes();
        const again = alike(after)[nth] ?? after[0];
        if (!again) return;
        again.focus({ preventScroll: true });
        if (caret) again.setSelectionRange?.(...caret);
    }

    function searchFor(text) {
        state.query = String(text ?? '').trim();
        shell.setQuery(text);
        if (!active()) return;
        if (!state.query) { show(state.current); return; }
        shell.setPage({ title: 'Search', desc: `In ${[state.packs.world, state.packs.game].filter(Boolean).map(titleOf).join(' and ')}`, nodes: renderSearch(searchParts(state.parts, state.query), state.query, go), section: true });
    }

    function holdPortraits(portraits) {
        heldFrom = portraits;
        for (const url of urls.values()) URL.revokeObjectURL(url);
        urls.clear();
        for (const file of portraits) {
            const kind = sniffImage(file.bytes);
            if (kind) urls.set(file.name, URL.createObjectURL(new Blob([file.bytes], { type: PORTRAIT_TYPES[kind] })));
        }
    }

    // What a session says: its document changed (redraw at once; the portraits are drawn from the present snapshot), its check landed
    // (the foot bar, Export and the page's problem lines), or its draft was saved.
    function changed(pack, what) {
        if (state.packs[pack.kind] !== pack) return;
        if (what === 'doc') pack.offer = null;
        if (pack.kind === 'world' && pack.portraits !== heldFrom) holdPortraits(pack.portraits);
        if (what === 'draft') { if (pack === active()) refresh(); return; }
        redraw();
    }

    function sessionOf(opened) {
        const session = createSession(opened, { ...kindOf(opened.doc), delay, drafts, onUpdate: what => changed(session, what) });
        session.offer = null;
        session.keep = new Map();
        return session;
    }

    // A saved draft that differs from what was opened is offered; one that is the same is let go.
    async function offerDraft(pack) {
        if (!pack.draftId) return;
        const found = await loadDraft(pack.kind, pack.draftId, store);
        if (!found.ok || !found.draft || state.packs[pack.kind] !== pack || pack.edited) return;
        if (found.draft.text === pack.text && samePictures(found.draft.portraits, pack.portraits)) { drafts.clear(pack.kind, pack.draftId); return; }
        pack.offer = found.draft;
        redraw();
    }

    // A world (or a format 3 pack) takes the world slot and a game pack the game slot; the other slot is kept. A game.json opened
    // with the pack fills the game slot.
    // `fresh`: a pack made in the Studio (New world, New game), not exported yet; it opens on Overview, on a phone too.
    function install(opened, notes = [], { fresh = false } = {}) {
        const main = sessionOf(opened);
        main.fresh = fresh;
        const placed = [main];
        state.packs[main.kind]?.dispose();
        state.packs[main.kind] = main;
        if (main.kind === 'world') holdPortraits(main.portraits);
        if (opened.game) {
            const game = sessionOf(opened.game);
            if (game.kind === 'game') { state.packs.game?.dispose(); state.packs.game = game; placed.push(game); }
            else notes.push(`${opened.game.name} is not a game pack, so it was not opened.`);
        }
        state.active = main.kind;
        state.problemAt = -1;
        state.views = {};
        state.current = null;
        refresh();
        shell.setNotice(notes.join(' '));
        show('overview', null, { section: fresh });
        for (const pack of placed) offerDraft(pack);
    }

    async function open(files) {
        const opened = await openPicked(files);
        if (!opened.ok) { shell.setNotice(`Not opened: ${opened.message}`); return opened; }
        install(opened, opened.unused.length ? [`Not used (the cast does not name them): ${opened.unused.join(', ')}.`] : []);
        return opened;
    }

    // ctx.openDoc: New world, New game and Convert open a document as if it had been picked.
    function openDocument({ text, doc: data, portraits = [], name } = {}) {
        const made = documentOf({ text, doc: data, portraits });
        if (!made.doc || typeof made.doc !== 'object' || Array.isArray(made.doc)) return { ok: false, refusal: 'That is not a pack to open.' };
        install({ name: name ?? `New ${kindOf(made.doc).kind} pack`, text: made.text, doc: made.doc, parseError: null, portraits: [...made.portraits], unused: [] }, [], { fresh: true });
        return { ok: true };
    }

    // With the world active, the zip carries the open game as game.json; with the game active, Export gives the game's pack.json.
    // A check still waiting is run first; a pack with errors (or a zip whose game has them) is not exported.
    function exportAs(kind) {
        const pack = active();
        if (!pack?.doc || pack.legacy) return null; // an old-format pack is read-only: no Export, Ctrl/Cmd+S included
        const zip = kind === 'zip' && pack.kind === 'world';
        const game = zip ? state.packs.game : null;
        const before = [pack.check, game?.check];
        pack.flush();
        game?.flush();
        if (pack.check !== before[0] || game?.check !== before[1]) redraw();
        if (exportBlock(pack, game)) { shell.setNotice(''); refresh(); return null; }
        const file = zip ? exportZip(pack, game) : exportJson(pack);
        save(file, zip ? 'application/zip' : 'application/json');
        pack.fresh = false;
        shell.setNotice(file.missing?.length ? `Exported ${file.name}; the cast names portraits that were not opened: ${file.missing.join(', ')}.` : `Exported ${file.name}.`);
        return file;
    }

    const goTo = problem => show(problem.part, problem.rec, { path: problem.field });

    function nextProblem() {
        const check = active()?.check;
        const all = check ? [...check.errors, ...check.warnings] : [];
        if (!all.length) return;
        state.problemAt = (state.problemAt + 1) % all.length;
        const at = state.problemAt;
        goTo(all[at]);
        state.problemAt = at;
    }

    // The export note's link: the first error of the active pack, else of the game pack its zip would carry.
    function goFirst() {
        const own = active()?.check.errors[0];
        if (own) { goTo(own); return; }
        const carried = state.packs.game?.check.errors[0];
        if (carried) { setActive('game'); goTo(carried); }
    }

    // Undo and redo: what was typed in a JSON row and not applied is dropped, so the rows show the document undo gave.
    const step = name => () => {
        const pack = active();
        if (!pack) return;
        for (const kept of pack.keep.values()) if ('text' in kept) kept.text = null;
        if (pack[name]()) shell.setNotice('');
    };

    const shell = createShell({
        host: root,
        onOpen: files => open(files),
        onExportZip: () => exportAs('zip'),
        onExportJson: () => exportAs('json'),
        onUndo: step('undo'),
        onRedo: step('redo'),
        onTheme: () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; storage?.setItem?.(THEME_KEY, state.theme); paintTheme(); },
        onPick: partId => show(partId),
        onQuery: text => searchFor(text),
        onBack: () => shell.showList(),
        onProblems: () => show('problems'),
        onGoFirst: goFirst,
    });
    const unbind = bindKeys(doc, {
        open: () => shell.file.click(),
        exportZip: () => exportAs('zip'),
        undo: step('undo'),
        redo: step('redo'),
        search: () => shell.focusSearch(),
        part: n => { const part = state.parts[n - 1]; if (part) show(part.id); },
        nextProblem,
        // Esc closes the open sheet first (the id picker, a gate term, New world): the Studio has no back stack, so it is closed as a
        // tap on its backdrop closes it (ui/kit/sheet.js), which hands the focus back to its opener.
        back: () => {
            const sheet = [...doc.querySelectorAll('.sh-ov')].at(-1);
            if (sheet) sheet.click();
            else if (state.query) searchFor('');
            else shell.showList();
        },
    });
    paintTheme();
    shell.setPage({ title: 'Open a pack', desc: 'A pack .zip (pack.json, its portraits and the game.json that goes with it), or a pack.json with its portrait images and game.json. The Studio checks it with the game’s own pack checker.', nodes: pageNodes('start', { pick: () => shell.file.click(), openDoc: opened => openDocument(opened) }), section: true });

    return {
        open,
        show,
        exportAs,
        get state() { return state; },
        destroy() { unbind(); for (const pack of Object.values(state.packs)) pack?.dispose(); for (const url of urls.values()) URL.revokeObjectURL(url); shell.el.remove(); },
    };
}
