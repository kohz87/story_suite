// The Studio's frame in the Settings overlay's look (mock v7 decision 33, ui/css/settings.css; the Studio mock's record page MK-1):
// header with the World / Game switch (both packs open, MK-6), Undo and Redo, Open, Export and the theme switch, and the note that says
// why Export is off; the parts as a side nav (tablet and up), each with its count or its problems, or a phone list, a world pack's parts
// under World and a game pack's under Game; one page; the pack-check bar at the foot. A page with record panes is fitted by wide.js.

import { h, clear } from '../ui/kit/dom.js';
import { fitPanes, restoreScroll, scrollOf } from './wide.js';

const GROUPS = ['Pack', 'World', 'Game', 'Check'];

function searchBox(onQuery) {
    const el = h('input', { type: 'search', class: 'psrch', placeholder: 'Search the pack…', 'aria-label': 'Search the pack' });
    el.addEventListener('input', () => onQuery(el.value));
    return el;
}

const label = (long, short) => [h('span', { class: 'fl3' }, long), h('span', { class: 'fs3' }, short)];

// The foot bar's count: the problems in the danger red, then the warnings.
function footerText(check) {
    if (check.total === 0) return ['No problems'];
    const errors = check.errors.length ? h('span', { class: 'st-ferr' }, `${check.errors.length} problem${check.errors.length === 1 ? '' : 's'}`) : null;
    const warnings = check.warnings.length ? `${check.warnings.length} warning${check.warnings.length === 1 ? '' : 's'}` : null;
    return [errors, errors && warnings ? ' · ' : null, warnings].filter(Boolean);
}

const iconButton = (cls, name, title, glyph, onClick) => h('button', { type: 'button', class: `btn2 ic ${cls}`, 'aria-label': name, title, disabled: true, onClick: () => onClick() }, glyph);

// A nav row's count (`badge`: `{ text, bad, title }` from nav-counts.js), right-aligned as in the mock.
const badgeOf = badge => (badge?.text ? h('em', { class: badge.bad ? 'bad' : null, title: badge.title ?? null, 'aria-label': badge.title ?? null }, badge.text) : h('em'));

/**
 * Builds the frame in `host`. Handlers: `onOpen(files)`, `onExportZip()`, `onExportJson()`, `onUndo()`, `onRedo()`, `onTheme()`,
 * `onPick(partId)`, `onQuery(text)`, `onBack()`, `onProblems()`, `onGoFirst()` (the export note's link), `onSwitch(kind)`. Returns
 * `{ el, file, setSubtitle, setPacks, setNav, setPage, setFooter, showList, setNotice, setExport, setHistory, setQuery, focusSearch }`.
 */
export function createShell({ host, onOpen, onExportZip, onExportJson, onUndo, onRedo, onTheme, onPick, onQuery, onBack, onProblems, onGoFirst, onSwitch = () => {} }) {
    const file = h('input', { type: 'file', class: 'st-file', hidden: true, multiple: true, accept: '.zip,.json,application/json,application/zip,image/webp,image/png,image/jpeg', 'aria-label': 'Pack file' });
    file.addEventListener('change', () => { const picked = [...file.files]; file.value = ''; if (picked.length) onOpen(picked); });
    const subtitle = h('small', 'No pack open');
    const exportZip = h('button', { type: 'button', class: 'btn2 st-zip', disabled: true, onClick: () => onExportZip() }, label('Export zip', 'Zip'));
    const exportJson = h('button', { type: 'button', class: 'btn2 st-json-out', disabled: true, onClick: () => onExportJson() }, label('pack.json', 'JSON'));
    const undo = iconButton('st-undo', 'Undo', 'Undo (Ctrl+Z)', '↶', onUndo);
    const redo = iconButton('st-redo', 'Redo', 'Redo (Ctrl+Shift+Z)', '↷', onRedo);
    const packSwitch = h('span', { class: 'sseg2 pswitch st-switch', role: 'group', 'aria-label': 'Pack you are editing', hidden: true });
    const header = h('div', { class: 'shd' },
        h('span', { class: 'ttl' }, h('b', 'Pack Studio'), subtitle), packSwitch,
        h('span', { class: 'st-acts' }, undo, redo, h('span', { class: 'gap' }),
            h('button', { type: 'button', class: 'btn2 pri st-open', onClick: () => file.click() }, 'Open'),
            exportZip, exportJson),
        h('button', { type: 'button', class: 'ibtn x st-theme', 'aria-label': 'Switch dark or light', onClick: () => onTheme() }, '◐'),
        file);
    const sideSearch = searchBox(onQuery);
    const listSearch = searchBox(onQuery);
    const side = h('nav', { class: 'snav', 'aria-label': 'Pack parts' });
    const list = h('div', { class: 'phonelist' });
    const page = h('div', { class: 'spage' });
    const notice = h('p', { class: 'fine st-note', role: 'status', 'aria-live': 'polite', hidden: true });
    const blockText = h('span');
    const block = h('p', { class: 'fine st-note st-block', id: 'st-block', role: 'status', hidden: true }, blockText, ' ', h('button', { type: 'button', class: 'lnk', onClick: () => onGoFirst() }, 'Go to the first ›'));
    const body = h('div', { class: 'sbody', dataset: { page: 'list' } }, side, h('div', { class: 'smain' }, notice, block, list, page));
    const footer = h('button', { type: 'button', class: 'sfoot st-foot', hidden: true, onClick: () => onProblems() });
    const el = h('div', { class: 'sov st-app', role: 'main', 'aria-label': 'Pack Studio' }, h('div', { class: 'glass' }, header, body, footer));
    host.appendChild(el);
    const main = body.querySelector('.smain');
    // An editor that opens or closes a record inside its own nodes is fitted again without a new setPage.
    if (typeof MutationObserver === 'function') new MutationObserver(() => fitPanes(body, page)).observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-open'] });

    /** `packs`: `[{ kind, title, errors, active }]`, the open packs; the switch shows while both are open. */
    function setPacks(packs) {
        packSwitch.hidden = packs.length < 2;
        const both = packs.length > 1 ? 'both packs' : 'the pack';
        for (const box of [sideSearch, listSearch]) { box.placeholder = `Search ${both}…`; box.setAttribute('aria-label', `Search ${both}`); }
        if (packs.length < 2) { clear(packSwitch); return; }
        packSwitch.replaceChildren(...packs.map(pack => h('button', { type: 'button', dataset: { kind: pack.kind }, 'aria-pressed': String(pack.active), title: `Edit the ${pack.kind} pack`, onClick: () => onSwitch(pack.kind) },
            h('small', pack.kind === 'game' ? 'Game' : 'World'), h('span', pack.title), pack.errors ? h('em', { 'aria-label': `${pack.errors} problem${pack.errors === 1 ? '' : 's'}` }, `✕ ${pack.errors}`) : null)));
    }

    /** `badges`: part id → `{ text, bad, title }`, the count or problems each nav row shows. */
    function setNav(parts, current, badges = {}) {
        clear(side);
        clear(list);
        side.appendChild(sideSearch);
        list.appendChild(listSearch);
        for (const group of GROUPS) {
            const items = parts.filter(part => part.group === group);
            if (!items.length) continue;
            side.appendChild(h('div', { class: 'grpl' }, group));
            list.appendChild(h('div', { class: 'secl2' }, group));
            for (const part of items) {
                side.appendChild(h('button', { type: 'button', class: 'si3', dataset: { part: part.id }, 'aria-current': String(part.id === current), onClick: () => onPick(part.id) },
                    h('i', { 'aria-hidden': 'true' }, part.icon), part.name, badgeOf(badges[part.id])));
            }
            list.appendChild(h('div', { class: 'slist' }, items.map(part => h('button', { type: 'button', dataset: { part: part.id }, onClick: () => onPick(part.id) },
                h('i', { 'aria-hidden': 'true' }, part.icon), h('span', h('b', part.name), h('small', part.always ? part.desc : `${part.count} · ${part.desc}`)), h('span', '›')))));
        }
    }

    /**
     * `{ title, desc, nodes, section, keep }`: `section` true shows the page on the phone (false shows the parts list); `keep` true (a
     * redraw) keeps the scroll (each side's too) and which of the two the phone shows; 'list' keeps only the list side's scroll.
     */
    function setPage({ title, desc = '', nodes = [], section = true, keep = false }) {
        const scroll = scrollOf(main, page);
        clear(page);
        page.append(h('button', { type: 'button', class: 'btn2 sback', onClick: () => onBack() }, '‹ Parts'), h('div', { class: 'st-ptitle' }, h('h2', title), desc ? h('p', { class: 'sdesc' }, desc) : null), ...nodes.flat().filter(Boolean));
        fitPanes(body, page);
        if (keep !== true) body.setAttribute('data-page', section ? 'section' : 'list'); // a redraw leaves the phone on the list or the page it showed
        restoreScroll(main, page, scroll, keep);
    }

    // `old`: a read-only old-format pack, which the Studio does not check (MK-9 "old").
    function setFooter(check, { old = false } = {}) {
        footer.hidden = !check;
        if (!check) return;
        footer.dataset.ok = old ? 'old' : String(check.total === 0);
        if (old) {
            footer.replaceChildren(h('span', '◇ ', ...label('Pack check', 'Check')), h('b', { class: 'v' }, 'Old format: not checked'), h('span', { class: 'fl3' }, 'The Studio checks and edits format 4'), h('span', { style: { 'margin-left': 'auto' } }, '›'));
            return;
        }
        const works = check.errors.length ? h('span', { class: 'fl3' }, 'Export is off until the problems are fixed')
            : (check.warnings.length ? h('span', { class: 'fl3' }, 'Export works; warnings are listed in Problems') : null);
        footer.replaceChildren(...[h('span', check.total ? '⚠ ' : '✓ ', ...label('Pack check', 'Check')), h('b', { class: 'v' }, ...footerText(check)), works, h('span', { style: { 'margin-left': 'auto' } }, '›')].filter(Boolean));
    }

    return {
        el,
        file,
        setSubtitle: text => { subtitle.textContent = text; },
        setPacks,
        setNav,
        setPage,
        setFooter,
        showList: () => body.setAttribute('data-page', 'list'),
        setNotice: text => { notice.textContent = text ?? ''; notice.hidden = !text; },
        /** `zip`, `json`: whether each Export button works; `blocked`: the sentence saying why Export is off, or null. */
        setExport: ({ zip, json, blocked = null }) => {
            exportZip.disabled = !zip;
            exportJson.disabled = !json;
            blockText.textContent = blocked ?? '';
            block.hidden = !blocked;
            for (const button of [exportZip, exportJson]) {
                if (blocked && button.disabled) button.setAttribute('aria-describedby', 'st-block');
                else button.removeAttribute('aria-describedby');
            }
        },
        setHistory: ({ canUndo, canRedo }) => { undo.disabled = !canUndo; redo.disabled = !canRedo; },
        setQuery: text => { for (const box of [sideSearch, listSearch]) if (box.value !== text) box.value = text; },
        focusSearch: () => {
            const phone = side.offsetParent === null; // the side nav is hidden under 601 px
            if (phone) body.setAttribute('data-page', 'list');
            (phone ? listSearch : sideSearch).focus();
        },
    };
}
