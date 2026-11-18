// The two panes of a record part (mock MK-2) and the page's own scrolling. An editor draws its list and its open record into a
// `.st-panes` box (studio/form/panes.js): a `.st-pane-list` and a `.st-pane-rec`, the box saying `data-open="true"` while a record is
// open, with `data-noun` and `data-icon` for the empty pane. A part may hold several such boxes (Places & routes: places, routes,
// regions, realms), so the shell joins them: everything the page holds (its title, a List · Map switch, every section's list) goes
// into one list side (`.st-wlist`) and the open record pane into one record side (`.st-wrec`), inside a `.st-wide` box. At 1280 px and
// wider (studio/studio.css) the two sides sit next to each other under the nav, each scrolling on its own; below that the page shows
// the list side, or the record side while a record is open. With no record open the record side holds the "No <noun> open" pane.
//
// Scrolling never moves the nav: a record or a field is brought into view by its own scrolling box (a side, or the page), not by
// scrollIntoView, which also scrolls the frame around it.

import { h } from '../ui/kit/dom.js';

const owners = new WeakMap(); // a record pane moved into the record side → the section box it came from
const NEW = '[data-act="new"], .st-new, .st-add';

// The record side with no record open: what it is for, and the list's own New button again.
function emptyPane(box, list) {
    const add = list.querySelector(NEW);
    const noun = box?.dataset.noun || 'record';
    return h('div', { class: 'st-pane-empty', role: 'note' }, h('i', { 'aria-hidden': 'true' }, box?.dataset.icon || '◇'), h('b', `No ${noun} open`),
        h('small', add ? 'Pick one in the list, or make a new one.' : 'Pick one in the list.'),
        add ? h('button', { type: 'button', class: 'btn2 pri st-pane-new', onClick: () => add.click() }, add.textContent.replace(/^\+\s*/, '')) : null);
}

const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };

/**
 * Fits the page to the panes; running it again changes nothing. The body says whether the page has them (`data-panes`). The open
 * record's row in the list is marked `aria-current="true"`.
 */
export function fitPanes(body, page) {
    const boxes = [...page.querySelectorAll('.st-panes')];
    setAttr(body, 'data-panes', String(boxes.length > 0));
    if (!boxes.length) return;
    let wide = page.querySelector(':scope > .st-wide');
    if (!wide) {
        const side = h('div', { class: 'st-wlist' });
        side.append(...page.childNodes);
        wide = h('div', { class: 'st-wide' }, side, h('div', { class: 'st-wrec' }));
        page.append(wide);
    }
    const list = wide.querySelector(':scope > .st-wlist'), rec = wide.querySelector(':scope > .st-wrec');
    for (const pane of [...rec.querySelectorAll(':scope > .st-pane-rec')]) {
        const box = owners.get(pane);
        if (!box?.isConnected || box.dataset.open !== 'true' || box.querySelector(':scope > .st-pane-rec')) pane.remove(); // closed, or drawn again
    }
    for (const box of boxes) {
        const pane = box.querySelector(':scope > .st-pane-rec');
        if (pane && box.dataset.open === 'true') { owners.set(pane, box); rec.append(pane); }
    }
    const open = rec.querySelector(':scope > .st-pane-rec');
    const empty = rec.querySelector(':scope > .st-pane-empty');
    if (open && empty) empty.remove();
    if (!open && !empty) rec.append(emptyPane(boxes[0], list));
    setAttr(wide, 'data-open', String(Boolean(open)));
    const key = open?.querySelector('[data-rec]')?.dataset.rec ?? null;
    for (const row of list.querySelectorAll('.st-pane-list [data-rec]')) { // an editor's own list rows (not a kinds table's links)
        const mark = row.tagName === 'BUTTON' && row.dataset.rec === key;
        if (mark) setAttr(row, 'aria-current', 'true');
        else if (row.getAttribute('aria-current') === 'true') row.removeAttribute('aria-current');
    }
}

// The box that scrolls `el`: the nearest side or page box that can scroll, else the page.
function scrollerOf(el) {
    for (let up = el.parentElement; up; up = up.parentElement) {
        if (up.matches('.st-wlist, .st-wrec, .smain')) {
            const style = getComputedStyle(up);
            if (up.classList.contains('smain') || (/(auto|scroll)/.test(style.overflowY) && up.scrollHeight > up.clientHeight)) return up;
        }
    }
    return null;
}

/** Brings `el` into view in its own scrolling box only: `block` 'start' puts it at the top, 'nearest' scrolls only if it is out of view. */
export function reveal(el, block = 'start') {
    const box = el?.getClientRects().length ? scrollerOf(el) : null; // a hidden element (the list below 1280 px) has no place to show
    if (!box) return;
    const at = el.getBoundingClientRect(), view = box.getBoundingClientRect();
    if (block === 'nearest') {
        if (at.top < view.top) box.scrollTop -= view.top - at.top + 8;
        else if (at.bottom > view.bottom) box.scrollTop += Math.min(at.bottom - view.bottom + 8, at.top - view.top - 8);
        return;
    }
    box.scrollTop += at.top - view.top - 8;
}

/** The page's scroll before it is drawn again: the page box's, and each side's (with the record open in it). `restore(...)` puts back what `keep` says. */
export function scrollOf(main, page) {
    const wide = page.querySelector(':scope > .st-wide');
    const side = name => wide?.querySelector(`:scope > .st-w${name}`)?.scrollTop ?? 0;
    return { main: main.scrollTop, list: side('list'), rec: side('rec'), open: wide?.querySelector('.st-wrec [data-rec]')?.dataset.rec ?? null };
}

/** `keep`: true (a redraw: everything, the record side when the same record is open), 'list' (the list side only), or false. */
export function restoreScroll(main, page, was, keep) {
    main.scrollTop = keep === true ? was.main : 0;
    const wide = page.querySelector(':scope > .st-wide');
    if (!wide || !keep) return;
    wide.querySelector(':scope > .st-wlist').scrollTop = was.list;
    const open = wide.querySelector('.st-wrec [data-rec]')?.dataset.rec ?? null;
    if (keep === true && open === was.open) wide.querySelector(':scope > .st-wrec').scrollTop = was.rec;
}
