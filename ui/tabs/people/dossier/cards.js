// Lists a dossier's parts and builds the summary cards column (With you, Mood, Right now, Ties | Past, Secrets, Profile; the dead get Death first), the open part's card outlined.
import { h } from '../../../kit/dom.js';
import { FEELING_KEYS } from '../../../kit/ring.js';
import { moodMeters } from './mood-meters.js';
import { tieDisc } from './tie-disc.js';
import { deathCard } from './death.js';
import { replyWhen } from './reply-words.js';

const lower = text => (text ? text[0].toLowerCase() + text.slice(1) : '');
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : '');
// (the mock's title colours: With in green, Mood and Right now in amber, Ties and Past in violet, Secrets in gold, Profile and Death muted)
const TONE = { with: 'g', mood: 'o', now: 'o', ties: 'pu', past: 'pu', secrets: 'go' };

// Right now has nothing to say: no place, doing, wearing, thought or scene for someone here; no last place, last seen or word for someone away (F14).
const nowEmpty = (d) => {
  const now = d.now ?? {};
  const facts = Object.hasOwn(now, 'where') ? [now.where, now.doing, now.wearing, now.thought] : [now.lastPlace, now.lastSeen, now.said];
  return !facts.some(Boolean) && !d.scene;
};

/** Lists the parts a dossier has: the living get With, Mood, Right now, Ties, Past, Secrets, Profile; the dead get Death, Ties, Past, Secrets, Profile. Empty Secrets and Right now are left out; the living always get Mood and Ties (an empty line until there is one), so Ties | Past keep their pair. */
export function dossierPages(d, youName = 'you') {
  const dead = d.life !== 'alive';
  const all = dead
    ? [['death', 'Death'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']]
    : [['with', `With ${youName}`], ['mood', 'Mood'], ['now', 'Right now'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']];
  const skip = { ties: dead && !d.ties?.length, secrets: !d.secrets?.total, now: nowEmpty(d) };
  return all.filter(([id]) => !skip[id]).map(([id, title]) => ({ id, title }));
}

/** The Mood card's "since" line from the newest mood change: "since reply #5: the reason", the date when the reply is unknown, no reason when none was recorded (never invented). Null without a history. */
export function moodSince(d) {
  const last = d.moodChanges?.[0];
  if (!last) return null;
  const when = last.reply !== null && last.reply !== undefined ? `reply #${last.reply}` : last.date;
  if (!when) return last.why ? `last change: ${last.why}` : null;
  return last.why ? `since ${when}: ${last.why}` : `since ${when}${last.reply !== null && last.reply !== undefined && last.date ? `, ${last.date}` : ''}`;
}

function summary(d, id) {
  const now = d.now ?? {};
  if (id === 'death') return deathCard(d);
  if (id === 'with') {
    // (a change the day's allowance held back moved nothing, so it is not "the last change")
    const c = d.changes?.find(change => !change.heldBack);
    if (!c) return h('span', { class: 'fine' }, 'Nothing yet');
    const when = replyWhen(c.reply, c.date);
    return h('span', { class: 'lc' }, h('b', { class: `f${Math.max(0, FEELING_KEYS.indexOf(c.meter))}` }, `${cap(c.meter)} ${c.delta > 0 ? '+' : ''}${c.delta}`), ` · ${c.why}`,
      when ? h('span', { class: 'fine' }, ` · ${when}`) : null);
  }
  if (id === 'mood') {
    if (!d.mood) return h('span', { class: 'fine' }, 'Not read yet');
    const since = moodSince(d);
    return [h('span', { class: 'mw' }, cap(d.mood)), moodMeters(d.moodBars), since ? h('span', { class: 'fine', dataset: { since: 'mood' } }, since) : null];
  }
  if (id === 'now') {
    const here = Object.hasOwn(now, 'where');
    // (a person with only a wearing or a thought still gets a line, and one with only a said word too)
    const line = here ? [now.where, lower(now.doing), now.wearing && `wearing ${lower(now.wearing)}`, now.thought && `“${now.thought}”`].filter(Boolean).join(' · ') : [now.lastPlace, now.lastSeen && `last seen ${now.lastSeen}`, now.said].filter(Boolean).join(' · ');
    return [h('span', { class: 'lc' }, line || (here ? 'Here, nothing noted yet' : 'Not known')), d.scene ? h('span', { class: 'fine' }, 'This scene: wants and hiding · spoiler') : null];
  }
  if (id === 'ties' && !d.ties?.length) return h('span', { class: 'fine' }, 'No ties yet');
  if (id === 'ties') return [h('span', { class: 'avs' }, d.ties.map(t => tieDisc(t, 'a'))), h('span', { class: 'fine lc2' }, d.ties.map(t => t.name).join(', '))];
  if (id === 'past') {
    const dots = (d.past ?? []).flatMap((_, i) => (i ? [h('b'), h('i')] : [h('i')]));
    const m = d.past?.[0];
    const line = m ? [m.date, m.reply !== undefined ? `reply #${m.reply}` : null, m.text].filter(Boolean).join(' · ') : 'No memories yet';
    return [h('span', { class: 'dots' }, dots), h('span', { class: 'fine lc2' }, line)];
  }
  if (id === 'secrets') {
    const { opened, total, items } = d.secrets;
    const next = items.find(s => !s.open);
    return h('span', { class: 'secrow' }, h('span', { class: 'sring', style: { '--p': total ? (opened / total) * 100 : 0 } }, `${opened}/${total}`),
      h('span', { class: 'lc sm' }, next ? `the next ${lower(next.rule ?? 'opens with the story')}` : 'all opened'));
  }
  const likes = d.profile?.likes?.length ? `Likes ${d.profile.likes.join(', ')}` : null;
  return h('span', { class: 'lc sm' }, [d.profile?.personality, likes].filter(Boolean).join(' · '));
}

/**
 * Builds the cards column for dossier `d` and its `pages`: each card opens its part through `onOpen(id)`; the card of the open part (`current`) is outlined.
 * The With card's title is "With <you> · last change"; Ties and Past carry their counts.
 */
export function dossierCards(d, pages, { current = null, onOpen } = {}) {
  const byId = Object.fromEntries(pages.map(p => [p.id, p]));
  const title = id => (id === 'past' ? `Past · ${(d.past ?? []).length}` : id === 'ties' && d.ties?.length ? `Ties · ${d.ties.length}` : id === 'with' ? `${byId.with.title} · last change` : byId[id].title);
  const card = id => (byId[id] ? h('button', {
    type: 'button', class: ['dcard', 'glass', current === id ? 'sel' : null], 'aria-current': current === id ? 'true' : null, dataset: { page: id }, onClick: () => onOpen?.(id),
  }, h('span', { class: ['dl', TONE[id] ?? null] }, h('span', null, title(id)), h('i', null, '›')), summary(d, id)) : null);
  // (Ties and Past sit side by side; one alone fills the row instead of taking half of it)
  const pair = (...two) => (two.every(Boolean) ? h('div', { class: 'dpair' }, ...two) : two.find(Boolean) ?? null);
  return h('div', { class: 'dcards' }, [card('death'), card('with'), card('mood'), card('now'), pair(card('ties'), card('past')), card('secrets'), card('profile')].filter(Boolean));
}
