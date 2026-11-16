/* NPC State Delta dossier view-model part: the board model: the dial, name and status, and one tile per section. */
import { plain } from '../dossier-ui-model.js';
import { object } from './shared-object.js';
import { dialAxesModel } from './dial-model.js';
import { changeModel } from './change-model.js';
import { moodTile } from './mood-model.js';
import { pullTile } from './pull-model.js';
import { pastModel, rightNowModel, secretsModel, tiesModel } from './section-models.js';

// Tile titles for the two sections the board names. The label "{{user}}" is kept literal here; the renderer substitutes the player's name.
const SECTION_TITLES = Object.freeze({
    mood: 'Mood',
    now: 'Right now',
    with: 'With {{user}}',
    ties: 'Ties',
    past: 'Past',
    secrets: 'Secrets',
});

// The board: the dial's four arcs, name and status, and one tile per section. Pull is null until its data exists (phase 2).
export function boardModel(npc = {}, { reply = null } = {}) {
    const source = object(npc);
    const key = object(source.key);
    const last = changeModel(source.lastRelationshipChange);
    const ties = tiesModel(source);
    const past = pastModel(source);
    const secrets = secretsModel(source);
    return {
        id: plain(source.id),
        name: plain(source.name, 'Unnamed NPC'),
        status: plain(source.statusLabel),
        role: plain(source.role),
        species: plain(source.species),
        gender: plain(source.gender),
        isKey: Boolean(source.key),
        keyHere: key.here === true,
        dial: dialAxesModel(source.relationship),
        tiles: {
            lastChange: { title: SECTION_TITLES.with, heading: 'Last change', hasChange: last.hasChange, moved: last.moved, reason: last.reason, gate: last.gate, when: last.when },
            mood: moodTile(source, reply),
            pull: pullTile(source),
            rightNow: { title: SECTION_TITLES.now, ...(({ place, doing, summary }) => ({ place, doing, summary }))(rightNowModel(source)) },
            ties: { title: 'Ties', count: ties.count, names: ties.names, faces: ties.faces },
            past: { title: 'Past', count: past.count, latest: past.latest, dots: past.dots },
            secrets: { title: 'Secrets', total: secrets.total, open: secrets.open, next: secrets.next, lastOpen: secrets.lastOpen },
        },
    };
}
