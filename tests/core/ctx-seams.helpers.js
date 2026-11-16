import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../testkit/index.js';
import { isMetaSpan } from '../../core/replay.js';
import { readRecord } from '../../core/persist.js';

export const reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const OWNER = 'cs-seams';

export function seams({ giveProof = false } = {}) {
    const mark = (ctx, id) => {
        const cursor = ctx.cursor();
        const epoch = ctx.epoch;
        ctx.draft('cs').marks[id] = { cursor, epoch };
        ctx.replayGuard({ owner: OWNER, version: 2, epoch, rulesHash: null, inputHash: ctx.hash({ id }), predicate: { kind: 'mark', id } });
        return { summary: `Marked ${id}.`, narrate: false };
    };
    return {
        id: OWNER, name: 'Seams', version: '0.0.1',
        domains: { cs: { initial: () => ({ marks: {}, steps: {}, lines: {}, ons: {} }) } },
        commands: {
            'cs.mark': (ctx, { id }) => mark(ctx, id),
            'cs.on'(ctx, { block }) {
                if (!Object.hasOwn(ctx.read('cs').lines, block)) ctx.fail('NOT_FOUND', 'That line is not there.');
                ctx.draft('cs').ons[block] = true;
                ctx.replayGuard({ owner: OWNER, version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash({ block }), predicate: { kind: 'on', block } });
                return { summary: 'On.', narrate: false };
            },
            'cs.step'(ctx, { needs } = {}) {
                if (needs && !ctx.read('cs').marks[needs]) ctx.fail('NO_LONGER_DONE', 'The required mark is gone.');
                const cursor = ctx.cursor();
                ctx.draft('cs').steps[cursor.block] = cursor;
                ctx.replayGuard({ owner: OWNER, version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash({ step: 'x' }), predicate: { kind: 'step' } });
                return { summary: 'Step.', narrate: false, replan: true };
            }, 'cs.peek': ctx => { ctx.draft('cs').marks.peek = { cursor: ctx.cursor(), epoch: ctx.epoch }; return { summary: 'Peeked.', narrate: false }; } },
        capture: {
            kinds: { mark: { grammar: '! mark Word' }, note: { grammar: '! note Word' } },
            apply(ctx, line) {
                if (line.kind !== 'note') return mark(ctx, line.name);
                const cursor = ctx.cursor();
                ctx.draft('cs').lines[cursor.block] = cursor;
                if (giveProof) ctx.call('cs.visit', {});
                ctx.replayGuard({ owner: OWNER, version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: ctx.hash({ note: line.name }), predicate: { kind: 'note' } });
                return { summary: `Noted ${line.name}.`, narrate: false };
            },
        },
        hooks: {
            replayGuard: ({ state }, { guard }) => (guard.predicate.kind === 'on' && !Object.hasOwn(state.domains.cs.lines, guard.predicate.block) ? { ok: false, reason: 'the line it stands on is gone' } : { ok: true }),
            afterCapture: () => ({ commands: Array.from({ length: steps.n }, () => ({ type: 'cs.step', payload: {} })) }),
        },
    };
}
export const steps = { n: 0 };

export async function upgraded(t, modules = [seams()]) {
    const image = JSON.parse(readFileSync(new URL('./helpers/fixtures/ctx-seams-main.json', import.meta.url), 'utf8'));
    const saved = JSON.stringify(readRecord(image.chat.at(-1)).spans[0]);
    const host = await createHost({ modules, st: { chat: image.chat } });
    t.after(() => host.close());
    host.ctx.chatMetadata = image.metadata;
    await host.turn.onChatChanged();
    assert.equal(JSON.stringify(readRecord(host.ctx.chat.at(-1)).spans[0]), saved, 'reload keeps the old span byte for byte');
    return { host, saved };
}

export async function started(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [seams()] });
    t.after(() => host.close());
    return host;
}
export const marks = host => host.head().domains.cs.marks;
export const blocks = host => host.ctx.chat.flatMap((message, index) => {
    const record = readRecord(message);
    return (record?.spans ?? []).filter(isMetaSpan).map(span => ({ index, span }));
});
export const boundaryOf = (host, id) => blocks(host).find(each => each.span.operation.payload?.id === id || each.span.operation.payload?.name === id || each.span.operation.payload?.raw?.includes(id)).span.boundaries[0].cursor;
export const ident = cursor => ({ sid: cursor.sid, swipeKey: cursor.swipeKey, block: cursor.block });
export const click = async (host, id) => {
    const done = await host.sdk.command('cs.mark', { id });
    assert.equal(done.ok, true, done.message);
};
export function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
