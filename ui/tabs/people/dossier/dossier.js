// Composes one person's dossier: top bar with ⋯ menu, hero, the summary cards, and the paged detail views, with Escape through the back-stack.
import { h } from '../../../kit/dom.js';
import { FEELING_KEYS } from '../../../kit/ring.js';
import { button } from '../../../kit/controls.js';
import { pager, pageSection } from '../../../kit/page.js';
import { feelingsHero, withPage } from './feelings.js';
import { nowPage, moodPage } from './now-page.js';
import { tiesPage, pastPage, secretsPage } from './past-secrets.js';
import { moodMeters } from './mood-meters.js';
import { tieDisc } from './tie-disc.js';
import { profilePage } from './profile.js';
import { deathPage, deathCard } from './death.js';
import { partyAddButton } from './party-add.js';
import { can } from '../../../runtime/can.js';
import { sendFollow } from './follow.js';
import { tabTrap } from '../../../kit/trap.js';
import { watchWide } from './wide-watch.js';

const MENU = Object.freeze([
  ['refresh', 'Refresh', 're-read the recent story for them'], ['portrait', 'Portrait', 'view, upload or generate'],
  ['inspect', 'Inspector', 'this person’s records'], ['merge', 'Merge', 'fold a duplicate into this person'], ['delete', 'Delete', 'remove this person and their records'],
]);
const lower = text => (text ? text[0].toLowerCase() + text.slice(1) : '');

// Right now has nothing to say: no place, doing, wearing, thought or scene for someone here; no last place, last seen or word for someone away (F14).
const nowEmpty = (d) => {
  const now = d.now ?? {};
  const facts = Object.hasOwn(now, 'where') ? [now.where, now.doing, now.wearing, now.thought] : [now.lastPlace, now.lastSeen, now.said];
  return !facts.some(Boolean) && !d.scene;
};

/** Lists the pages a dossier has: the living get With, Mood, Right now, Ties, Past, Secrets, Profile; the dead get Death, Ties, Past, Secrets, Profile. Empty Secrets and Right now are left out; the living always get Mood and Ties (an empty line until there is one), so the cards keep the mock's two columns. */
export function dossierPages(d, youName = 'you') {
  const dead = d.life !== 'alive';
  const all = dead
    ? [['death', 'Death'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']]
    : [['with', `With ${youName}`], ['mood', 'Mood'], ['now', 'Right now'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']];
  const skip = { ties: dead && !d.ties?.length, secrets: !d.secrets?.total, now: nowEmpty(d) };
  return all.filter(([id]) => !skip[id]).map(([id, title]) => ({ id, title }));
}

function summary(d, id) {
  const now = d.now ?? {};
  if (id === 'death') return deathCard(d);
  if (id === 'with') {
    // (a change the day's allowance held back moved nothing, so it is not "the last change")
    const c = d.changes?.find(change => !change.heldBack);
    return c ? h('span', { class: 'lc' }, h('b', { class: `f${Math.max(0, FEELING_KEYS.indexOf(c.meter))}` }, `${c.meter[0].toUpperCase()}${c.meter.slice(1)} ${c.delta > 0 ? '+' : ''}${c.delta}`), ` · ${c.why}`) : h('span', { class: 'fine' }, 'Nothing yet');
  }
  if (id === 'mood') return d.mood ? [h('span', { class: 'mw' }, d.mood), moodMeters(d.moodBars)] : h('span', { class: 'fine' }, 'Not read yet');
  if (id === 'now') {
    const here = Object.hasOwn(now, 'where');
    // (a person with only a wearing or a thought still gets a line, and one with only a said word too)
    const line = here ? [now.where, lower(now.doing), now.wearing && `wearing ${lower(now.wearing)}`, now.thought && `“${now.thought}”`].filter(Boolean).join(' · ') : [now.lastPlace, now.lastSeen && `last seen ${now.lastSeen}`, now.said].filter(Boolean).join(' · ');
    return [h('span', { class: 'lc' }, line || (here ? 'Here, nothing noted yet' : 'Not known')), d.scene ? h('span', { class: 'hint' }, 'This scene: wants and hiding · spoiler') : null];
  }
  if (id === 'ties' && !d.ties?.length) return h('span', { class: 'fine' }, 'No ties yet');
  if (id === 'ties') return [h('span', { class: 'avs' }, d.ties.map(t => tieDisc(t, 'a'))), h('span', { class: 'lc sm' }, `${d.ties.length} · ${d.ties.map(t => t.name).join(', ')}`)];
  if (id === 'past') {
    const dots = (d.past ?? []).flatMap((_, i) => (i ? [h('b'), h('i')] : [h('i')]));
    return [h('span', { class: 'dots' }, dots), h('span', { class: 'lc sm' }, d.past?.[0]?.text ?? 'No memories yet')];
  }
  if (id === 'secrets') {
    const { opened, total, items } = d.secrets;
    const next = items.find(s => !s.open);
    return h('span', { class: 'secrow' }, h('span', { class: 'sring', style: { '--p': total ? (opened / total) * 100 : 0 } }, `${opened}/${total}`),
      h('span', { class: 'lc' }, next ? `next: ${lower(next.rule)}` : 'all opened'));
  }
  const likes = d.profile?.likes?.length ? `Likes ${d.profile.likes.join(', ')}` : null;
  return h('span', { class: 'lc sm' }, [d.profile?.personality, likes].filter(Boolean).join(' · '));
}

const BODIES = { death: deathPage, with: withPage, mood: moodPage, now: nowPage, ties: tiesPage, past: pastPage, secrets: secretsPage, profile: profilePage };

/**
 * Builds the dossier for a `dossier` view-model. ctx = { port, prefs, backStack, go(tab, args), onClose(), seeOnMap(id), origin, youName }.
 * Commands: people.follow (the store's Follow flag; the star goes back if the engine refuses), npc.edit (opens NPC State's editor), npc.refresh, npc.portrait, npc.inspect, npc.merge, npc.delete (asks twice; the dossier closes once they are gone), npc.markAlive, npc.memory.add.
 * Returns the root element; `root.close()` takes the dossier down from the back-stack too.
 */
export function dossierPage(first, ctx = {}) {
  let d = first;
  const state = { page: null, menu: false, sure: false, following: Boolean(d.following) };
  const cmd = (type, extra = {}) => ctx.port?.command?.(type, { personId: d.id, ...extra });
  let pages = dossierPages(d, ctx.youName);
  let dead = d.life !== 'alive';
  const releases = { dossier: null, page: null, menu: null };
  const release = (key) => { releases[key]?.(); releases[key] = null; };
  const hold = (key, layer, close) => { release(key); releases[key] = ctx.backStack?.push({ id: `dossier-${d.id}-${key}`, layer, close }) ?? null; };

  const top = h('section', { class: 'glass dtop' });
  const menuSlot = h('div', { class: 'menu-slot' });
  const noteSlot = h('div', { class: 'fine dnote', role: 'status', 'aria-live': 'polite' });
  const grid = h('div', { class: 'dgrid' });
  // (it covers the tabs, so it is modal: Tab stays inside it until it closes)
  const root = h('div', { class: 'dossier dov', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${d.name}’s dossier`, dataset: { personId: d.id } },
    h('div', { class: 'dscroll' }, top, menuSlot, noteSlot, grid));
  let shut = false;
  root.addEventListener('keydown', tabTrap(root, { isOn: () => !shut }));
  // (on a wide window Mood and Right now sit side by side)
  const unplace = watchWide(root);

  function closeMenu() { release('menu'); state.menu = false; state.sure = false; drawMenu(); }
  function openPage(id) {
    state.page = id;
    hold('page', 'page', () => { state.page = null; drawGrid(); });
    drawGrid();
  }
  function closePage() { release('page'); state.page = null; drawGrid(); }
  function close() { shut = true; unplace(); release('menu'); release('page'); release('dossier'); ctx.onClose?.(); }
  root.close = close;
  // The person changed while the page is open (a reply, an Edit save): the same page is drawn again from the fresh record.
  root.update = (next) => {
    if (!next || shut) return;
    d = next;
    pages = dossierPages(d, ctx.youName);
    dead = d.life !== 'alive';
    state.following = Boolean(d.following);
    if (!pages.some(p => p.id === state.page)) { release('page'); state.page = null; }
    drawGrid();
  };

  // Refresh runs a model call: the line under the top bar says it is going and then what came of it (the answer's own words).
  function refresh() {
    noteSlot.textContent = `Re-reading the recent story for ${d.name}…`;
    Promise.resolve(cmd('npc.refresh', { name: d.name })).then(
      (result) => { noteSlot.textContent = result?.ok === false ? (result.message ?? 'Refresh did not run.') : (result?.message ?? `Refresh sent for ${d.name}.`); },
      (error) => { noteSlot.textContent = String(error?.message || 'Refresh did not run.'); });
  }

  // Portrait opens a page dialog; a refusal (NPC State off, no NPC State dossier for this person) is shown in the same line as Refresh's.
  function portrait() {
    Promise.resolve(cmd('npc.portrait', { name: d.name })).then(
      (result) => { if (result?.ok === false) noteSlot.textContent = result.message ?? 'Portrait tools did not open.'; },
      (error) => { noteSlot.textContent = String(error?.message || 'Portrait tools did not open.'); });
  }

  // Edit, Delete, Merge and the like: what the engine answers is told under the top bar when it refuses; a deleted person takes the dossier down with them.
  function act(type) {
    Promise.resolve(cmd(type)).then(
      (result) => { if (result?.ok === false) noteSlot.textContent = result.message ?? 'That did not work.'; else if (type === 'npc.delete') close(); },
      (error) => { noteSlot.textContent = String(error?.message || 'That did not work.'); });
  }

  function drawMenu() {
    top.querySelector('[data-act="menu"]')?.setAttribute('aria-expanded', String(state.menu));
    if (!state.menu) { menuSlot.replaceChildren(); return; }
    menuSlot.replaceChildren(h('div', { class: 'menu glass', role: 'menu' }, MENU.filter(([id]) => can(ctx, `npc.${id}`)).map(([id, label, hint]) => {
      const confirm = id === 'delete' && state.sure;
      return h('button', {
        type: 'button', role: 'menuitem', class: id === 'delete' ? 'dng' : null, dataset: { act: id },
        onClick: () => {
          if (id === 'delete' && !state.sure) { state.sure = true; drawMenu(); return; }
          if (id === 'refresh') refresh(); else if (id === 'portrait') portrait(); else act(`npc.${id}`);
          closeMenu();
        },
      }, confirm ? 'Tap again to delete' : label, h('small', null, confirm ? 'this cannot be undone' : hint));
    })));
  }

  function drawTop() {
    // (a control nobody answers is left out, not drawn as the text "null")
    top.replaceChildren(...[
      button({ label: ctx.origin ?? '‹ People', className: 'bk2', dataset: { act: 'close' }, onClick: close }),
      h('span', { class: 'sp' }),
      can(ctx, 'npc.edit') ? button({ label: 'Edit', dataset: { act: 'edit' }, onClick: () => act('npc.edit') }) : null,
      !MENU.some(([id]) => can(ctx, `npc.${id}`)) ? null : h('button', { type: 'button', class: 'ibtn', 'aria-label': 'More', 'aria-expanded': 'false', dataset: { act: 'menu' },
        onClick: () => { if (state.menu) { closeMenu(); return; } state.menu = true; hold('menu', 'menu', () => { state.menu = false; state.sure = false; drawMenu(); }); drawMenu(); } }, '⋯')].filter(Boolean));
  }

  function hero() {
    const follow = button({ label: state.following ? '★ Following' : '☆ Follow', className: 'fbtn', pressed: state.following, dataset: { act: 'follow' },
      onClick: () => {
        const on = !state.following;
        state.following = on;
        Promise.resolve(sendFollow(ctx, d, on)).then(result => { if (result?.ok === false && state.following === on) { state.following = !on; drawGrid(); } });
        drawGrid();
      } });
    const where = dead ? (d.death?.where ?? '') : (d.now?.where ?? d.now?.lastPlace ?? '');
    return h('section', { class: 'glass dhero' },
      feelingsHero(d, { onProfile: () => openPage('profile') }),
      h('div', { class: 'dname' }, d.name),
      h('div', { class: 'chips dchips' }, dead
        ? h('span', { class: ['deadb', d.life === 'presumed' ? 'pres' : null] }, d.life === 'presumed' ? 'Presumed dead' : 'Deceased')
        : follow),
      h('div', { class: 'idl' }, d.idLine, d.genderUnknown ? h('span', { class: 'gflag' }, `${d.idLine ? ' · ' : ''}gender not stated`) : null),
      h('div', { class: 'idl' }, [dead ? where : (d.now && Object.hasOwn(d.now, 'where') ? 'Here' : where), d.inParty ? 'in your party' : null].filter(Boolean).join(' · ')),
      dead ? null : partyAddButton(d, { ...ctx, onAdded: () => { d.partyAdd = null; d.inParty = true; drawGrid(); },
        onEdited: () => { const fresh = ctx.port?.view?.('dossier')?.[d.id]; if (fresh) { d.partyAdd = fresh.partyAdd ?? null; d.inParty = fresh.inParty; } drawGrid(); } }),
      dead ? null : button({ label: 'See on map', dataset: { act: 'map' }, onClick: () => { if (ctx.seeOnMap) ctx.seeOnMap(d.id); else cmd('people.focus'); } }));
  }

  const card = (id, title, body) => h('button', { type: 'button', class: 'dcard glass', dataset: { page: id }, onClick: () => openPage(id) },
    h('span', { class: 'dl' }, title, h('i', null, '›')), body);

  function cards() {
    const byId = Object.fromEntries(pages.map(p => [p.id, p]));
    const title = id => (id === 'past' ? `Past · ${(d.past ?? []).length}` : id === 'with' ? `${byId.with.title} · last change` : byId[id].title);
    // (Ties and Past sit side by side; one alone fills the row instead of taking half of it)
    const pair = (...two) => (two.every(Boolean) ? h('div', { class: 'dpair' }, ...two) : two.find(Boolean) ?? null);
    const make = id => (byId[id] ? card(id, title(id), summary(d, id)) : null);
    return [make('death'), make('with'), make('mood'), make('now'), pair(make('ties'), make('past')), make('secrets'), make('profile')].filter(Boolean);
  }

  function drawGrid() {
    const open = pages.find(p => p.id === state.page);
    grid.classList.toggle('paged', Boolean(open));
    const right = open
      ? h('section', { class: 'glass dpane', dataset: { page: open.id } },
        pager({ pages, current: open.id, backLabel: '‹ Dossier', onBack: closePage, onGo: openPage }),
        pageSection(null, [BODIES[open.id](d, ctx)].flat().filter(Boolean)))
      : h('div', { class: 'dright' }, cards());
    grid.replaceChildren(hero(), right);
  }

  drawTop();
  drawGrid();
  hold('dossier', 'page', () => { shut = true; unplace(); release('menu'); release('page'); ctx.onClose?.(); });
  return root;
}
