// Shared helpers for the wizard's data tests: the Create run (wizard-data-parts/create-run.js, the one the new view's wizard sends) on a testkit chat.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_SETS } from '../../../../modules/rpg/templates.js';
import { newDraft } from '../../../../modules/rpg/view/wizard-data.js';
import { runCreate } from '../../../../modules/rpg/view/wizard-data-parts/create-run.js';
import { createWizardWorld } from '../../../../ui/wizard/world.js';
import { begin, makeBlocks, page } from './page.js';

export const PACK = JSON.parse(readFileSync(new URL('../fixtures/skill-sets-pack.json', import.meta.url), 'utf8'));
export const CHECK = { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'] };
export const FIGHTER = SKILL_SETS[0];

export const names = host => Object.keys(host.head()?.domains.dataModules?.active ?? {}).sort();
export const rolesOf = host => { const domain = host.head().domains.dataModules; return Object.keys(domain?.active ?? {}).map(id => domain.pins[domain.active[id].hash].definition.role).sort(); };

/** The wizard's world (what Create and its problems read) on `host`. */
export const worldOf = host => createWizardWorld({ sdk: host.sdk, ctx: () => host.ctx });

/** Runs Create for `draft` (a `newDraft` with changes) on `host`: `command(type, payload, options)` may be a stand-in; `imported` is `{ file }`. → runCreate's answer. */
export function create(host, draft, { command = null, imported = null } = {}) {
    const world = worldOf(host);
    const send = command ?? ((type, payload) => host.sdk.command(type, payload, { cause: 'ui' }));
    return runCreate({ draft, world: world.world(), imported, command: send, query: world.query, headState: world.headState, levelCap: world.levelCap });
}

/** A draft for a You (no name given: the persona's) or a companion called `name`. */
export const draftOf = (name = '', kind = 'you') => ({ ...newDraft({ persona: 'Wessel' }), kind, ...(name ? { name } : {}) });

// A reply with `used` block actions on it: the Character and Skills blocks (two defines) and then sets of one field.
export async function usedReply(t, used) {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await makeBlocks(ctx.host);
    for (let n = 0; n < used - 2; n += 1) {
        const set = await ctx.host.sdk.command('dm.set', { module: 'pack.chat/wessel', field: 'str', value: 12 + (n % 2) });
        assert.equal(set.ok, true, set.message);
    }
    assert.equal(Object.values(ctx.host.head().domains.dataModules.perReply)[0].roots, used);
    return ctx;
}
