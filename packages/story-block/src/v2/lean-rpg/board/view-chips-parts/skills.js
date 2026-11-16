// The Mana and Stamina strip, skill buttons and target buttons of the choosing member.
import { h, text } from '../../../../../../../ui/legacy/view/widgets/dom.js';
import { healthMiniBar } from './bars.js';
import { hasValue, numberOr } from './shared-values.js';

export const NOT_ENOUGH = 'not enough';
/** One Mana or Stamina row: label, a bar at value/max, and "10/10". */
function resourceRow(doc, kind, label, { value, max } = {}) {
    const row = h(doc, 'span', `rpg-res rpg-res-${kind}`);
    const cap = Math.max(0, numberOr(max));
    const now = Math.min(cap, Math.max(0, numberOr(value)));
    const width = cap > 0 ? Math.round((now / cap) * 100) : 0;
    row.appendChild(h(doc, 'em', 'rpg-res-label', label));
    const track = h(doc, 'i', 'rpg-res-track');
    const fill = h(doc, 'b', 'rpg-res-fill');
    fill.style.width = `${width}%`;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(h(doc, 'span', 'rpg-res-count', `${now}/${cap}`));
    return row;
}

/**
 * The choosing member's strip, right above the skills: `mana` and `stamina` as { value, max } (blocks left and blocks in the bar).
 * A member with no Mana (`mana` null, or a bar of size 0) shows Stamina only.
 */
export function resourceStrip(doc, { mana = null, stamina = null } = {}) {
    const strip = h(doc, 'div', 'rpg-actor');
    if (mana && numberOr(mana.max) > 0) strip.appendChild(resourceRow(doc, 'mp', 'Mana', mana));
    if (stamina) strip.appendChild(resourceRow(doc, 'sp', 'Stamina', stamina));
    return strip;
}

/**
 * A skill button: name, then "area · STR · 2 Stamina" (the resource is Mana when `uses` is 'mana', else Stamina; the cost only when known).
 * `blocked` (the member cannot pay: pass the truthy reason from plan.js actionSkills) greys it, disables it and says "not enough".
 */
export function skillButton(doc, { name, stat, uses, cost, area = false, blocked = false } = {}) {
    const resource = uses === 'mana' ? 'Mana' : 'Stamina';
    const isBlocked = Boolean(blocked);
    const node = h(doc, 'button', `rpg-skill${area ? ' rpg-skill-area' : ''}${isBlocked ? ' rpg-skill-blocked' : ''}`);
    node.setAttribute('type', 'button');
    node.disabled = isBlocked;
    node.appendChild(h(doc, 'b', 'rpg-skill-name', text(name, 60)));
    const paid = uses === 'mana' || uses === 'stamina', costed = !paid ? '' : Number.isInteger(cost) && cost > 0 ? `${cost} ${resource}` : resource;
    const parts = [area ? 'area' : '', hasValue(stat) ? text(stat, 12).toUpperCase() : '', costed].filter(Boolean);
    if (isBlocked) parts.push(NOT_ENOUGH);
    node.appendChild(h(doc, 'small', 'rpg-skill-cost', parts.join(' · ')));
    return node;
}

/** A target button: its label (the button's whole text) and the Health mini-bar of what it picks (a group or a member). */
export function targetButton(doc, { label, value, max, tone } = {}) {
    const node = h(doc, 'button', 'rpg-skill rpg-target', text(label, 90));
    node.setAttribute('type', 'button');
    node.appendChild(healthMiniBar(doc, { value, max, tone }));
    return node;
}
