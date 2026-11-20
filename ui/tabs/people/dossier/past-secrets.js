// Builds the Ties, Past and Secrets parts of a dossier (dated memories; opened secrets stay readable after a death; locked ones show only their rule).
import { h } from '../../../kit/dom.js';
import { glyph } from '../../../kit/glyphs.js';
import { button } from '../../../kit/controls.js';
import { tieDisc } from './tie-disc.js';
import { can } from '../../../runtime/can.js';
import { eventRow } from './reply-words.js';

/** Builds the Ties part: one row per known tie (portrait, name, its first part as the tag when it is a short word or two, the rest as a line; a sentence is all line); a tie with a person id opens that dossier through ctx.openPerson (else ctx.go). */
export function tiesPage(d, ctx = {}) {
  const ties = d.ties ?? [];
  if (!ties.length) return h('p', { class: 'fine' }, 'No ties known.');
  return h('div', { class: 'ties' }, ties.map((t) => {
    const [first, ...more] = String(t.line ?? '').split(' · ');
    // (a tag is a word or two, "friend", "owes · a debt"; a story sentence such as "Bluewatch's unordained sealer, whom she needs" is shown as the plain line: owner, 20 Nov)
    const short = first.length <= 24 && first.trim().split(/\s+/).length <= 3;
    const tag = short ? first : '', rest = short ? more : [first, ...more].filter(Boolean);
    const body = [tieDisc(t), h('span', { class: 'tt' }, h('b', null, t.name), tag ? h('em', null, tag) : null, rest.length ? h('small', null, rest.join(' · ')) : null)];
    return t.personId
      ? h('button', { type: 'button', class: 'tie', dataset: { personId: t.personId }, onClick: () => (ctx.openPerson ? ctx.openPerson(t.personId) : ctx.go?.('people', { personId: t.personId })) }, body, h('i', null, '›'))
      : h('div', { class: 'tie' }, body);
  }));
}

/** Builds the Past part: memories newest first, each with its story date and reply when NPC State stamped them (a Day › link when there is a day), and + Add a memory. */
export function pastPage(d, ctx = {}) {
  const past = d.past ?? [];
  return [
    past.length
      ? h('div', { class: 'evs' }, past.map(m => eventRow(m.reply, m.date, m.text,
        m.dayRef ? h('button', { type: 'button', class: 'lnk2 day', dataset: { day: m.dayRef }, onClick: () => ctx.go?.('journal', { day: m.dayRef }) }, 'Day ›') : null)))
      : h('p', { class: 'fine' }, 'No memories yet.'),
    can(ctx, 'npc.memory.add') ? button({ label: '+ Add a memory', className: 'add', onClick: () => ctx.port?.command?.('npc.memory.add', { personId: d.id }) }) : null,
  ];
}

// An opened secret: "✓ Opened · Trust 15" over its title and text; a locked one: "Locked" over the rule that opens it.
function secretRow(s) {
  const rule = String(s.rule ?? '');
  const head = s.open ? `✓ ${/^opened/i.test(rule) ? rule : ['Opened', rule].filter(Boolean).join(' · ')}` : 'Locked';
  return h('div', { class: ['sec', s.open ? 'open' : 'lock'], dataset: { open: String(Boolean(s.open)) } },
    h('p', { class: ['h', s.open ? 'op' : 'lk'] }, s.open ? null : h('span', { class: 'ic' }, glyph('key')), head),
    s.open ? h('p', null, [s.title, s.text].filter(Boolean).join('. ') || 'A secret') : h('p', null, rule || 'Opens with the story'));
}

/** Builds the Secrets part: each secret in its own box (a locked one shows only the rule that opens it), and a line on how they open. */
export function secretsPage(d) {
  const { opened = 0, total = 0, items = [] } = d.secrets ?? {};
  return [
    ...items.map(secretRow),
    h('p', { class: 'fine' }, `${opened} opened · ${Math.max(0, total - opened)} still hidden. Each appears here when it opens; an opened one stays readable after a death.`),
  ];
}
