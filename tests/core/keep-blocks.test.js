// HISTKEEP: the host setting `keepRecentBlocks` (default on) keeps the narrator's own change block on the two newest replies of the
// reply's own prompt. Off, every prompt is what origin/main sent (fixture recorded there); on, only those two replies change and the
// chat's records and state are the same as main's at every step (swipe, swipe back, edited Re-read grown and shrunk, middle delete,
// rewind, reload, chat change).
// FU147 patched the fixture by script (not re-recorded) for two intended changes only: the item grammar line ends with the supplies sentence,
// and `Carried:` lists supplies first (the lamp).
// FU147b patched it by script again: the reworded supplies sentence (it names `kind: supply`), the lamp and bread on a `Supplies:` line of their own, and the state
// hashes the new `supplyKind` rule mark moves (with the mark left out, the old hashes still matched).
// ARS-ENGINE-FIX patched only the state hashes by script, the same way, for the new rule mark `packPlaceIds`.
// Patched the same way for the new rule mark `xpAimedFirst`.
// And for the new rule mark `hitWear`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../testkit/index.js';
import { withAssist } from '../../core/capture.js';
import { keepBlocks, KEEP_REPLIES } from '../../core/turn/keep-blocks.js';
import { seedCrypto } from '../suite/qa/helpers/seeded.js';
import { compact, runScript, said } from './keep-blocks.helpers.js';

const MAIN = JSON.parse(readFileSync(new URL('./fixtures/keep-blocks-main.json', import.meta.url), 'utf8'));
const seeded = async keep => { const restore = seedCrypto(42); try { return await runScript(keep); } finally { restore(); } };
const replies = step => step.prompt.filter(line => line.startsWith('assistant:')).map(line => line.slice('assistant:'.length));
const stepOf = (steps, name) => steps.find(step => step.name === name);

test('off (stored false): every step sends what origin/main sent and keeps the same records and state', async () => {
    assert.deepEqual(compact(await seeded(false)), MAIN);
});

test('default (not stored): on', async () => {
    assert.deepEqual(compact(await seeded(null)), compact(await seeded(true)));
    assert.notDeepEqual(compact(await seeded(null)), MAIN, 'the default is not main\'s prompts');
});

test('on: the two newest replies keep the narrator\'s own block, older ones lose it; records and state are main\'s at every step', async () => {
    assert.equal(KEEP_REPLIES, 2);
    const on = compact(await seeded(true));
    assert.deepEqual(on.map(step => [step.name, step.stateHash, step.text]), MAIN.map(step => [step.name, step.stateHash, step.text]), 'replay == live: only prompts differ');
    assert.deepEqual(replies(stepOf(on, 'four')).slice(-3), ['You buy bread.', 'You walk on.', 'A lamp lies here.\n\n<Changes>\n+ item Lamp\n</Changes>'], 'a miss counts as one of the two');
    assert.deepEqual(replies(stepOf(on, 'swipe')).slice(-2), ['You buy bread.\n\n<Changes>\n+ item Bread\n</Changes>', 'You walk on.'], 'the reply being swiped is not in its own prompt');
    assert.deepEqual(replies(stepOf(on, 'grown')).slice(-1), ['You take it and a cup.\n\n<Changes>\n+ item Coin\n+ item Cup\n</Changes>'], 'an edited Re-read (grown) shows its new block');
    assert.deepEqual(replies(stepOf(on, 'shrunk')).slice(-2), ['You take it and a cup.\n\n<Changes>\n+ item Coin\n+ item Cup\n</Changes>', 'You go on, empty-handed.'], 'an edited Re-read (emptied) shows none');
    assert.deepEqual(replies(stepOf(on, 'middle delete')).slice(-2), ['You go on, empty-handed.', 'You stop.\n\n<Changes>\n+ item Stone\n</Changes>']);
    assert.deepEqual(replies(stepOf(on, 'reload')).slice(-2), ['You stop.\n\n<Changes>\n+ item Stone\n</Changes>', 'You rest.\n\n<Changes>\n+ item Blanket\n</Changes>'], 'a reload keeps the same two');
    assert.deepEqual(replies(stepOf(on, 'other chat')), ['The story begins.'], 'another chat has none of this chat\'s blocks');
    for (const step of on.filter(item => item.prompt)) {
        const older = replies(step).slice(0, -KEEP_REPLIES);
        assert.ok(older.every(text => !text.includes('<Changes>') && !text.includes('STORY_SUITE_V2')), `${step.name}: older replies stay stripped`);
        assert.ok(replies(step).every(text => !text.includes('STORY_SUITE_V2')), `${step.name}: never the hidden comment`);
    }
});

test('on: only the narrator\'s own lines come back: no repair or assist lines, no echo section, nothing from a block it was cut off in', () => {
    const own = 'Story one.\n\n<!-- STORY_SUITE_V2\n<Changes>\n+ item Rope\n</Changes>\n<Changes-echo>\n+ item Rope\n</Changes-echo>\n-->';
    const repaired = withAssist('Story two.', ['+ item Lamp'], { repair: true });
    const cut = 'Story three.\n\n<!-- STORY_SUITE_V2 open\n<Changes>\n+ item Bre\n</Changes>\n-->';
    const strip = text => String(text).replace(/\s*<!--[\s\S]*?-->/g, '');
    for (const [text, want] of [[own, 'Story one.\n\n<Changes>\n+ item Rope\n</Changes>'], [repaired, 'Story two.'], [cut, 'Story three.']]) {
        const chat = [{ role: 'assistant', content: strip(text) }];
        keepBlocks(chat, [text], strip);
        assert.equal(chat[0].content, want);
    }
    // A list of parts: the block goes after the last text part.
    const parts = [{ type: 'text', text: own }, { type: 'image_url', image_url: { url: 'x' } }];
    const chat = [{ role: 'assistant', content: parts.map(part => (part.text ? { ...part, text: strip(part.text) } : part)) }];
    const added = keepBlocks(chat, [parts], content => content.map(part => (part.text ? { ...part, text: strip(part.text) } : part)));
    assert.equal(chat[0].content[0].text, 'Story one.\n\n<Changes>\n+ item Rope\n</Changes>');
    assert.equal(added, '\n\n<Changes>\n+ item Rope\n</Changes>'.length);
});

test('on: a quiet prompt gets no block; a Continue leaves the reply it continues as it is and keeps the two before it', async () => {
    const host = await createHost({ settings: { core: { keepRecentBlocks: true } } });
    try {
        await host.send('One.', said('Reply one.', ['+ item Rope']));
        await host.send('Two.', said('Reply two.', ['+ item Lamp']));
        const quiet = await host.quiet('summary');
        assert.ok(!JSON.stringify(quiet.request).includes('<Changes>\\n+ item'), 'a quiet prompt has none');
        await host.send('Three.', 'Half a reply');
        const { request } = await host.cont(said(' and the rest.', ['+ item Map']));
        const texts = request.chat.filter(m => m.role === 'assistant').map(m => m.content);
        assert.deepEqual(texts.slice(-3), ['Reply one.\n\n<Changes>\n+ item Rope\n</Changes>', 'Reply two.\n\n<Changes>\n+ item Lamp\n</Changes>', 'Half a reply']);
    } finally { host.close(); }
});

test('on: the echo guard inside one reply holds: a line written in the story and listed in the block is read once and shown once', async () => {
    for (const keep of [false, true]) {
        const host = await createHost({ settings: { core: { keepRecentBlocks: keep } } });
        try {
            await host.send('Look.', 'You find a rope.\n\n+ item Rope\n\n<Changes>\n+ item Rope\n</Changes>');
            const { request } = await host.send('Go.', 'You go.');
            const stack = Object.values(host.head().domains.inventory.stacks);
            assert.deepEqual(stack.map(item => [item.def, item.qty]), [['story/rope', 1]], `keep ${keep}: one rope`);
            const last = request.chat.filter(m => m.role === 'assistant').at(-1).content;
            assert.equal(last, keep ? 'You find a rope.\n\n<Changes>\n+ item Rope\n</Changes>' : 'You find a rope.');
        } finally { host.close(); }
    }
});
