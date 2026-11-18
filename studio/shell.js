// The Studio's frame in the Settings overlay's look (mock v7 decision 33, ui/css/settings.css): header with Open, Export and the
// theme switch; the parts as a side nav (tablet and up) or a phone list; one page; the pack-check bar at the foot.

import { h, clear } from '../ui/kit/dom.js';

const GROUPS = ['Pack', 'World', 'Check'];

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

/**
 * Builds the frame in `host`. Handlers: `onOpen(files)`, `onExportZip()`, `onExportJson()`, `onTheme()`, `onPick(partId)`,
 * `onQuery(text)`, `onBack()`, `onProblems()`. Returns `{ el, file, setSubtitle, setNav, setPage, setFooter, showList, setNotice, setExport, setQuery, focusSearch }`.
 */
export function createShell({ host, onOpen, onExportZip, onExportJson, onTheme, onPick, onQuery, onBack, onProblems }) {
    const file = h('input', { type: 'file', class: 'st-file', hidden: true, multiple: true, accept: '.zip,.json,application/json,application/zip,image/webp,image/png,image/jpeg', 'aria-label': 'Pack file' });
    file.addEventListener('change', () => { const picked = [...file.files]; file.value = ''; if (picked.length) onOpen(picked); });
    const subtitle = h('small', 'No pack open');
    const exportZip = h('button', { type: 'button', class: 'btn2 st-zip', disabled: true, onClick: () => onExportZip() }, label('Export zip', 'Zip'));
    const exportJson = h('button', { type: 'button', class: 'btn2 st-json-out', disabled: true, onClick: () => onExportJson() }, label('pack.json', 'JSON'));
    const header = h('div', { class: 'shd' },
        h('span', { class: 'ttl' }, h('b', 'Pack Studio'), subtitle),
        h('span', { class: 'st-acts' },
            h('button', { type: 'button', class: 'btn2 pri st-open', onClick: () => file.click() }, 'Open'),
            exportZip, exportJson,
            h('button', { type: 'button', class: 'ibtn x st-theme', 'aria-label': 'Switch dark or light', onClick: () => onTheme() }, '◐')),
        file);
    const sideSearch = searchBox(onQuery);
    const listSearch = searchBox(onQuery);
    const side = h('nav', { class: 'snav', 'aria-label': 'Pack parts' });
    const list = h('div', { class: 'phonelist' });
    const page = h('div', { class: 'spage' });
    const notice = h('p', { class: 'fine st-note', role: 'status', 'aria-live': 'polite', hidden: true });
    const body = h('div', { class: 'sbody', dataset: { page: 'list' } }, side, h('div', { class: 'smain' }, notice, list, page));
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

    /** `{ title, desc, nodes, section }`: `section` true shows the page on the phone (false shows the parts list). */
    function setPage({ title, desc = '', nodes = [], section = true }) {
        clear(page);
        page.append(h('button', { type: 'button', class: 'btn2 sback', onClick: () => onBack() }, '‹ Parts'), h('div', h('h2', title), desc ? h('p', { class: 'sdesc' }, desc) : null), ...nodes.flat().filter(Boolean));
        body.setAttribute('data-page', section ? 'section' : 'list');
        body.querySelector('.smain').scrollTop = 0;
    }

    function setFooter(check) {
        footer.hidden = !check;
        if (!check) return;
        footer.dataset.ok = String(check.total === 0);
        footer.replaceChildren(h('span', check.total ? '⚠ ' : '✓ ', ...label('Pack check', 'Check')), h('b', { class: 'v' }, footerText(check)), h('span', { style: { 'margin-left': 'auto' } }, '›'));
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
        setExport: enabled => { exportZip.disabled = !enabled; exportJson.disabled = !enabled; },
        setQuery: text => { for (const box of [sideSearch, listSearch]) if (box.value !== text) box.value = text; },
        focusSearch: () => {
            const phone = side.offsetParent === null; // the side nav is hidden under 601 px
            if (phone) body.setAttribute('data-page', 'list');
            (phone ? listSearch : sideSearch).focus();
        },
    };
}
