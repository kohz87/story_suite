// Starts the Studio in a page: the theme, the frame, and what Open, the parts, search, Problems, Go to, Export and the keys do.
// The Studio holds at most one world pack and one game pack (format 4), each as the author wrote it (text, parsed document,
// portraits) with its own check; the active one is the one Overview, Problems and the foot bar show, and picking a part of the
// other makes that one active. Every view reads the document, and the checker is the game's own (check.js). Nothing is edited yet:
// the parts are drawn through views/route.js, whose editor and page slots the later Studio jobs fill.

import { h } from '../ui/kit/dom.js';
import { applyTheme } from '../ui/theme/apply.js';
import { GLASS_DARK, GLASS_LIGHT } from '../ui/theme/tokens.js';
import { PORTRAIT_TYPES, sniffImage } from '../packs/portraits.js';
import { checkText } from './check.js';
import { exportJson, exportZip } from './export.js';
import { bindKeys } from './keys.js';
import { openPicked } from './load.js';
import { PARTS, kindOf, partOfPath, partsOf } from './parts.js';
import { createShell } from './shell.js';
import { renderOverview } from './views/overview.js';
import { renderProblems } from './views/problems.js';
import { PAGES, pageNodes, sectionNodes } from './views/route.js';
import { renderSearch, searchParts } from './views/search.js';

const THEME_KEY = 'storySuite.studio.theme';
const NOT_YET = Object.freeze({ ok: false, refusal: 'Editing is not in the Studio yet.' });
const OTHER = { world: 'game', game: 'world' };

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

// One opened pack with its kind and check. check.js files problems as format 3 does; a format 4 pack's are filed by its own kind.
function packOf(opened) {
    const pack = { ...opened, ...kindOf(opened.doc) };
    const check = checkText(pack.text);
    if (pack.legacy) return { ...pack, check };
    const tag = problem => ({ ...problem, ...partOfPath(problem.path, pack.kind) });
    const errors = check.errors.map(tag);
    const warnings = check.warnings.map(tag);
    const byPart = {};
    for (const problem of [...errors, ...warnings]) (byPart[problem.part] ??= []).push(problem);
    return { ...pack, check: { ...check, errors, warnings, byPart } };
}

const titleOf = pack => (pack.doc ? [pack.doc.name ?? pack.doc.id ?? pack.name, pack.doc.version].filter(Boolean).join(' · ') : pack.name);
const kindLabel = pack => (pack.legacy ? (typeof pack.doc?.format === 'number' ? `Format ${pack.doc.format}` : 'Old format') : (pack.kind === 'game' ? 'Game' : 'World'));
// The problems of one section: those whose path is the key or under it.
const problemsAt = (pack, section) => {
    const at = section.where === 'top' ? section.key : `content.${section.key}`;
    return [...pack.check.errors, ...pack.check.warnings].filter(problem => problem.path === at || String(problem.path).startsWith(`${at}.`) || String(problem.path).startsWith(`${at}[`));
};

/**
 * Mounts the Studio on `root` (the `.su-root` element). `storage` remembers the theme; `download(file, type)` saves an export
 * (default: a browser download). Returns `{ open(files), show(partId, rec?), exportAs(kind), state, destroy() }`.
 */
export function startStudio({ doc = globalThis.document, root, storage = globalThis.localStorage, download = null } = {}) {
    const state = { packs: { world: null, game: null }, active: null, parts: [], current: null, query: '', problemAt: -1, views: {}, theme: storage?.getItem?.(THEME_KEY) === 'light' ? 'light' : 'dark' };
    const urls = new Map(); // the world pack's portraits
    const save = download ?? ((file, type) => saveFile(doc, file, type));

    const paintTheme = () => applyTheme(root, state.theme === 'light' ? GLASS_LIGHT : GLASS_DARK, { scheme: state.theme });
    const portrait = name => (urls.has(name) ? h('img', { class: 'st-thumb', src: urls.get(name), alt: '' }) : (name ? h('span', { class: 'st-thumb st-nopic', title: `${name} is not in what was opened` }, '?') : null));
    const go = (partId, rec = null) => show(partId, rec);
    const active = () => state.packs[state.active];
    const mounts = id => PAGES[id].when({ pack: active(), world: state.packs.world, game: state.packs.game });

    // The editor and page context (views/route.js). Editing is not wired yet, so commit, setPortrait and openDoc refuse.
    const ctxFor = (pack, extra = {}) => ({
        doc: pack.doc, kind: pack.kind, legacy: pack.legacy, other: state.packs[OTHER[pack.kind]]?.doc ?? null, refs: null, problems: [], focus: null,
        commit: () => NOT_YET, setPortrait: () => NOT_YET, openDoc: () => NOT_YET, go, portrait, ...extra,
    });

    // The nav: the active pack's shared parts, the world's parts, the game's, and the page parts whose page draws something.
    function navParts() {
        const lists = { world: state.packs.world ? partsOf(state.packs.world.doc) : [], game: state.packs.game ? partsOf(state.packs.game.doc) : [] };
        const out = [];
        for (const part of PARTS) {
            const owner = part.kind ? state.packs[part.kind] : active();
            if (!owner) continue;
            if (part.page) {
                if (mounts(part.page) && pageNodes(part.page, ctxFor(owner)).length) out.push({ ...part, sections: [], count: 0, always: true });
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
        shell.setSubtitle(`${kindLabel(pack)} · ${titleOf(pack)}`);
        shell.setFooter(pack.check);
        shell.setExport({ zip: Boolean(pack.doc) && pack.kind === 'world', json: Boolean(pack.doc) });
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

    function pageFor(part, rec) {
        const pack = part.kind ? state.packs[part.kind] : active();
        const focus = rec ? { rec, path: null } : null;
        const sections = part.sections.flatMap(section => sectionNodes(section, ctxFor(pack, { focus, problems: problemsAt(pack, section) })));
        if (part.id === 'overview') {
            const other = state.packs[OTHER[pack.kind]];
            return renderOverview({
                doc: pack.doc, parts: partsOf(pack.doc), check: pack.check, name: pack.name, portraits: pack.portraits, parseError: pack.parseError, onGo: go,
                cards: mounts('convert') ? pageNodes('convert', ctxFor(pack)) : [], fields: sections,
                other: other ? { kind: other.kind, title: titleOf(other) } : null, onSwitch: () => { setActive(other.kind); show('overview'); },
            });
        }
        if (part.id === 'problems') return renderProblems({ check: pack.check, onGo: go });
        if (part.page) return pageNodes(part.page, ctxFor(pack, { focus }));
        return withSegment(part, pack, sections, focus);
    }

    function show(partId, rec = null, { section = true } = {}) {
        if (!active()) return false;
        const wanted = PARTS.find(item => item.id === partId);
        if (wanted?.kind) setActive(wanted.kind);
        const part = state.parts.find(item => item.id === partId) ?? state.parts[0];
        state.current = part.id;
        state.query = '';
        shell.setQuery('');
        shell.setNav(state.parts, part.id);
        const desc = part.always ? part.desc : `${part.desc}. ${part.sections.map(s => `${s.key} ${s.count}`).join(' · ')}`;
        shell.setPage({ title: part.name, desc, nodes: pageFor(part, rec), section });
        if (rec) {
            const target = shell.el.querySelector(`.spage [data-rec="${CSS.escape(rec)}"]`);
            if (target) {
                target.classList.add('st-hit');
                target.scrollIntoView?.({ block: 'start' });
                target.focus({ preventScroll: true });
            }
        }
        return true;
    }

    function searchFor(text) {
        state.query = String(text ?? '').trim();
        shell.setQuery(text);
        if (!active()) return;
        if (!state.query) { show(state.current); return; }
        shell.setPage({ title: 'Search', desc: `In ${[state.packs.world, state.packs.game].filter(Boolean).map(titleOf).join(' and ')}`, nodes: renderSearch(searchParts(state.parts, state.query), state.query, go), section: true });
    }

    function holdPortraits(portraits) {
        for (const url of urls.values()) URL.revokeObjectURL(url);
        urls.clear();
        for (const file of portraits) {
            const kind = sniffImage(file.bytes);
            if (kind) urls.set(file.name, URL.createObjectURL(new Blob([file.bytes], { type: PORTRAIT_TYPES[kind] })));
        }
    }

    // A world (or a format 3 pack) takes the world slot and a game pack the game slot; the other slot is kept. A game.json opened
    // with the pack fills the game slot.
    async function open(files) {
        const opened = await openPicked(files);
        if (!opened.ok) { shell.setNotice(`Not opened: ${opened.message}`); return opened; }
        const main = packOf(opened);
        if (main.kind === 'world') holdPortraits(opened.portraits);
        state.packs[main.kind] = main;
        const notes = opened.unused.length ? [`Not used (the cast does not name them): ${opened.unused.join(', ')}.`] : [];
        if (opened.game) {
            const game = packOf(opened.game);
            if (game.kind === 'game') state.packs.game = game;
            else notes.push(`${opened.game.name} is not a game pack, so it was not opened.`);
        }
        state.active = main.kind;
        state.problemAt = -1;
        state.views = {};
        refresh();
        shell.setNotice(notes.join(' '));
        show('overview', null, { section: false });
        return opened;
    }

    // With the world active, the zip carries the open game as game.json; with the game active, Export gives the game's pack.json.
    function exportAs(kind) {
        const pack = active();
        if (!pack?.doc) return null;
        const zip = kind === 'zip' && pack.kind === 'world';
        const file = zip ? exportZip(pack, state.packs.game) : exportJson(pack);
        save(file, zip ? 'application/zip' : 'application/json');
        shell.setNotice(file.missing?.length ? `Exported ${file.name}; the cast names portraits that were not opened: ${file.missing.join(', ')}.` : `Exported ${file.name}.`);
        return file;
    }

    function nextProblem() {
        const check = active()?.check;
        const all = check ? [...check.errors, ...check.warnings] : [];
        if (!all.length) return;
        state.problemAt = (state.problemAt + 1) % all.length;
        const at = state.problemAt;
        show(all[at].part, all[at].rec);
        state.problemAt = at;
    }

    const shell = createShell({
        host: root,
        onOpen: files => open(files),
        onExportZip: () => exportAs('zip'),
        onExportJson: () => exportAs('json'),
        onTheme: () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; storage?.setItem?.(THEME_KEY, state.theme); paintTheme(); },
        onPick: partId => show(partId),
        onQuery: text => searchFor(text),
        onBack: () => shell.showList(),
        onProblems: () => show('problems'),
    });
    const unbind = bindKeys(doc, {
        open: () => shell.file.click(),
        exportZip: () => exportAs('zip'),
        search: () => shell.focusSearch(),
        part: n => { const part = state.parts[n - 1]; if (part) show(part.id); },
        nextProblem,
        back: () => (state.query ? searchFor('') : shell.showList()),
    });
    paintTheme();
    shell.setPage({ title: 'Open a pack', desc: 'A pack .zip (pack.json, its portraits and the game.json that goes with it), or a pack.json with its portrait images and game.json. The Studio checks it with the game’s own pack checker.', nodes: pageNodes('start', { pick: () => shell.file.click() }), section: true });

    return {
        open,
        show,
        exportAs,
        get state() { return state; },
        destroy() { unbind(); for (const url of urls.values()) URL.revokeObjectURL(url); shell.el.remove(); },
    };
}
