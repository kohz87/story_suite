// A test-only module with an interaction kind, registered next to the core on the real host (the pattern of probe-module.js). Nothing registers
// it outside tests. Its kind reads real domain state (`ia`: `lamp`, `luck`), so a witness, a replay and a take-back are checked against state that can move:
// `lamp` is witnessed (the settle stops when it changes), `luck` is read by `play` only after the witness (a kind with a narrow witness).
// Actors: the reader's own `hero` (named like the persona), and `mate`, played by the kind's `auto` (derived, never stored).

import { createInteractionApi } from '../../../../../../core/sdk/interaction.js';

export const IA_MODULE = 'ia-probe';
export const IA_KIND = `${IA_MODULE}/probe`;
export const IA_PLAYER = 'You';   // the fake context's persona (name1)

const dom = state => state?.domains?.ia ?? { lamp: 0, luck: 0, bag: 0 };

export const iaKind = (over = {}) => ({
    version: 1, title: 'Probe', feature: null, screen: `${IA_MODULE}/probe`, limits: { steps: 4, stepInputs: 2 },
    changes: ['ia.grant'], ready: () => true, marker: { word: 'probe' }, carry: true,
    actors: () => [{ id: 'hero', name: IA_PLAYER, party: true }, { id: 'mate', name: 'Ren', party: true }],
    open: (state, { anchor, args }) => ({ setup: { door: args?.door ?? 'north', anchor, round: 0 } }),
    witness: (state, setup) => ({ lamp: dom(state).lamp, door: setup.door }),
    validate: (state, setup, steps, step) => (step.inputs.length === 1 && step.inputs[0].actor === 'hero' && ['go', 'wait'].includes(step.inputs[0].choice) ? null : 'Choose go or wait.'),
    play(state, setup, steps, dice) {
        const last = steps.at(-1)?.inputs.find(input => input.actor === 'hero')?.choice ?? null;
        const mate = steps.at(-1)?.inputs.find(input => input.actor === 'mate')?.choice ?? null;
        const roll = steps.length ? dice(steps.length - 1)(1, 0, 6)() : 0;
        const stop = last === 'wait' ? 'done' : 'open';
        const result = { steps: steps.length, last, mate, roll, luck: dom(state).luck, total: roll + dom(state).luck, round: setup.round, stop };
        return { view: { lines: steps.map(step => step.inputs.map(input => `${input.actor}:${input.choice}`).join(',')) }, result, stop };
    },
    settle(state, setup, steps, dice) {
        const { result, stop } = iaKind().play(state, setup, steps, dice);
        return { result, stop, changes: [{ type: 'ia.grant', payload: { n: result.total } }] };
    },
    note: (result, setup, { opening } = {}) => (opening ? [`The probe opens (${result.opened}).`] : [`Probe round ${result.round}: ${result.last}, total ${result.total}.`]),
    // the reader's own hero gets a valid choice from the dice (go or wait), the companion keeps 'hum'
    auto: (state, setup, steps, actorId, dice) => ({ choice: actorId === 'hero' ? (dice(1, 0, 1)() ? 'go' : 'wait') : 'hum', args: { n: dice(1, 0, 6)() } }),
    opening: (state, setup, dice) => ({ result: { opened: dice(5, 0, 6)() }, changes: [] }),
    next: (setup, result) => ({ ...setup, round: setup.round + 1, from: result.total }),
    ...over,
});

/** The module definition: the `ia` domain, an internal grant (the kind's change), a `ia.set` UI command and a story line `! ia lampN` / `! ia luckN`. */
export function iaModule({ kind = iaKind(), hooks = null } = {}) {
    return {
        id: IA_MODULE, name: 'IA Probe', version: '0.0.0',
        domains: { ia: { initial: () => ({ lamp: 0, luck: 0, bag: 0 }), validate: slice => (['lamp', 'luck', 'bag'].every(key => Number.isInteger(slice[key]) && slice[key] >= 0) ? [] : ['ia numbers are whole']) } },
        commands: {
            'ia.grant': Object.assign((ctx, { n }) => { ctx.draft('ia').bag += n; return { summary: `Bag +${n}.`, narrate: false }; }, { internal: true }),
            'ia.set': (ctx, { key, value }) => { ctx.draft('ia')[key] = value; return { summary: `${key} ${value}.`, narrate: false }; },
        },
        capture: {
            kinds: { ia: { grammar: '! ia lamp3' } },
            apply(ctx, line) {
                const [, key, value] = /^(lamp|luck)(\d+)$/.exec(String(line.name ?? '').trim()) ?? [];
                if (!key) return ctx.fail('INVALID', 'Say lampN or luckN.');
                ctx.draft('ia')[key] = Number(value);
                return { summary: `${key} ${value}.`, narrate: false };
            },
        },
        interactions: { probe: kind },
        ...(hooks ? { hooks } : {}),
    };
}

/** `sdk.interaction` over a real host (the runtime wires none yet): the staged scratch is the host's chat metadata. */
export function iaApi(host, options = {}) {
    const store = host.store;
    return createInteractionApi({
        registry: host.registry, store, chat: () => host.ctx.chat, meta: () => host.ctx.chatMetadata, save: () => host.ctx.saveMetadata?.(),
        state: () => store.head(), head: () => ({ sid: store.carrierSid(store.headIndex()) }), persona: () => host.ctx.name1,
        // the state a kind's opening prelude leaves, which a session with an opening is played on (as the reply's preludes run)
        preview: (payload, seed, state) => { const run = host.bus.run('interaction.settle', payload, { cause: 'system', state, seed }); return run?.ok ? run.state : null; }, ...options,
    });
}

export const GO = { inputs: [{ actor: 'hero', choice: 'go' }] };
export const WAIT = { inputs: [{ actor: 'hero', choice: 'wait' }] };
const reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);

/** The reader's whole play of one segment: open (or stage on the open session), type a message (held), Send, regenerate. → { id, key, index }. */
export async function playSegment(host, api, step, text, replyText, { lines = [] } = {}) {
    const box = () => host.ctx.chatMetadata.storySuiteInteraction;
    let id = box()?.open?.id;
    if (!id) id = api.open(IA_KIND).id;
    const staged = api.stage(id, step);
    if (!staged.ok) return { error: staged };
    host.st.addUser(text);
    const held = await host.st.generate('normal', { reply: '' });
    const sent = api.send(id);
    if (!sent.ok) return { error: sent, held };
    const done = await host.regenerate(reply(replyText, lines));
    return { id, held, done, index: done.index };
}

export const box = host => host.ctx.chatMetadata.storySuiteInteraction;
export const codes = host => host.turn.problems().map(item => item.code);
/** Every settle block on the line now: [{ index, payload, result }]. */
export const activeSettles = host => host.store.receipts().filter(entry => entry.receipt.type === 'interaction.settle')
    .map(entry => ({ index: entry.index, payload: structuredClone(entry.receipt.replan.payload), result: structuredClone(entry.receipt.data.v2.result) }));
/** `A.` (sets `lamp`), then `segments` played segments, each by `playSegment`. → { a, s: [reply indexes] }. */
export async function iaChain(host, api, { segments = 2, lines = ['! ia lamp1'], step = GO } = {}) {
    await host.send('Hello.', reply('A.', lines));
    const s = [];
    for (let n = 0; n < segments; n += 1) s.push((await playSegment(host, api, step, `go${n}`, `S${n + 1}.`)).index);
    return { a: 2, s };
}
/** Replaces reply `index`'s text with `text` as a reader's edit does (the shown swipe too). */
export function setText(host, index, text) {
    const message = host.ctx.chat[index];
    message.mes = text;
    if (Array.isArray(message.swipes)) message.swipes[message.swipe_id ?? 0] = text;
}
export const withLines = (text, lines) => reply(text, lines);
