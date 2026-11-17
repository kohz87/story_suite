// The Inspector sheet: one reply at a time, what it changed, what code did and the state after; older and newer replies with ‹ ›. Read again at every move.
import { h } from '../kit/dom.js';
import { openSheet } from '../kit/sheet.js';

const MARK = { add: '+', remove: '−', change: '~' };

function replyBody(r) {
  if (!r) return h('p', { class: 'fine' }, 'No reply with a story record yet.');
  if (!r.ok) return h('p', { class: 'fine' }, r.message);
  const block = (title, ...rows) => h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, title), rows);
  const line = l => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', `${MARK[l.kind] ?? '~'} ${l.path}`), h('small', l.kind === 'add' ? `now ${l.after}` : l.kind === 'remove' ? `was ${l.before}` : `${l.before} → ${l.after}`)));
  return [
    block(r.lines.length ? `Changed · ${r.lines.length}${r.more ? ` (+${r.more} more)` : ''}` : 'Changed', r.lines.length ? r.lines.map(line) : h('p', { class: 'fine' }, 'This reply changed nothing in the state.')),
    block(`What code did · ${r.receipts.length}`, r.receipts.map(x => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', x.summary || x.type), h('small', [x.module, x.type].filter(Boolean).join(' · '))))), h('p', { class: 'fine' }, `${r.ops} stored ops`)),
    r.problems.length ? block('Problems', r.problems.map(p => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', p.message), h('small', p.code))))) : null,
    block('The state after', h('pre', { class: 'sent' }, r.state)),
  ];
}

/** Opens the sheet. `ctx` = { doc, backStack, view(name, args) } (the overlay's); `view('inspector', { index })` is asked again on each move, so the sheet never shows an older chat. */
export function openInspector(ctx) {
  let index = null;
  const sheet = openSheet(ctx, { title: 'Inspector', id: 'inspector' });
  const paint = () => {
    const vm = ctx.view?.('inspector', { index }) ?? { replies: [], index: null, reply: null };
    index = vm.index;
    const at = vm.replies.findIndex(r => r.index === vm.index);
    const go = to => { index = vm.replies[to]?.index ?? index; paint(); };
    const cur = vm.replies[at];
    const nav = h('div', { class: 'insp-nav' },
      h('button', { type: 'button', class: 'btn2', disabled: at >= vm.replies.length - 1 || at < 0, 'aria-label': 'Older reply', onClick: () => go(at + 1) }, '‹'),
      h('span', { class: 'lb' }, h('b', cur ? `Reply ${cur.index + 1}${cur.head ? ' · newest' : ''}` : 'No reply'), h('small', cur ? `${cur.name} · ${cur.snippet}` : '')),
      h('button', { type: 'button', class: 'btn2', disabled: at <= 0, 'aria-label': 'Newer reply', onClick: () => go(at - 1) }, '›'));
    sheet.body.replaceChildren(nav, ...[replyBody(vm.reply)].flat().filter(Boolean));
  };
  paint();
  return sheet;
}
