/* NPC State Delta dossier surface: the Board screen for one NPC (dial, name block, tiles). */
import { capFirst, initialsOf, portraitHtml } from '../dossier-ui-html.js';
import { dialHtml } from '../dossier-ui-dial.js';
import { profileMeterAxes } from '../dossier-ui-profile.js';
import { boardModel, possessiveWord } from '../dossier-ui-view-model.js';
import { esc } from './shared-markup.js';
import { boardTileHtml } from './tile.js';
import { boardTiles } from './tiles.js';

// The faces of the Ties tile: up to three people ringed by the bond tone, with their portrait when they have a dossier of their own
// (`peers`: lower-cased name -> portrait). A person with no portrait shows the plain disc.
function tieFacesHtml(faces = [], { peers = null, refs = null } = {}) {
    if (!faces.length) return '';
    const ring = { good: 'var(--good)', bad: 'var(--bad)', gold: 'var(--held)' };
    return `<span class="delta-tile-faces">${faces.map(face => `<span class="delta-tile-face-ring" style="--r:${ring[face.tone] || 'var(--dial)'}" title="${esc(face.name)}">${peers?.get(String(face.name).toLowerCase()) ? portraitHtml({ name: face.name, portrait: peers.get(String(face.name).toLowerCase()) }, 'delta-tile-face', { alt: false, refs }) : `<span class="delta-tile-face delta-tile-initials">${esc(initialsOf(face.name))}</span>`}</span>`).join('')}</span>`;
}

// Desktop section views only (CSS shows it; the board and the phone keep the identity line): the role on its own line, then the four
// meters on a new line, each value in its meter's colour.
function sectionCaptionHtml(role, npc) {
    const meters = profileMeterAxes(npc).map(item => `<i data-axis="${item.axis}">${esc(item.text)}</i>`).join('');
    const line = String(role ?? '').trim();
    return (line ? `<p class="delta-muted delta-board-role">${esc(capFirst(line))}</p>` : '')
        + (meters ? `<p class="delta-board-meters">${meters}</p>` : '');
}

// The Board screen for one NPC: the dial (portrait inside; a tap opens the profile), the name, identity
// and status, the pills (key person, mood), then the tiles. `refs` is the panel's createPortraitRefs()
// (refs.fill is the caller's job, after the markup is in the DOM).
export function boardHtml(npc = {}, { refs = null, userName = 'you', peers = null, reply = null } = {}) {
    const model = boardModel(npc, { reply }) || {};
    const name = model.name || 'Unnamed NPC';
    const pills = [
        model.isKey ? { text: '★ Key person', kind: 'key' } : null,
        model.tiles?.mood?.text ? { text: model.tiles.mood.text, kind: 'mood' } : null,
    ].filter(Boolean);
    // As written in the dossier, with the first letter of each part capitalised ("male · bargemaster" reads "Male · Bargemaster").
    const identity = [model.species, model.gender, model.role].filter(Boolean).map(capFirst).join(' · ');
    const tiles = boardTiles(model, { userName, facesHtml: tieFacesHtml(model.tiles?.ties?.faces, { peers, refs }) }).map(boardTileHtml).join('');
    const profile = `<div class="delta-board-dial" role="button" tabindex="0" data-delta-screen="profile" aria-label="${esc(name)} profile">${dialHtml(npc, { refs })}</div>`;
    const nameBlock = `<div class="delta-board-name"><h3 class="delta-board-title">${esc(name)}</h3>`
        + (pills.length ? `<div class="delta-board-pills">${pills.map(pill => `<span class="delta-pill delta-pill-${pill.kind}">${esc(pill.text)}</span>`).join('')}</div>` : '')
        + `<p class="delta-muted delta-board-ident">${esc([identity, `tap the portrait for ${possessiveWord(npc.gender, { lower: true })} profile`].filter(Boolean).join(' · '))}</p>`
        + sectionCaptionHtml(model.role, npc)
        + (model.status ? `<p class="delta-board-status">${esc(model.status)}</p>` : '')
        + '</div>';
    // Desktop puts the dial and name in a pane of their own beside the tiles (the mockup's left pane); phone stacks them.
    return `<section class="delta-board" data-delta-board="${esc(model.id)}"><div class="delta-board-hero">${profile}${nameBlock}</div>`
        + `<div class="delta-board-tiles">${tiles}</div></section>`;
}
