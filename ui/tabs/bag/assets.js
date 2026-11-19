// Builds the Assets card (party pace, Transport and Property lists, folded by default; Transport's + Add) and the asset detail sheet (a mount's Edit and Remove).
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { button } from '../../kit/controls.js';
import { mountForm } from './mount-form.js';

function riderMeta(asset, section) {
  if (section !== 'transport' || !asset.riders.length) return [];
  const who = asset.riders[0];
  return [h('span', { class: 'rg' }, h('span', { class: 'av', dataset: { portrait: who.toLowerCase() } }), `\u00a0ridden by ${asset.riders.join(', ')}`)];
}

function assetRow(asset, section, rpg, onOpen) {
  const tag = asset.tag === 'equipped' && !rpg ? null : asset.tag; // the mock hides the equipped tag when RPG is off
  return h(
    'button',
    { type: 'button', class: 'tr', dataset: { asset: asset.id }, onClick: () => onOpen?.(asset, section) },
    h('span', { class: 'ti' }, glyph(asset.glyph) ?? glyph('item')),
    h('span', null, h('b', null, asset.name), h('small', { class: 'bmt' }, [...riderMeta(asset, section), ...asset.meta.map(t => h('span', null, t))])),
    tag ? h('span', { class: ['tg', tag === 'equipped' ? 'eq' : null] }, tag) : null,
  );
}

// Sends a mount command and closes the sheet; a refusal stays in `note` with the engine's reason (a form shows the returned refusal itself).
async function sendMount(ctx, note, type, payload) {
  const answer = await ctx.port?.command(type, payload);
  if (answer && answer.ok === false) {
    if (note) {
      note.textContent = answer.message || 'The engine could not do that.';
      note.removeAttribute('hidden');
    }
    return answer;
  }
  ctx.close?.();
  return answer;
}

/** Builds the asset detail sheet body: riders, seats, where, and condition (RPG only); a mount's Edit (mounts.edit) and Remove (mounts.remove) with a port. */
export function assetSheet(asset, section, ctx = {}) {
  const rpg = Boolean(ctx.rpg);
  const transport = section === 'transport';
  const kv = (label, v) => [h('dt', null, label), h('dd', null, v)];
  const head = h('div', { class: 'dh' }, h('span', { class: 'tl sm' }, glyph(asset.glyph) ?? glyph('item')),
    h('div', null, h('div', { class: 'dn' }, asset.name), h('div', { class: 'chips' }, h('span', { class: 'lvl2' }, asset.kindLabel))));
  const note = h('p', { class: 'fine err', role: 'alert', hidden: true });
  const root = h('div', { class: 'bag-sheet', dataset: { sheet: 'asset' } });
  const edit = () => root.replaceChildren(head, mountForm(asset, {
    onCancel: () => root.replaceChildren(...view),
    onSave: payload => sendMount(ctx, null, 'mounts.edit', payload),
  }));
  const actions = transport && ctx.port ? h('div', { class: 'brow' },
    button({ label: 'Edit', tone: 'primary', className: 'edit', onClick: edit }), h('span', { class: 'grow' }),
    button({ label: 'Remove', tone: 'danger', onClick: () => sendMount(ctx, note, 'mounts.remove', { mount: asset.name }) })) : null;
  const view = [
    head,
    h('p', { class: 'desc' }, asset.note),
    h('dl', { class: 'kv' },
      kv(transport ? 'Riders' : 'Staying', asset.riders.length ? asset.riders.join(', ') : 'nobody'),
      transport && asset.seats ? kv('Seats', String(asset.seats)) : [],
      kv(transport ? 'With the party' : 'Where', transport ? `${asset.withParty ? 'With the party' : 'Not with you'} · ${asset.where}` : asset.where),
      rpg && transport && asset.condition ? kv('Condition', asset.condition) : []),
    // (the refusal line above the buttons, so the action row stays the sheet's last: sticky on desktop)
    actions ? note : null, actions,
  ].filter(Boolean);
  root.replaceChildren(...view);
  return root;
}

// Transport's + Add (the mounts switch is on): the form in a sheet, sent as mounts.add.
function addMount(ctx) {
  ctx.openSheet?.(mountForm(null, { onCancel: () => ctx.close?.(), onSave: payload => sendMount(ctx, null, 'mounts.add', payload) }), 'Add a mount');
}

/** Builds the Assets card from the bag view-model; ctx = { prefs, rpg, openSheet(el, label) }. Null when there is nothing to show. */
export function assetsCard(bag, ctx = {}) {
  const { transport = [], property = [], canAdd = false } = bag.assets ?? {};
  const adding = canAdd === true && Boolean(ctx.port);
  if (!transport.length && !property.length && !bag.pace && !adding) return null;
  const rpg = Boolean(bag.rpg);
  const pace = bag.pace;
  const open = Boolean(ctx.prefs?.getFold?.('bag.assets', false));
  const summary = [pace ? `${pace.kmDay} km/day` : null, `${transport.length} transport`, `${property.length} property`].filter(Boolean).join(' · ');
  const body = h('div', { class: 'abody', dataset: { open: String(open) } },
    pace ? h('div', { class: ['pacebox', pace.slowed ? 'slow' : null] },
      h('div', { class: 'pr' }, h('span', null, 'Party pace'), h('b', null, `${pace.kmDay} km/day`)), h('p', null, pace.why), pace.alt ? h('p', { class: 'opt' }, pace.alt) : null) : null,
    transport.length || adding ? [h('div', { class: 'asub' }, 'Transport'), h('div', { class: 'trs' }, transport.map(a => assetRow(a, 'transport', rpg, show))),
      adding ? h('div', { class: 'brow' }, transport.length ? null : h('p', { class: 'fine' }, 'No mounts yet.'), h('span', { class: 'grow' }),
        button({ label: '+ Add', dataset: { add: 'mount' }, onClick: () => addMount(ctx) })) : null] : null,
    property.length ? [h('div', { class: 'asub' }, 'Property'), h('div', { class: 'trs' }, property.map(a => assetRow(a, 'property', rpg, show)))] : null);
  const fold = h('button', { type: 'button', class: ['afold', pace?.slowed ? 'slow' : null], 'aria-expanded': String(open),
    onClick: () => {
      const now = fold.getAttribute('aria-expanded') !== 'true';
      fold.setAttribute('aria-expanded', String(now));
      body.dataset.open = String(now);
      ctx.prefs?.setFold?.('bag.assets', now);
    } },
  h('b', null, 'Assets'), h('span', { class: 't' }, summary), h('span', { class: 'chev' }, '›'));
  function show(asset, section) {
    ctx.openSheet?.(assetSheet(asset, section, { ...ctx, rpg }), asset.name);
  }
  return h(
    'section',
    { class: 'card glass assets', dataset: { card: 'assets' } },
    h('div', { class: 'ch' }, h('h3', null, 'Assets'), h('span', { class: 'cnt' }, 'the party’s, not carried')),
    fold, body,
  );
}
