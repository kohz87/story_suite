// The Studio's frame in the Settings overlay's look (mock v7 decision 33, ui/css/settings.css; the Studio mock's record page MK-1):
// header with Undo and Redo, Open, Export and the theme switch, and the note that says why Export is off; the parts as a side nav (tablet and up) or a phone list, a world pack's parts under World and a game pack's under Game;
// one page; the pack-check bar at the foot.

import { h, clear } from '../ui/kit/dom.js';

const GROUPS = ['Pack', 'World', 'Game', 'Check'];

function searchBox(onQuery) {
    const el = h('input', { type: 'search', class: 'psrch', placeholder: 'Search the pack…', 'aria-label': 'Search the pack' });
    el.addEventListener('input', () => onQuery(el.value));
    return el;
}

const label = (long, short) => [h('span', { class: 'fl3' }, long), h('span', { class: 'fs3' }, short)];

function footerText(check) {
    if (check.total === 0) return 'No problems';
    const parts = [];
    if (check.errors.length) parts.push(`${check.errors.length} problem${check.errors.length === 1 ? '' : 's'}`);
    if (check.warnings.length) parts.push(`${check.warnings.length} warning${check.warnings.length === 1 ? '' : 's'}`);
    return parts.join(' · ');
}

const iconButton = (cls, name, title, glyph, onClick) => h('button', { type: 'button', class: `btn2 ic ${cls}`, 'aria-label': name, title, disabled: true, onClick: () => onClick() }, glyph);

/**
 * Builds the frame in `host`. Handlers: `onOpen(files)`, `onExportZip()`, `onExportJson()`, `onUndo()`, `onRedo()`, `onTheme()`,
 * `onPick(partId)`, `onQuery(text)`, `onBack()`, `onProblems()`, `onGoFirst()` (the export note's link). Returns `{ el, file, setSubtitle,
 * setNav, setPage, setFooter, showList, setNotice, setExport, setHistory, setQuery, focusSearch }`.
 */
export function createShell({ host, onOpen, onExportZip, onExportJson, onUndo, onRedo, onTheme, onPick, onQuery, onBack, onProblems, onGoFirst }) {
    const file = h('input', { type: 'file', class: 'st-file', hidden: true, multiple: true, accept: '.zip,.json,application/json,application/zip,image/webp,image/png,image/jpeg', 'aria-label': 'Pack file' });
    file.addEventListener('change', () => { const picked = [...file.files]; file.value = ''; if (picked.length) onOpen(picked); });
    const subtitle = h('small', 'No pack open');
    const exportZip = h('button', { type: 'button', class: 'btn2 st-zip', disabled: true, onClick: () => onExportZip() }, label('Export zip', 'Zip'));
    const exportJson = h('button', { type: 'button', class: 'btn2 st-json-out', disabled: true, onClick: () => onExportJson() }, label('pack.json', 'JSON'));
    const undo = iconButton('st-undo', 'Undo', 'Undo (Ctrl+Z)', '↶', onUndo);
    const redo = iconButton('st-redo', 'Redo', 'Redo (Ctrl+Shift+Z)', '↷', onRedo);
    const header = h('div', { class: 'shd' },
        h('span', { class: 'ttl' }, h('b', 'Pack Studio'), subtitle),
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

    function setNav(parts, current) {
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
                    h('i', { 'aria-hidden': 'true' }, part.icon), part.name));
            }
            list.appendChild(h('div', { class: 'slist' }, items.map(part => h('button', { type: 'button', dataset: { part: part.id }, onClick: () => onPick(part.id) },
                h('i', { 'aria-hidden': 'true' }, part.icon), h('span', h('b', part.name), h('small', part.always ? part.desc : `${part.count} · ${part.desc}`)), h('span', '›')))));
        }
    }

    /** `{ title, desc, nodes, section, keep }`: `section` true shows the page on the phone (false shows the parts list); `keep` keeps the scroll. */
    function setPage({ title, desc = '', nodes = [], section = true, keep = false }) {
        const scroll = body.querySelector('.smain').scrollTop;
        clear(page);
        page.append(h('button', { type: 'button', class: 'btn2 sback', onClick: () => onBack() }, '‹ Parts'), h('div', h('h2', title), desc ? h('p', { class: 'sdesc' }, desc) : null), ...nodes.flat().filter(Boolean));
        body.setAttribute('data-page', section ? 'section' : 'list');
        body.querySelector('.smain').scrollTop = keep ? scroll : 0;
    }

    function setFooter(check) {
        footer.hidden = !check;
        if (!check) return;
        footer.dataset.ok = String(check.total === 0);
        const works = check.errors.length ? h('span', { class: 'fl3' }, 'Export is off until the problems are fixed')
            : (check.warnings.length ? h('span', { class: 'fl3' }, 'Export works; warnings are listed in Problems') : null);
        footer.replaceChildren(...[h('span', check.total ? '⚠ ' : '✓ ', ...label('Pack check', 'Check')), h('b', { class: 'v' }, footerText(check)), works, h('span', { style: { 'margin-left': 'auto' } }, '›')].filter(Boolean));
    }

    return {
        el,
        file,
        setSubtitle: text => { subtitle.textContent = text; },
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
