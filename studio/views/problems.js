// The Problems page: what packs/validate.js said about the pack, grouped by Studio part, each with Go to (the part and the record).

import { h } from '../../ui/kit/dom.js';
import { PARTS } from '../parts.js';

/** `ctx`: `{ check, onGo(partId, rec) }`. */
export function renderProblems(ctx) {
    const { check } = ctx;
    if (check.total === 0) return [h('section', { class: 'sgrp' }, h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', 'No problems'), h('small', 'The pack checker takes this pack as it is.'))))];
    return PARTS.filter(part => check.byPart[part.id]?.length).map(part => h('section', { class: 'sgrp st-probs', dataset: { part: part.id } },
        h('div', { class: 'gt' }, `${part.name} · ${check.byPart[part.id].length}`),
        check.byPart[part.id].map(problem => h('div', { class: 'srow st-prob', dataset: { level: problem.level } },
            h('div', { class: 'lb' }, h('b', problem.message), h('small', [problem.level === 'warning' ? 'Warning' : 'Problem', problem.code, problem.path].filter(Boolean).join(' · '))),
            h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'lnk', onClick: () => ctx.onGo(problem.part, problem.rec) }, 'Go to ›'))))));
}
