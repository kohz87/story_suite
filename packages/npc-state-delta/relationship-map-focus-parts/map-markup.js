// The map's markup: a face's ring tone, a bond's word and tone, the rings and bond lines, and one face.

import { MAP_CENTER, MAP_LENSES, MAP_SPAN, mapRadius, nodeBoxes, plain, ringWordSpot, signed } from '../relationship-map-core.js';
import { portraitHtml } from '../dossier-ui-html.js';
import { escapeHtml } from '../src/util/html.js';
import { FOCUS_TONES, FOCUS_STATES } from './focus-constants.js';
import { relationWord, tagWord, bondToneOf } from './bond-words.js';

// A face's ring tone for how that person stands with you under the lens (not a number between NPCs).
export function faceTone(value = 0) {
    return value >= 25 ? FOCUS_TONES.good : (value <= -25 ? FOCUS_TONES.bad : FOCUS_TONES.grey);
}

// The bond's tone and word from either side's wording (the focused or first-named side wins).
export function bondLine(bond = {}, { bondTone, prefer = '' } = {}) {
    const ids = [prefer, bond.a, bond.b].filter(Boolean);
    const relation = ids.map(id => plain(bond.relation?.[id])).find(Boolean) || '';
    const own = prefer ? bond.tagsBy?.[prefer] : null;
    const word = tagWord(own) || relationWord(relation);
    return { word, tone: bondToneOf(word, relation, { bondTone, tags: own || bond.tags }) };
}

const RING_VALUES = Object.freeze([75, 25, 0, -50]);

// Rings are plain circles (the outermost dashed = cold); bonds are dashed tone lines, solid and thick in focus.
export function mapSvgHtml(model, focus, opts = {}) {
    const lens = MAP_LENSES.find(item => item.key === model.lens) || MAP_LENSES[0];
    const circle = (r, cls) => `<circle class="${cls}" cx="${MAP_CENTER}" cy="${MAP_CENTER}" r="${r.toFixed(1)}"></circle>`;
    const rings = RING_VALUES.map(value => circle(mapRadius(value), value === 0 ? 'delta-map-ring delta-map-ring-zero' : 'delta-map-ring')).join('');
    const bonds = model.lines.filter(line => !focus.active || line.a === focus.focusId || line.b === focus.focusId).map(line => {
        const { tone } = bondLine(line, { ...opts, prefer: focus.focusId });
        const cls = `delta-map-bond${line.touches ? ' delta-map-bond-selected' : ''}${focus.active ? ' delta-map-bond-solid' : ''}`;
        return `<line class="${cls}" data-tone="${tone}" x1="${line.from.x.toFixed(1)}" y1="${line.from.y.toFixed(1)}" x2="${line.to.x.toFixed(1)}" y2="${line.to.y.toFixed(1)}"></line>`;
    }).join('');
    // The ring's word sits where no face or label is (ringWordSpot); relationship-map.js refines it against the measured labels.
    const spot = ringWordSpot(nodeBoxes(model.nodes));
    return `<svg class="delta-map-svg" viewBox="0 0 ${MAP_SPAN} ${MAP_SPAN}" aria-hidden="true" focusable="false">${circle(mapRadius(-100), 'delta-map-outer')}${rings}`
        + `<text class="delta-map-outer-word" x="${spot.x.toFixed(1)}" y="${spot.y.toFixed(1)}" text-anchor="${spot.anchor}">${escapeHtml(lens.negative)}</text>${bonds}</svg>`;
}

// One face: portrait through the refs (never a raw data URL), ring by tone, name, then the number
// or, in focus, the relation word under each tied name.
export function mapNodeHtml(node, focus, { refs = null, bondTone, ties = new Map() } = {}) {
    const state = focus.states[node.id] || FOCUS_STATES.plain;
    const tie = ties.get(node.id);
    const tone = tie ? tie.tone : faceTone(node.value);
    const delta = node.delta ? `<span class="delta-map-delta" aria-hidden="true">${escapeHtml(signed(node.delta))}</span>` : '';
    const under = tie ? `<small class="delta-map-word" data-tone="${tie.tone}">${escapeHtml(tie.word)}</small>` : `<small>${escapeHtml(signed(node.value))}</small>`;
    const label = `<span class="delta-map-label"><b class="delta-map-name">${escapeHtml(node.name)}</b><b class="delta-map-short">${escapeHtml(node.short)}</b>${under}</span>`;
    const said = `${node.name}, ${signed(node.value)}${tie ? `, ${tie.word}` : ''}`;
    return `<button type="button" class="delta-map-node" data-npc-id="${escapeHtml(node.id)}" data-status="${node.status}" data-tone="${tone}" data-focus="${state}" aria-pressed="${node.selected}" aria-label="${escapeHtml(said)}" style="left:${node.x.toFixed(2)}%;top:${node.y.toFixed(2)}%"><span class="delta-map-avatar">${portraitHtml({ name: node.name, portrait: node.portrait }, 'delta-map-face', { alt: false, refs })}</span>${delta}${label}</button>`;
}
