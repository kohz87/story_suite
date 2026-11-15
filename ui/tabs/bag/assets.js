// Builds the Assets card (party pace, Transport and Property lists, folded by default) and the asset detail sheet.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';

function tagOf(asset, section, rpg) {
  if (section === 'property') return asset.kindLabel.split(' ')[0].toLowerCase();
  if (asset.withParty && asset.riders.length) return rpg ? 'equipped' : 'with you';
  return asset.withParty ? 'with you' : 'not with you';
}

function metaOf(asset, section) {
  const riders = asset.riders.length && section === 'transport' ? `ridden by ${asset.riders.join(', ')}` : null;
  const seats = asset.seats ? `${asset.seats} ${asset.seats === 1 ? 'seat' : 'seats'}` : null;
  return [riders, asset.kindLabel, seats, asset.where].filter(Boolean);
}

function assetRow(asset, section, rpg, onOpen) {
  const tag = tagOf(asset, section, rpg);
  return h(
    'button',
    { type: 'button', class: 'tr', dataset: { asset: asset.id }, onClick: () => onOpen?.(asset, section) },
    h('span', { class: 'ti' }, glyph(asset.glyph) ?? glyph('item')),
    h('span', null, h('b', null, asset.name), h('small', { class: 'bmt' }, metaOf(asset, section).map(t => h('span', null, t)))),
    h('span', { class: ['tg', tag === 'equipped' ? 'eq' : null, tag === 'equipped' ? 'rpg' : null] }, tag),
  );
}

/** Builds the asset detail sheet body: riders, seats, where, and condition (RPG only). */
export function assetSheet(asset, section, ctx = {}) {
  const rpg = Boolean(ctx.rpg);
  const transport = section === 'transport';
  const kv = (label, v) => [h('dt', null, label), h('dd', null, v)];
  return h(
    'div',
    { class: 'bag-sheet', dataset: { sheet: 'asset' } },
    h('div', { class: 'dh' }, h('span', { class: 'tl sm' }, glyph(asset.glyph) ?? glyph('item')),
      h('div', null, h('div', { class: 'dn' }, asset.name), h('div', { class: 'chips' }, h('span', { class: 'lvl2' }, asset.kindLabel)))),
    h('p', { class: 'desc' }, asset.note),
    h('dl', { class: 'kv' },
      kv(transport ? 'Riders' : 'Staying', asset.riders.length ? asset.riders.join(', ') : 'nobody'),
      transport && asset.seats ? kv('Seats', String(asset.seats)) : [],
      kv(transport ? 'With the party' : 'Where', transport ? `${asset.withParty ? 'With the party' : 'Not with you'} · ${asset.where}` : asset.where),
      rpg && transport && asset.condition ? kv('Condition', asset.condition) : []),
  );
}

/** Builds the Assets card from the bag view-model; ctx = { prefs, rpg, openSheet(el, label) }. Null when there is nothing to show. */
export function assetsCard(bag, ctx = {}) {
  const { transport = [], property = [] } = bag.assets ?? {};
  if (!transport.length && !property.length && !bag.pace) return null;
  const rpg = Boolean(bag.rpg);
  const pace = bag.pace;
  const open = Boolean(ctx.prefs?.getFold?.('bag.assets', false));
  const summary = [pace ? `${pace.kmDay} km/day` : null, `${transport.length} transport`, `${property.length} property`].filter(Boolean).join(' · ');
  const body = h('div', { class: 'abody', hidden: !open },
    pace ? h('div', { class: ['pacebox', pace.slowed ? 'slow' : null] },
      h('div', { class: 'pr' }, h('span', null, 'Party pace'), h('b', null, `${pace.kmDay} km/day`)), h('p', null, pace.why)) : null,
    transport.length ? [h('div', { class: 'asub' }, 'Transport'), h('div', { class: 'trs' }, transport.map(a => assetRow(a, 'transport', rpg, show)))] : null,
    property.length ? [h('div', { class: 'asub' }, 'Property'), h('div', { class: 'trs' }, property.map(a => assetRow(a, 'property', rpg, show)))] : null);
  const fold = h('button', { type: 'button', class: ['afold', pace?.slowed ? 'slow' : null], 'aria-expanded': String(open),
    onClick: () => {
      const now = fold.getAttribute('aria-expanded') !== 'true';
      fold.setAttribute('aria-expanded', String(now));
      if (now) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
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
