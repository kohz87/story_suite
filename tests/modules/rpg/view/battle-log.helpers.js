import { createHost } from '../../../../testkit/index.js';
import { makeMessage } from '../../../../../../tests/helpers/ui-fake-dom.js';
import { setupDom } from '../../../../../../tests/ui/view/mounts/helpers.js';
import { BATTLE_ROOT, buildPanel, createBattleLog, panelModel, readResolve } from '../../../../src/v2/lean-rpg/view/battle-log.js';
import { RESOLVE } from '../../../../src/v2/lean-rpg/index.js';
import { characterDefinition, defineAll, fakeState, foesDefinition, roleOf, setField, skillsDefinition } from './helpers.js';

export const settle = () => new Promise(resolve => setImmediate(resolve));

// What the rolls piece records for a reply (data.v2.result, see lean-rpg/resolve.js).
export const pc = (who, stat, extra = {}) => ({ who, die: 10, stat, statBonus: 5, classValue: 2, classBonus: 4, rank: 0, edge: 0, total: 19, ...extra });
export const foe = (name, extra = {}) => ({ slot: 1, name, die: 9, base: 5, classValue: 1, classBonus: 2, total: 16, ...extra });
export const result = () => ({
    v: 1, key: '3-abc', pace: 'normal', stop: 'pace', checks: [],
    rounds: [{ n: 2, decisive: false, lines: [
        { kind: 'foe', outcome: 'fail', skill: null, pc: pc('Wessel', 'agi', { die: 6, total: 12 }), foe: foe('Sluice Rat A', { die: 11, total: 15 }) },
        { kind: 'act', outcome: 'success', skill: 'Iron Breath', pc: pc('Wessel', 'str', { die: 14, statBonus: 7, rank: 1, total: 26 }), foe: foe('Sluice Rat A', { total: 16 }) },
        { kind: 'act', outcome: 'cost', skill: 'Spark', why: 'cornered', pc: pc('Ren', 'int', { total: 17, edge: -2 }), foe: foe('Sluice Rat B', { slot: 2, total: 18 }) },
    ] }],
    refused: [], summary: { exchanges: 1, acts: [], refused: 0 },
});
export const state = fields => fakeState([
    { definition: characterDefinition('wessel', 'Wessel'), fields: { health: 4, mana: 3, stamina: 2, ...fields.wessel } },
    { definition: characterDefinition('ren', 'Ren'), fields: { health: 3, mana: 2, stamina: 2, ...fields.ren } },
    { definition: foesDefinition(), fields: { foe1: 'Sluice Rat A', hurt1: 5, foe2: 'Sluice Rat B', hurt2: 3, foe3: 'Sluice Rats', count3: 4, hurt3: 5, ...fields.foes } },
]);
export const before = state({ wessel: { health: 5, mana: 3 }, ren: { stamina: 3 }, foes: { hurt1: 5, hurt2: 5 } });
export const after = state({ wessel: { health: 4 }, ren: { stamina: 2 }, foes: { hurt1: 2, hurt2: 3 } });

export function panel(options = {}) {
    const doc = setupDom();
    const model = panelModel({ resolve: readResolve(result()), state: after, before, roleOf });
    return { doc, model, node: buildPanel(doc, model, options) };
}

export function mes(doc, build) {
    const message = makeMessage(doc, 5), text = message.querySelector('.mes_text');
    text.textContent = '';
    build(text, tag => doc.createElement(tag), value => doc.createTextNode(value));
    return { message, text };
}
export const kids = text => text.children.map(node => `${node.tagName.toLowerCase()}:${node.textContent}`);
export const spot = doc => { const node = doc.createElement('div'); node.className = BATTLE_ROOT; node.textContent = 'PANEL'; return node; };

export async function world(t, { feature = true } = {}) {
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    await defineAll(host, [characterDefinition('wessel', 'Wessel'), characterDefinition('ren', 'Ren'), skillsDefinition('wessel-skills', 'Wessel'), foesDefinition()]);
    await setField(host, 'foes', 'foe1', 'Sluice Rat A');
    const first = await host.send('To the quay.', 'The quay.\n\n[battle]\n\nAfter.');
    const head = host.store.headIndex();
    await setField(host, 'foes', 'hurt1', 2);
    host.ctx.chat[head].extra.storySuite.receipts.push({ id: 'rc_rpg0001', type: RESOLVE, module: 'story-block', cause: 'system', summary: '', narrate: false, rev: 99, data: { v2: { result: result() } } });
    const doc = setupDom();
    doc.defaultView = { localStorage: memory() };
    const log = createBattleLog({ ctx: host.ctx, doc, store: host.store, featureOn: () => feature, roleOf, events: host.events });
    t.after(() => log.destroy());
    return { host, doc, log, head, first };
}
export const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };
export function message(doc, index, build) {
    const el = makeMessage(doc, index), text = el.querySelector('.mes_text');
    text.textContent = '';
    build(text, tag => doc.createElement(tag));
    return el;
}
export const prose = (...lines) => (root, el) => { for (const line of lines) { const p = el('p'); p.textContent = line; root.appendChild(p); } };
