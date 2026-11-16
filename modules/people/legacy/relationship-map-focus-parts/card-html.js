// The person card and the key line under the lens switch.

import { MAP_LENSES } from '../relationship-map-core.js';
import { portraitHtml } from '../dossier-ui-html.js';
import { dialHtml } from '../dossier-ui-dial.js';
import { moodTile, possessiveWord } from '../dossier-ui-view-model.js';
import { escapeHtml } from '../src/util/html.js';
import { selectedTies, cardNumberItems, cardNumbersLine } from './card-ties.js';

// The phone's one line: "warmth +11 · ally of Temiwa · rival of Bregje" (a tie word that reads "of": ally, rival; owes and the rest lead the name).
function compactLine(sel, ties, shortOf) {
    const warmth = cardNumbersLine(sel).split(' · ')[0].toLocaleLowerCase();
    const tied = ties.map(t => {
        const who = shortOf.get(t.id) || t.name;
        if (t.fromTag && t.word === 'mentor') return `mentor to ${who}`;
        return /^(?:ally|rival|friend|enemy|kin|partner)$/.test(t.word) ? `${t.word} of ${who}` : `${t.word || 'tied to'} ${who}`;
    });
    return [warmth, ...tied].join(' · ');
}

// The card (mockup screens 9 and 10). Beside the map: the dial round her portrait (a tap opens her profile), name, Key and mood pills, the
// numbers, "Bonds on the map" (inline) or, in Focus, "Her ties" (a row each, with the dynamic), Open dossier and Focus. Under the map on a phone:
// a face, name and one line; in Focus the "Rika's ties" block. Both sets of parts are in the markup; the container query shows one set.
export function mapCardHtml(model, focus, persona, { refs = null, npc = null } = {}) {
    const sel = model.selected;
    if (!sel) return '<aside class="delta-map-card delta-map-card-empty"><p class="delta-map-last">Pick an NPC on the map.</p></aside>';
    const id = escapeHtml(sel.id);
    const focused = focus.active && focus.focusId === sel.id;
    const node = (model.nodes || []).find(item => item.id === sel.id);
    const shortOf = new Map((model.nodes || []).map(item => [item.id, item.short]));
    const ties = selectedTies(model);
    const word = t => `<span data-tone="${t.tone}">${escapeHtml(t.word || 'tied')}</span>`;
    const inline = ties.length ? ties.map(t => `<span class="delta-map-tie">${word(t)} ${escapeHtml(t.name)}</span>`).join('<i class="delta-map-tie-sep"> · </i>') : 'No ties to anyone else on the map.';
    const rows = ties.map(t => `<span class="delta-map-tie">${word(t)} <b>${escapeHtml(t.name)}</b>${t.dynamic ? ` · ${escapeHtml(t.dynamic)}` : ''}</span>`).join('');
    const own = `${sel.name}'s ties`;
    const heading = `<b class="delta-map-ties-head"><span class="delta-map-beside">${escapeHtml(focused ? `${possessiveWord(npc?.gender)} ties` : 'Bonds on the map')}</span><span class="delta-map-stacked">${escapeHtml(own)}</span></b>`;
    const mood = npc ? moodTile(npc).text : '';
    const pills = [npc?.key ? '<span class="delta-pill delta-pill-key">★ Key</span>' : '', mood ? `<span class="delta-pill delta-pill-mood">${escapeHtml(mood)}</span>` : ''].filter(Boolean).join('');
    const dial = npc ? dialHtml(npc, { refs }) : `<div class="delta-map-card-face">${portraitHtml({ name: sel.name, portrait: node?.portrait || '' }, 'delta-map-card-img', { alt: false, refs })}</div>`;
    const focusBtn = focused ? '' : `<button type="button" class="delta-btn delta-map-focus ss-tap-pill" data-map-focus="${id}">Focus</button>`;
    return `<aside class="delta-map-card" data-focus="${focused ? 'on' : 'off'}" aria-label="${escapeHtml(`${sel.name} toward ${persona}`)}">
        <button type="button" class="delta-map-card-dial delta-map-beside" data-map-profile="${id}" aria-label="${escapeHtml(`${sel.name}: open the profile`)}">${dial}</button>
        <h3 class="delta-map-card-name delta-map-beside">${escapeHtml(sel.name)}</h3>
        <div class="delta-map-card-pills delta-map-beside">${pills}</div>
        <p class="delta-map-card-line delta-map-beside">${cardNumberItems(sel).map(item => `<i>${escapeHtml(item)}</i>`).join('')}</p>
        ${focused ? '' : `<div class="delta-map-card-who delta-map-stacked"><span class="delta-map-card-face">${portraitHtml({ name: sel.name, portrait: node?.portrait || '' }, 'delta-map-card-img', { alt: false, refs })}</span><p><b>${escapeHtml(sel.name)}</b> <span>${escapeHtml(compactLine(sel, ties, shortOf))}</span></p></div>`}
        <div class="delta-map-ties${focused ? ' delta-map-ties-focus' : ''}">${focused ? heading : `<b class="delta-map-ties-head delta-map-beside">Bonds on the map</b>`}
            <p class="delta-map-ties-inline${focused ? '' : ' delta-map-beside'}">${inline}</p>${focused ? `<div class="delta-map-ties-rows delta-map-beside">${rows}</div>` : ''}</div>
        <div class="delta-map-actions"><button type="button" class="delta-btn delta-map-open ss-tap-pill" data-npc-id="${id}">Open dossier ›</button>${focusBtn}</div>
    </aside>`;
}

// The key line under the lens switch: closer = higher on the chosen lens.
export function mapKeyLine(lensKey, persona) {
    const lens = MAP_LENSES.find(item => item.key === lensKey) || MAP_LENSES[0];
    const word = lens.key === 'warmth' ? 'warmer' : `higher ${lens.label.toLocaleLowerCase()}`;
    return `Closer to ${escapeHtml(persona)} = ${word} · the dashed outer ring = ${escapeHtml(lens.negative)}`;
}
