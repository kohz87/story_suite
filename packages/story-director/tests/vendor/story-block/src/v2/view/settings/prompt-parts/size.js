// Paints the Prompt card's size block: the sums, the meter, the per-module table, then "Show what's sent".

import { SETTINGS_TEXT } from '../../../host-ui.js';
import { contextNotice } from '../../../prompt.js';
import { fill } from '../../../strings.js';
import { el, num } from './shared-dom.js';
import { sentFold } from './sent.js';

/** Paints the size into `block`: the sums, the meter, the per-module table, then "Show what's sent". */
export function paintSize(doc, block, read, openState = null) {
    const T = SETTINGS_TEXT.size;
    const { size, exact, fit } = read;
    const amount = n => fill(exact ? T.exact : T.about, { n: num(n) });
    const list = el(doc, 'ul', 'story-suite-size-sum');
    const line = (label, value, className = '') => {
        const item = el(doc, 'li', className);
        item.append(el(doc, 'span', '', label), el(doc, 'b', 'story-suite-size-n', value));
        list.appendChild(item);
        return item;
    };
    // The context size and the share Story Suite may take of it (the notes' budget follows from it).
    if (fit) {
        line(T.context, fit.reply ? fill(T.contextReply, { n: num(fit.size), reply: num(fit.reply) }) : fill(T.contextValue, { n: num(fit.size) }), 'story-suite-size-context');
        const share = line(T.share, fill(T.shareValue, { share: num(fit.share), room: num(fit.room), percent: fit.percent }), 'story-suite-size-share');
        if (fit.tooSmall) share.classList.add('story-suite-size-over');
    }
    line(T.static, amount(size.static));
    const tail = line(T.tail, fill(T.ofBudget, { size: amount(size.tail), budget: num(size.budget) }), 'story-suite-size-tail');
    const meter = el(doc, 'meter', 'story-suite-size-meter');
    meter.min = 0;
    meter.max = size.budget;
    meter.value = Math.min(size.tail, size.budget);
    meter.setAttribute('aria-label', T.tail);
    tail.appendChild(meter);
    if (size.tail > size.budget) tail.classList.add('story-suite-size-over');
    // What modules send on their own (NPC State Delta's dossiers): a row each, counted in the total.
    for (const row of size.own ?? []) {
        const item = line(fill(T.own, { name: row.name }), amount(row.tokens), 'story-suite-size-own');
        item.dataset.module = row.id;
    }
    line(T.total, amount(size.total), 'story-suite-size-total');
    const table = el(doc, 'table', 'story-suite-size-table');
    table.appendChild(el(doc, 'caption', '', T.perModule));
    const head = el(doc, 'tr');
    for (const name of [T.module, T.staticShort, T.tailShort]) {
        const cell = el(doc, 'th', '', name);
        cell.setAttribute('scope', 'col');
        head.appendChild(cell);
    }
    const thead = el(doc, 'thead');
    thead.appendChild(head);
    const tbody = el(doc, 'tbody');
    for (const row of size.modules) {
        const tr = el(doc, 'tr');
        tr.dataset.module = row.id;
        const name = el(doc, 'th', '', row.name);
        name.setAttribute('scope', 'row');
        tr.append(name, el(doc, 'td', '', num(row.static)), el(doc, 'td', '', num(row.tail)));
        tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    block.dataset.exact = String(exact);
    const warn = fit?.tooSmall ? el(doc, 'p', 'story-suite-size-warn', contextNotice(fit)) : null;
    if (warn) warn.setAttribute('role', 'status');
    block.replaceChildren(...[
        el(doc, 'p', 'story-suite-muted', T.help),
        warn,
        list,
        table,
        fit ? null : el(doc, 'p', 'story-suite-muted story-suite-size-context-unknown', T.contextUnknown),
        el(doc, 'p', 'story-suite-muted story-suite-size-how', exact ? T.howExact : T.howAbout),
        sentFold(doc, { read }, openState),
    ].filter(Boolean));
}
