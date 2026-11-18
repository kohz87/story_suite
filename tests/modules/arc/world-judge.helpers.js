// Shared set-up for the Director judge tests: a host with the Story Director module, a pack with one Active event (The succession, outcomes heir-crowned and
// regency), a scripted planner and a scripted judge (told apart by their system text), the arc controller, and the counts of calls made to each.
import { createFakeModel, createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { createArcController } from '../../../modules/arc/index.js';
import { browserStore, createReveal } from '../../../modules/director/screens/reveal.js';
import { overrideWorld } from '../../../modules/world/chronicle/world-daily/read-world.js';
import { JUDGE_SYSTEM } from '../../../modules/arc/judge/prompt.js';

export const FEATURE = 'story-director.world-events';
export const TAIL_KEY = 'story_suite_tail_1';
export const said = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const sent = (host, key) => host.st.promptLog.filter(entry => entry.key === key && entry.value).map(entry => entry.value);
export const OPENING = said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']);
// "Settlement" decides the succession without naming an outcome id: the code guard cannot see it, the judge can.
export const PLAN = '<plan>\nARC: Succession — a crown in doubt\nBEAT: Refugees — families leave Highmark\nBEAT: Settlement — the lords settle who rules\nCLOCK: Rumours — whispers grow | due: in 2 days\nHOOK: Letter — a sealed letter\n</plan>';
const PACK = JSON.stringify({ id: 'judge', version: '1.0.0', name: 'Judge', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: {
    places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }],
    lore: [{ title: 'The Crown', keys: ['crown', 'Highmark'], text: 'The crown passes by the high lords\' vote.' }, { title: 'The Vault', keys: ['vault', 'Highmark'], text: 'SECRET-VAULT-TEXT lies under the keep.', hidden: true, gate: 'fact:vault-open' }],
    cast: [{ id: 'aldric', name: 'Aldric', kind: 'figure', protected: true }],
} });
const PACK_MIN = JSON.stringify({ id: 'judge', version: '1.0.0', name: 'Judge', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: { places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }] } });
const SPEC = {
    realms: [{ name: 'March Realm', regions: ['The March'] }],
    events: [{
        id: 'succession', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '1 day' }, ends_when: { for: '9 days' }, title: 'The succession', summary: 'The king is dead.',
        outcomes: [{ name: 'heir-crowned', weight: 1 }, { name: 'regency', weight: 1 }],
    }],
};
export const NOTE = 'NOTE: The succession is undecided; the March is uneasy and the crown passes by the lords\' vote.';
export const ACCEPT_ALL = `1: accept\n2: accept\n3: accept\n${NOTE}`;

// The host's sdk with `extra` laid over the world brief (the controller's query), e.g. the unlearned secrets NPC State would give it.
const withBrief = (sdk, extra) => Object.create(sdk, { query: { value: (name, args) => {
    const out = sdk.query(name, args);
    return name === 'chronicle.world.brief' && out ? { ...out, ...extra } : out;
} } });

/** `judge`: the judge's scripted answers (string, Error, { hang }, function); `plans`: the planner's; `brief`: laid over the world brief. → { host, arc, store, judged (the judge's calls), planned, setChat, done }. */
export async function setUp(on, { judge = [ACCEPT_ALL], plans = [PLAN], lore = true, brief = null } = {}) {
    const undo = overrideWorld(world => ({ ...world, ...SPEC }));
    const judgeModel = createFakeModel(judge, { fallback: ACCEPT_ALL });
    const planModel = createFakeModel(plans, { fallback: PLAN });
    const model = Object.assign((prompt, options) => (String(options?.system ?? '') === JUDGE_SYSTEM ? judgeModel(prompt, options) : planModel(prompt, options)), { calls: [] });
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ callModel: model, modules: [module] });
    if (on) host.features.set(FEATURE, true);
    if (!(await host.packs.packs.install(lore ? PACK : PACK_MIN, { origin: 'pack.json' })).ok) throw new Error('pack not installed');
    const store = browserStore(null);
    let chatId = 'chat-1';
    const reveal = createReveal({ store, chatId: () => chatId, settings: () => host.sdk.settings('story-director') });
    const arc = createArcController({ sdk: () => (brief ? withBrief(host.sdk, brief) : host.sdk), chat: () => host.ctx.chat, chatId: () => chatId, store, reveal, notify: () => {} });
    return { host, arc, store, judged: judgeModel.calls, planned: planModel.calls, setChat: id => { chatId = id; }, done: () => { host.close(); undo(); } };
}
