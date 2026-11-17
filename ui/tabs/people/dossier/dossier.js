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

const MENU = Object.freeze([
  ['refresh', 'Refresh', 're-read the recent story for them'], ['portrait', 'Portrait', 'view, upload or generate'],
  ['inspect', 'Inspector', 'this person’s records'], ['merge', 'Merge', 'fold a duplicate into this person'], ['delete', 'Delete', 'remove this person and their records'],
]);
const lower = text => (text ? text[0].toLowerCase() + text.slice(1) : '');

/** Lists the pages a dossier has: the living get With, Mood, Right now, Ties, Past, Secrets, Profile; the dead get Death, Ties, Past, Secrets, Profile. Empty Ties, Secrets and Mood are left out. */
export function dossierPages(d, youName = 'you') {
  const dead = d.life !== 'alive';
  const all = dead
    ? [['death', 'Death'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']]
    : [['with', `With ${youName}`], ['mood', 'Mood'], ['now', 'Right now'], ['ties', 'Ties'], ['past', 'Past'], ['secrets', 'Secrets'], ['profile', 'Profile']];
  const skip = { ties: !d.ties?.length, secrets: !d.secrets?.total, mood: !d.mood };
  return all.filter(([id]) => !skip[id]).map(([id, title]) => ({ id, title }));
}

function summary(d, id) {
  const now = d.now ?? {};
  if (id === 'death') return deathCard(d);
  if (id === 'with') {
    const c = d.changes?.[0];
    return c ? h('span', { class: 'lc' }, h('b', { class: `f${Math.max(0, FEELING_KEYS.indexOf(c.meter))}` }, `${c.meter[0].toUpperCase()}${c.meter.slice(1)} ${c.delta > 0 ? '+' : ''}${c.delta}`), ` · ${c.why}`) : h('span', { class: 'fine' }, 'Nothing yet');
  }
  if (id === 'mood') return [h('span', { class: 'mw' }, d.mood), moodMeters(d.moodBars)];
  if (id === 'now') {
    const line = Object.hasOwn(now, 'where') ? [now.where, lower(now.doing)].filter(Boolean).join(' · ') : [now.lastPlace, now.lastSeen && `last seen ${now.lastSeen}`].filter(Boolean).join(' · ');
    return [h('span', { class: 'lc' }, line), d.scene ? h('span', { class: 'hint' }, 'This scene: wants and hiding · spoiler') : null];
  }
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
 * Commands: people.follow (the store's Follow flag; the star goes back if the engine refuses), npc.edit (opens NPC State's editor; no field edit here yet), npc.refresh, npc.portrait, npc.inspect, npc.merge, npc.delete (asks twice), npc.markAlive, npc.memory.add.
 * Returns the root element; `root.close()` takes the dossier down from the back-stack too.
 */
export function dossierPage(d, ctx = {}) {
  const state = { page: null, menu: false, sure: false, following: Boolean(d.following) };
  const cmd = (type, extra = {}) => ctx.port?.command?.(type, { personId: d.id, ...extra });
  const pages = dossierPages(d, ctx.youName);
  const dead = d.life !== 'alive';
  const releases = { dossier: null, page: null, menu: null };
  const release = (key) => { releases[key]?.(); releases[key] = null; };
  const hold = (key, layer, close) => { release(key); releases[key] = ctx.backStack?.push({ id: `dossier-${d.id}-${key}`, layer, close }) ?? null; };

  const top = h('section', { class: 'glass dtop' });
  const menuSlot = h('div', { class: 'menu-slot' });
  const grid = h('div', { class: 'dgrid' });
  const root = h('div', { class: 'dossier dov', role: 'dialog', 'aria-label': `${d.name}’s dossier`, dataset: { personId: d.id } },
    h('div', { class: 'dscroll' }, top, menuSlot, grid));

  function closeMenu() { release('menu'); state.menu = false; state.sure = false; drawMenu(); }
  function openPage(id) {
    state.page = id;
    hold('page', 'page', () => { state.page = null; drawGrid(); });
    drawGrid();
  }
  function closePage() { release('page'); state.page = null; drawGrid(); }
  function close() { release('menu'); release('page'); release('dossier'); ctx.onClose?.(); }
  root.close = close;

  function drawMenu() {
    top.querySelector('[data-act="menu"]')?.setAttribute('aria-expanded', String(state.menu));
    if (!state.menu) { menuSlot.replaceChildren(); return; }
    menuSlot.replaceChildren(h('div', { class: 'menu glass', role: 'menu' }, MENU.map(([id, label, hint]) => {
      const confirm = id === 'delete' && state.sure;
      return h('button', {
        type: 'button', role: 'menuitem', class: id === 'delete' ? 'dng' : null, dataset: { act: id },
        onClick: () => {
          if (id === 'delete' && !state.sure) { state.sure = true; drawMenu(); return; }
          cmd(`npc.${id}`);
          closeMenu();
        },
      }, confirm ? 'Tap again to delete' : label, h('small', null, confirm ? 'this cannot be undone' : hint));
    })));
  }

  function drawTop() {
    top.replaceChildren(
      button({ label: ctx.origin ?? '‹ People', className: 'bk2', dataset: { act: 'close' }, onClick: close }),
      h('span', { class: 'sp' }),
      button({ label: 'Edit', dataset: { act: 'edit' }, onClick: () => cmd('npc.edit') }),
      h('button', { type: 'button', class: 'ibtn', 'aria-label': 'More', 'aria-expanded': 'false', dataset: { act: 'menu' },
        onClick: () => { if (state.menu) { closeMenu(); return; } state.menu = true; hold('menu', 'menu', () => { state.menu = false; state.sure = false; drawMenu(); }); drawMenu(); } }, '⋯'));
  }

  function hero() {
    const follow = button({ label: state.following ? '★ Following' : '☆ Follow', className: 'fbtn', pressed: state.following, dataset: { act: 'follow' },
      onClick: () => {
        const on = !state.following;
        state.following = on;
        Promise.resolve(ctx.port?.command?.('people.follow', { id: d.id, on })).then(result => { if (result?.ok === false && state.following === on) { state.following = !on; drawGrid(); } });
        drawGrid();
      } });
    const where = dead ? (d.death?.where ?? '') : (d.now?.where ?? d.now?.lastPlace ?? '');
    return h('section', { class: 'glass dhero' },
      feelingsHero(d, { onProfile: () => openPage('profile') }),
      h('div', { class: 'dname' }, d.name),
      h('div', { class: 'chips dchips' }, dead
        ? h('span', { class: ['deadb', d.life === 'presumed' ? 'pres' : null] }, d.life === 'presumed' ? 'Presumed dead' : 'Deceased')
        : follow),
      h('div', { class: 'idl' }, d.idLine, d.genderUnknown ? h('span', { class: 'gflag' }, ' · gender not stated') : null),
      h('div', { class: 'idl' }, [dead ? where : (d.now && Object.hasOwn(d.now, 'where') ? 'Here' : where), d.inParty ? 'in your party' : null].filter(Boolean).join(' · ')),
      dead ? null : partyAddButton(d, { ...ctx, onAdded: () => { d.partyAdd = null; d.inParty = true; drawGrid(); } }),
      dead ? null : button({ label: 'See on map', dataset: { act: 'map' }, onClick: () => { if (ctx.seeOnMap) ctx.seeOnMap(d.id); else cmd('people.focus'); } }));
  }

  const card = (id, title, body) => h('button', { type: 'button', class: 'dcard glass', dataset: { page: id }, onClick: () => openPage(id) },
    h('span', { class: 'dl' }, title, h('i', null, '›')), body);

  function cards() {
    const byId = Object.fromEntries(pages.map(p => [p.id, p]));
    const title = id => (id === 'past' ? `Past · ${(d.past ?? []).length}` : id === 'with' ? `${byId.with.title} · last change` : byId[id].title);
    const make = id => (byId[id] ? card(id, title(id), summary(d, id)) : null);
    return [make('death'), make('with'), make('mood'), make('now'), h('div', { class: 'dpair' }, make('ties'), make('past')), make('secrets'), make('profile')].filter(Boolean);
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
  hold('dossier', 'page', () => { release('menu'); release('page'); ctx.onClose?.(); });
  return root;
}
