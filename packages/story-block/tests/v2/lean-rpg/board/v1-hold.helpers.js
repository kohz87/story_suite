// A whole host (the core module with the data-modules part, so story lines work) whose sheet is Combat Rules v1 blocks, and a fight on it driven through the real sdk.interaction.
import { characterV1 } from '../../../../src/v2/lean-rpg/templates-parts/v1-character.js';
import { skillsV1 } from '../../../../src/v2/lean-rpg/templates-parts/v1-skills.js';
import { foesV1 } from '../../../../src/v2/lean-rpg/templates-parts/v1-foes.js';
import { LEAN_RPG_FEATURE } from '../../../../src/v2/lean-rpg/index.js';
import { CORE_FEATURE } from '../../../../src/v2/features.js';
import { boardApi } from '../../helpers/board-port.js';
import { FIGHT_KIND } from '../../../../src/v2/lean-rpg/board/port-session.js';
import { success } from '../../data-modules/helpers.js';
import { step } from './v1.helpers.js';

const { createHost } = await import('../../../../testkit/index.js');
const { createFakeModel } = await import('../../../../testkit/model.js');

/** A full host with a v1 hero (Astra, level 5, a Cut skill) and one foe group; the fight is not opened yet. */
export async function holdHost(t, { count = 1, level = 5, tier = 'standard', settings = {} } = {}) {
    const host = await createHost({ callModel: createFakeModel(['none']), settings: { modules: { 'story-block': settings } } });
    t?.after?.(() => host.close());
    host.features.set(LEAN_RPG_FEATURE, true);
    host.features.set(CORE_FEATURE.fightBoard, true);
    await host.send('Begin.', 'Opening.');
    const define = async definition => success(await host.sdk.command('dm.define', { definition: structuredClone(definition) }));
    await define(characterV1);
    await define(skillsV1);
    await define(foesV1);
    const set = (module, fields) => host.sdk.command('dm.set', { module, fields });
    success(await set('pack.chat/character', { who: 'Astra', str: 30, level: 5 }));
    success(await set('pack.chat/skills', { who: 'Astra', skill1: 'Cut', about1: 'A hard cut', stat1: 'str', type1: 'attack' }));
    success(await set('pack.chat/foes', { foe1: 'Rats', count1: count, level1: level, tier1: tier }));
    return host;
}

const sid = host => host.store.carrierSid(host.store.headIndex());
/** Opens the fight and stages `n` skill exchanges. */
export function stageFight(host, n = 14) {
    const api = boardApi(host.ctx.chatMetadata, () => host.head(), sid(host));
    const opened = api.open(FIGHT_KIND, { rules: {} });
    if (!opened.ok) throw new Error(opened.message);
    for (let at = 0; at < n; at += 1) {
        const id = host.ctx.chatMetadata.storySuiteInteraction.open.id;
        boardApi(host.ctx.chatMetadata, () => host.head(), sid(host)).stage(id, step('skill'));
    }
}
