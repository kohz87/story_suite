import assert from 'node:assert/strict';
import { STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { createBoardView } from '../../../../modules/rpg/board/view.js';
import { boardSession, discardBoard, openBoard, stageExchange, boardApi } from '../../../core/helpers/board-port.js';
import { page, begin, makeBlocks, settle } from '../view/page.js';

export async function defineFoes(host, entries) {
    const foes = structuredClone(STANDARD_TEMPLATES.find(item => item.definition.role === 'foes').definition);
    entries.forEach(([name, count, level, hurt], at) => {
        Object.assign(foes.state[`foe${at + 1}`], { default: name });
        Object.assign(foes.state[`count${at + 1}`], { default: count });
        Object.assign(foes.state[`level${at + 1}`], { default: level });
        Object.assign(foes.state[`hurt${at + 1}`], { default: hurt });
    });
    const defined = await host.sdk.command('dm.define', { definition: foes });
    assert.equal(defined.ok, true, defined.message);
}

export function renderMembers(t, { doc, host, members, order, rounds = [], oldArea = false }) {
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    assert.equal(openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } }).error, undefined);
    if (oldArea) delete boardSession(meta).setup.areaAll;   // a fight staged before `areaAll`: it keeps the main-group choice
    const board = createBoardView({ doc, headState: () => host.head(), meta: () => meta, store: host.store, interaction: boardApi(meta, () => host.head(), host.store.carrierSid(host.store.headIndex())),
        rules: () => ({ ...STANDARD_FORMULA, levelDivisor: 5 }), query: (name, args) => host.sdk.query(name, args),
        readerName: () => 'Wessel', levels: () => ({ ranks: [], playerRank: null }), on: () => true });
    const root = doc.createElement('div');
    let handles = [];
    doc.body.appendChild(root);
    const snapshot = { session: boardSession(meta), played: { state: host.head(), result: { members, order, rounds, opening: [], quickStart: [],
        idle: [], hurts: [], refused: [], stop: 'open' } }, heldSid: null };
    const draw = () => {
        for (const handle of handles) handle.destroy?.();
        handles = [];
        root.replaceChildren();
        board.render(root, snapshot, draw, handles, {});
    };
    draw();
    t.after(() => { for (const handle of handles) handle.destroy?.(); board.destroy(); });
    return root;
}

export async function showStop(t, { character = {}, skills = {}, settings = {}, foes, action, stop }) {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    for (const [key, value] of Object.entries(settings)) host.settings.set('story-block', key, value);
    await begin(host);
    await makeBlocks(host, { character, skills });
    await defineFoes(host, foes);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    const rules = { ...STANDARD_FORMULA, levelDivisor: 5 };
    let result = null;
    for (let attempt = 0; attempt < 100 && result?.stop !== stop; attempt += 1) {
        if (boardSession(meta)) discardBoard(meta);
        assert.equal(openBoard(meta, host.head(), { sid, rules }).error, undefined);
        const staged = stageExchange(meta, host.head(), action);
        assert.equal(staged.error, undefined, staged.error);
        result = staged.preview.result;
    }
    assert.equal(result?.stop, stop, `the seeded exchanges reach a ${stop} fight`);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    return { doc, result };
}

export const AREA_MEMBERS = [
    { slot: 11, group: 1, n: 1, name: 'Bristle-boar 1', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true },
    { slot: 12, group: 1, n: 2, name: 'Bristle-boar 2', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true },
    { slot: 13, group: 1, n: 3, name: 'Bristle-boar 3', value: 0, size: 4, pack: false, count: 1, left: 0, attacks: 0, standing: false },
    { slot: 21, group: 2, n: 1, name: 'Spiders', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true },
    { slot: 31, group: 3, n: 1, name: 'Worms', value: 0, size: 4, pack: false, count: 1, left: 0, attacks: 0, standing: false },
];
export const AREA_ORDER = [{ id: 'c:wessel', name: 'Wessel', party: true }, { id: 'f:11', party: false }, { id: 'f:12', party: false }, { id: 'f:21', party: false }];
export async function areaBoard(t, opts) {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { skills: { skill1: 'Shadow Cut', about1: 'sweep every foe', uses1: 'mana' } });
    await defineFoes(host, [['Bristle-boar', 3, 1, 5], ['Spiders', 2, 1, 5], ['Worms', 2, 1, 5]]);
    return { host, root: renderMembers(t, { doc, host, members: AREA_MEMBERS, order: AREA_ORDER, ...opts }) };
}
