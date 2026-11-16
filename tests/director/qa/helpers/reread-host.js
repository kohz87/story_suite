// QA helper: the host and the extra change lines of Story Director's edit-then-Re-read fuzz shard
// (state-fuzz-reread-director.test.js): Story Block's fuzz host (core module, probe module, gear on) with
// Story Director and the Ersveil Bluewatch pack (trips need its clock), the RPG and the pulse off.
// Not a test file (the test glob does not match helpers/).
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { probeModule } from '../../../../packages/story-block/tests/v2/qa/helpers/probe-module.js';
import { READERS } from '../../../../packages/story-block/tests/v2/qa/helpers/reread-fuzz-run.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { withD1 } from '../../../helpers/director/d1.js';

const PACK = readFileSync(new URL('../../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');
const QUESTS = ['Lost Road', 'Old Debt', 'Red Fox'];

/** A new host with Story Director plugged in (the same maker serves the live chat and every told-again one). */
export async function makeDirectorHost() {
    let host = null;
    const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [probeModule(), director], settings: { features: { 'story-block.gear': true, 'story-director.pulse': false } } });
    await host.packs.packs.install(PACK, { origin: 'pack.json' });
    return host;
}

/** Story Director's own change lines, good and bad (a bad quest step, trips and delays, a clock move). */
export const directorLines = r => [
    `~ quest ${r.pick(['a', 'b', 'c'])}${r.int(0, 3)} | step:`,
    `~ quest ${r.pick(['a', 'b', 'c'])}${r.int(0, 3)} | step:`,
    `+ quest ${r.pick(QUESTS)} — go | giver: Fenna`,
    '~ place Bluewatch Village',
    '~ trip Wolfmere Outpost | by: foot',
    `~ trip delay: ${r.int(1, 3)} day | because: rain`,
    `~ trip delay: ${r.int(1, 3)} day | because: shoe`,
    `! time +${r.int(1, 5)} hour`,
];

/**
 * The readers the told-again compare checks with Story Director on: Story Block's own, and Director's problems, quest
 * board and trip. Chronicle readers (names.seen, atlas.keys) are left out for now: an edited reply's new facts are not
 * noted (CHRONNOTES-PLAN effect 1) and the rest differs until CHRONA lands (effect 2).
 */
// (scene.weather and scene.place are left out like the state's weather and region; inventory.loot is left out: an offer's `n` is its rev, which Director's own records shift in a fresh telling)
export const DIRECTOR_READERS = [...READERS.filter(name => !['inventory.loot', 'scene.weather', 'scene.place'].includes(name)), 'director.problems', 'quest.board', 'atlas.trip'];

/**
 * Story Director's own domains, left out of the state-at-every-reply compare (their stored records carry keys and
 * order a fresh telling does not reproduce; chronicle also for the reason above). What the owner reads from them is
 * compared through DIRECTOR_READERS; Story Block's domains are compared in full, except the pack events' claims and
 * the weather (its key and text follow the atlas region: seed 6 step 28 and others, not triaged, reported).
 */
export const LEFT_OUT = ['arc', 'atlas', 'cast', 'checks', 'chronicle', 'director', 'keypeople', 'names', 'claims:event:', 'path:domains/scene/weather', 'path:domains/scene/place/region'];

/** The oracle's tolerance: a later reply's trip record the edit left without its trip (the "later reply keeps its record" class, D-1). */
export const TOLERATE = { domain: 'atlas', field: 'trips' };

/** A trip leg's start that stays a pack place live and a minted one told again, after every reply is Re-read (counted, not triaged). */
export const COUNTED = [{ name: 'tripLegFrom', at: 'reader atlas.trip', path: /^\/legs\/\d+\/fromId$/ }];
