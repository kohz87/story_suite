// The Overview page of the active pack: the cards mounted at its top (the format 3 card), the check result in one line, the pack's
// own fields (drawn by the Overview editor slot), how many records each part holds, and the other open pack with a way over to it.

import { h } from '../../ui/kit/dom.js';

const said = check => (check.ok
    ? (check.warnings.length ? `The pack checker takes this pack, with ${check.warnings.length} warning${check.warnings.length === 1 ? '' : 's'}.` : 'The pack checker takes this pack.')
    : `The pack checker refuses this pack: ${check.errors.length} problem${check.errors.length === 1 ? '' : 's'}.`);
const KIND = { world: 'World pack', game: 'Game pack' };

/**
 * `ctx`: `{ doc, parts, check, name, fresh, portraits, parseError, onGo(partId), cards: [nodes], fields: [nodes],
 * other: { kind, title } | null, onSwitch() }`. `parts` are the active pack's; `fresh`: made in the Studio, not exported yet.
 */
export function renderOverview(ctx) {
    const { doc, parts, check } = ctx;
    if (!doc) {
        return [h('section', { class: 'sgrp' }, h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', `${ctx.name} is not JSON`), h('small', ctx.parseError ?? ''))))];
    }
    const rows = parts.filter(part => !part.always);
    return [
        ...(ctx.cards ?? []),
        h('section', { class: 'sgrp st-check', dataset: { ok: String(check.ok) } },
            h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', said(check)), h('small', ctx.fresh ? 'New in the Studio, not exported yet.' : `Opened from ${ctx.name}${ctx.portraits.length ? ` with ${ctx.portraits.length} portrait${ctx.portraits.length === 1 ? '' : 's'}` : ''}.`)))),
        h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Pack'), ctx.fields ?? []),
        rows.length ? h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Parts'),
            rows.map(part => h('div', { class: 'srow' },
                h('div', { class: 'lb' }, h('b', part.name), h('small', part.sections.every(section => section.absent) ? 'Nothing yet' : part.sections.filter(section => !section.absent).map(section => `${section.key} ${section.count}`).join(' · '))),
                h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'lnk', onClick: () => ctx.onGo(part.id) }, 'Open ›'))))) : null,
        ctx.other ? h('section', { class: 'sgrp st-other', dataset: { kind: ctx.other.kind } }, h('div', { class: 'gt' }, 'Also open'),
            h('div', { class: 'srow' },
                h('div', { class: 'lb' }, h('b', `${KIND[ctx.other.kind]} · ${ctx.other.title}`), h('small', `Its parts are under ${ctx.other.kind === 'game' ? 'Game' : 'World'}.`)),
                h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'lnk', onClick: () => ctx.onSwitch() }, 'Open ›')))) : null,
    ];
}
