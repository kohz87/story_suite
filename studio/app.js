// Starts the Studio in a page: the theme, the frame, and what Open, the parts, search, Problems, Go to, Export and the keys do.
// The open pack is held as the author wrote it (text, parsed document, portraits); every view reads that, and the checker is the
// game's own (check.js). Nothing is edited yet: this is the read-only skeleton (scratch/design/studio-plan.md, job S-0).

import { h } from '../ui/kit/dom.js';
import { applyTheme } from '../ui/theme/apply.js';
import { GLASS_DARK, GLASS_LIGHT } from '../ui/theme/tokens.js';
import { PORTRAIT_TYPES, sniffImage } from '../packs/portraits.js';
import { checkText } from './check.js';
import { exportJson, exportZip } from './export.js';
import { bindKeys } from './keys.js';
import { openPicked } from './load.js';
import { partsOf } from './parts.js';
import { createShell } from './shell.js';
import { renderOverview } from './views/overview.js';
import { renderProblems } from './views/problems.js';
import { renderRecords } from './views/records.js';
import { renderSearch, searchParts } from './views/search.js';

const THEME_KEY = 'storySuite.studio.theme';

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

/**
 * Mounts the Studio on `root` (the `.su-root` element). `storage` remembers the theme; `download(file, type)` saves an export
 * (default: a browser download). Returns `{ open(files), show(partId, rec?), exportAs(kind), state, destroy() }`.
 */
export function startStudio({ doc = globalThis.document, root, storage = globalThis.localStorage, download = null } = {}) {
    const state = { pack: null, parts: [], check: null, current: null, query: '', problemAt: -1, theme: storage?.getItem?.(THEME_KEY) === 'light' ? 'light' : 'dark' };
    const urls = new Map();
    const save = download ?? ((file, type) => saveFile(doc, file, type));

    const paintTheme = () => applyTheme(root, state.theme === 'light' ? GLASS_LIGHT : GLASS_DARK, { scheme: state.theme });
    const portrait = name => (urls.has(name) ? h('img', { class: 'st-thumb', src: urls.get(name), alt: '' }) : (name ? h('span', { class: 'st-thumb st-nopic', title: `${name} is not in what was opened` }, '?') : null));
    const go = (partId, rec = null) => show(partId, rec);

    function pageFor(part, rec) {
        const p = state.pack;
        if (part.id === 'overview') return renderOverview({ doc: p.doc, parts: state.parts, check: state.check, name: p.name, portraits: p.portraits, parseError: p.parseError, onGo: go });
        if (part.id === 'problems') return renderProblems({ check: state.check, onGo: go });
        return renderRecords(part, { portrait, showAll: rec !== null });
    }

    function show(partId, rec = null, { section = true } = {}) {
        if (!state.pack) return false;
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
        if (!state.pack) return;
        if (!state.query) { show(state.current); return; }
        shell.setPage({ title: 'Search', desc: `In ${state.pack.name}`, nodes: renderSearch(searchParts(state.parts, state.query), state.query, go), section: true });
    }

    async function open(files) {
        const opened = await openPicked(files);
        if (!opened.ok) { shell.setNotice(`Not opened: ${opened.message}`); return opened; }
        for (const url of urls.values()) URL.revokeObjectURL(url);
        urls.clear();
        for (const file of opened.portraits) {
            const kind = sniffImage(file.bytes);
            if (kind) urls.set(file.name, URL.createObjectURL(new Blob([file.bytes], { type: PORTRAIT_TYPES[kind] })));
        }
        state.pack = opened;
        state.parts = partsOf(opened.doc);
        state.check = checkText(opened.text);
        state.problemAt = -1;
        const doc = opened.doc;
        shell.setSubtitle(doc ? [doc.name ?? doc.id ?? opened.name, doc.version].filter(Boolean).join(' · ') : opened.name);
        shell.setNotice(opened.unused.length ? `Not used (the cast does not name them): ${opened.unused.join(', ')}.` : '');
        shell.setFooter(state.check);
        shell.setExport(Boolean(doc));
        show('overview', null, { section: false });
        return opened;
    }

    function exportAs(kind) {
        if (!state.pack?.doc) return null;
        const file = kind === 'zip' ? exportZip(state.pack) : exportJson(state.pack);
        save(file, kind === 'zip' ? 'application/zip' : 'application/json');
        shell.setNotice(file.missing?.length ? `Exported ${file.name}; the cast names portraits that were not opened: ${file.missing.join(', ')}.` : `Exported ${file.name}.`);
        return file;
    }

    function nextProblem() {
        const all = state.check ? [...state.check.errors, ...state.check.warnings] : [];
        if (!all.length) return;
        state.problemAt = (state.problemAt + 1) % all.length;
        show(all[state.problemAt].part, all[state.problemAt].rec);
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
    shell.setPage({ title: 'Open a pack', desc: 'A pack .zip (pack.json and its portraits), or a pack.json with its portrait images. The Studio checks it with the game’s own pack checker.', nodes: [h('button', { type: 'button', class: 'btn2 pri st-start', onClick: () => shell.file.click() }, 'Open a pack…')], section: true });

    return {
        open,
        show,
        exportAs,
        get state() { return state; },
        destroy() { unbind(); for (const url of urls.values()) URL.revokeObjectURL(url); shell.el.remove(); },
    };
}
