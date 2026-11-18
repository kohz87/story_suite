// The Overview page: the pack's name, id, version and what it needs, the check result in one line, and how many records each part holds.

import { h } from '../../ui/kit/dom.js';
import { fieldRow } from './value.js';

const said = check => (check.ok
    ? (check.warnings.length ? `The pack checker takes this pack, with ${check.warnings.length} warning${check.warnings.length === 1 ? '' : 's'}.` : 'The pack checker takes this pack.')
    : `The pack checker refuses this pack: ${check.errors.length} problem${check.errors.length === 1 ? '' : 's'}.`);

/** `ctx`: `{ doc, parts, check, name, portraits, parseError, onGo(partId) }`. */
export function renderOverview(ctx) {
    const { doc, parts, check } = ctx;
    if (!doc) {
        return [h('section', { class: 'sgrp' }, h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', `${ctx.name} is not JSON`), h('small', ctx.parseError ?? ''))))];
    }
    const top = parts.find(part => part.id === 'overview').top.filter(key => doc[key] !== undefined);
    const rows = parts.filter(part => !part.always);
    return [
        h('section', { class: 'sgrp st-check', dataset: { ok: String(check.ok) } },
            h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', said(check)), h('small', `Opened from ${ctx.name}${ctx.portraits.length ? ` with ${ctx.portraits.length} portrait${ctx.portraits.length === 1 ? '' : 's'}` : ''}.`)))),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Pack'),
            top.map(key => fieldRow(key, doc[key]))),
        rows.length ? h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Parts'),
            rows.map(part => h('div', { class: 'srow' },
                h('div', { class: 'lb' }, h('b', part.name), h('small', part.sections.map(section => `${section.key} ${section.count}`).join(' · '))),
                h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'lnk', onClick: () => ctx.onGo(part.id) }, 'Open ›'))))) : null,
    ];
}
