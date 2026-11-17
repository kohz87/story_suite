// Live round 1 fixes: the repair's state lines name the open hooks and quests (LR1-1), a tag named in code is not a block (LR1-2), minutes in the time grammar (LR1-3),
// and the Problems list kept across a reload (LR1-5).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractBlock, hideBlock, parseChanges } from '../../../core/capture.js';
import { findBlocks } from '../../../core/capture/blocks-parts/find.js';
import { fitState } from '../../../modules/assist/repair-parts/state-fit.js';
import { openThreadLines } from '../../../core/runtime-parts/open-threads.js';
import { REPAIR_FOOT, repairPrompt, whereWhy, refusedWhy } from '../../../modules/assist/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

const T10 = 'Story Suite maintains persistent records through `<Changes>` entries (`+ quest` with `due:`, `+ clock`, and `+ beat` or `+ world`) while keeping narrative replies free of separate inline state. I will log any active deadlines in `<Changes>` as they happen.\n\n**Current status — 07:00 am, Bluewatch Village**\n* **Raiders seen so far:** 0.\n\nWhenever you are ready, let me know what Astra does next.';
const LOG = '/home/raven/story_suite/scratch/batch/SMALL/night/liver1/driver/logs/live-replies.jsonl';

// A host with the Director (hooks, quests and the clock) and the repair on, as the page has it.
async function directorHost(callModel) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ realDefaults: true, modules: [module], callModel });
    host.ctx.name1 = 'Astra';
    return host;
}
const rows = host => host.turn.problems().map(({ code, message }) => `${code}:${message}`);

test('LR1-2: a tag named inside inline code or a fenced code block is not a block; a real block still is', () => {
    assert.equal(extractBlock(T10), null);
    assert.equal(hideBlock(T10), T10, 'nothing hidden, no open mark');
    const fenced = 'Use it like this:\n\n```\nwrite <Changes> and then lines\n```\n\nThat is all.';
    assert.equal(extractBlock(fenced), null);
    assert.equal(hideBlock(fenced), fenced);
    assert.equal(/open/.test(hideBlock('Write `<Changes>` and `</Changes>` yourself.')), false);
    const real = 'A line with `<Changes>` in it.\n\nThe room is quiet.\n<Changes>\n+ item `Rope` | qty: 1\n</Changes>';
    assert.deepEqual(extractBlock(real).split('\n').filter(Boolean), ['+ item `Rope` | qty: 1']);
    // Only a reply that ENDS inside a really opened block is cut off.
    assert.match(hideBlock('Quiet.\n<Changes>\n+ item Rope | qty: 1\n'), /STORY_SUITE_V2 open/);
    assert.equal(/STORY_SUITE_V2 open/.test(hideBlock('A `<Changes>` word.\nQuiet.\n<Changes>\n+ item Rope\n</Changes>')), false);
    assert.equal(/STORY_SUITE_V2 open/.test(hideBlock('Quiet.\n\n```\nthe <Changes> tag\n```\n')), false, 'an opening inside a fence is no cut-off block');
});

test('LR1-2: the recorded T10 reply (live-replies n=10) holds no block', { skip: !fs.existsSync(LOG) }, () => {
    const text = fs.readFileSync(LOG, 'utf8').trim().split('\n').map(JSON.parse).find(row => row.n === 10).mes.split('\n\n<!-- STORY')[0];
    assert.equal(extractBlock(text), null);
    assert.equal(/STORY_SUITE_V2 open/.test(hideBlock(text)), false);
});

test('LR1-2: a reply that names the tag in code and writes no block is repaired', { skip }, async () => {
    const prompts = [];
    const host = await directorHost(async prompt => { prompts.push(prompt); return '<Changes></Changes>'; });
    const reply = await host.send('How do you track?', T10);
    await wait(40);
    assert.equal(prompts.length, 1, 'the repair ran');
    assert.equal(/STORY_SUITE_V2 open/.test(host.ctx.chat[reply.index].mes), false);
    host.close();
});

test('LR1-1: the state lines list the open hooks and quests by name, and the foot says a listed lead is never added again', { skip }, async () => {
    const prompts = [];
    const host = await directorHost(async prompt => { prompts.push(prompt); return '<Changes></Changes>'; });
    await host.send('Hello.', 'A board of postings.\n<Changes>\n+ hook Grain storehouse rats — rats in the grain\n+ quest Palisade ditch crew — dig\n</Changes>');
    await host.send('I read the board.', 'You read about the rats in the storehouse again and walk on.');
    await wait(60);
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /The story before this reply:[\s\S]*\nOpen hooks: Grain storehouse rats\n/);
    assert.match(prompts[0], /\nOpen quests: Palisade ditch crew\n/);
    assert.match(REPAIR_FOOT, /A lead already listed under Open hooks or Open quests is never added again, whatever words the reply uses for it: write ~ or - for it only when the reply changes or closes it/);
    host.close();
});

test('LR1-1: openThreadLines lists active hooks and quests only, none when there are none', () => {
    const view = { state: { domains: { director: { threads: {
        a: { kind: 'hook', status: 'active', key: 'Grain rats' }, b: { kind: 'hook', status: 'closed', key: 'Old news' },
        c: { kind: 'quest', status: 'active', key: 'Ditch crew' }, d: { kind: 'secret', status: 'active', key: 'Hidden' },
    } } } } };
    assert.deepEqual(openThreadLines(view), ['Open hooks: Grain rats', 'Open quests: Ditch crew']);
    assert.deepEqual(openThreadLines({ state: { domains: {} } }), []);
    assert.deepEqual(openThreadLines(null), []);
});

test('LR1-3: the time grammar and foot offer minutes, ask for an estimate whenever the actions take time, and the wall accepts +Nm', () => {
    const prompt = repairPrompt('You walk and buy bread.', ['~ time <date> (the story time)'], [], null, 'Astra');
    assert.match(prompt, /! time \+20m \/ ! time \+2h \/ ! time \+1d \(time passes; minutes, hours or days, never a date\)/);
    assert.match(REPAIR_FOOT, /"! time \+Nm", "! time \+Nh" or "! time \+Nd"/);
    assert.match(REPAIR_FOOT, /Write a time line whenever what happens in the reply takes time, even with no clock time given: walking across the village and buying bread is about ! time \+20m/);
    assert.match(REPAIR_FOOT, /Never write a date, and write no time line when no time passed\./);
    for (const text of ['! time +20m', '! time +45m', '! time +2h', '! time +1d']) assert.equal(whereWhy(parseChanges(`<Changes>\n${text}\n</Changes>`).lines[0]), '', text);
    assert.notEqual(whereWhy(parseChanges('<Changes>\n! time midday\n</Changes>').lines[0]), '');
    assert.equal(refusedWhy({ op: '!', kind: 'time', name: '+20m', labels: {} }, null, { repair: true }), '');
});

test('LR1-3: a repaired "! time +20m" moves the clock 20 minutes and replays the same after a reload', { skip }, async () => {
    const host = await directorHost(async () => '<Changes>\n! time +20m\n</Changes>');
    await host.send('Hello.', 'Dawn.\n<Changes>\n~ time June 3, 1200, 07:00 am\n</Changes>');
    const before = host.sdk.query('time.now')?.minutes;
    await host.send('I walk to the baker and buy bread.', 'You cross the village and buy bread.');
    await wait(60);
    const after = host.sdk.query('time.now')?.minutes;
    assert.equal(after - before, 20);
    await host.turn.onChatChanged();
    assert.equal(host.sdk.query('time.now')?.minutes, after, 'reload');
    host.close();
});

test('LR1-5: the Problems list is kept with the chat and comes back after a reload (and only for its own chat)', { skip }, async () => {
    const host = await directorHost(async () => 'none');
    host.turn.report({ module: 'story-director', code: 'DUPLICATE', message: 'Grain storehouse rats is already tracked', quiet: true });
    host.turn.report({ code: 'PROBLEM', message: 'second', quiet: true });
    const before = rows(host);
    assert.equal(before.length >= 2, true);
    assert.equal(Array.isArray(host.ctx.chatMetadata.storySuiteProblems), true);
    // A fresh page: nothing in memory, the chat's metadata as it was saved.
    const saved = structuredClone(host.ctx.chatMetadata.storySuiteProblems);
    host.turn.clearProblems();
    assert.deepEqual(host.turn.problems(), []);
    assert.equal('storySuiteProblems' in host.ctx.chatMetadata, false, 'cleared rows are not kept');
    host.ctx.chatMetadata.storySuiteProblems = saved;
    await host.turn.onChatChanged();
    assert.deepEqual(rows(host), before, 'reload');
    // Another chat (no kept rows) shows none.
    delete host.ctx.chatMetadata.storySuiteProblems;
    await host.turn.onChatChanged();
    assert.deepEqual(host.turn.problems(), [], 'a chat with none');
    host.close();
});

test('F1: a block a model wraps in a code fence is still a block (replies 48, 143, 144 of the 200), as on main', () => {
    const replies = JSON.parse(fs.readFileSync(new URL('../../suite/break/helpers/replies-200.json', import.meta.url), 'utf8'));
    for (const n of [48, 143, 144]) assert.equal(findBlocks(replies[n], 'Changes').length, 1, `reply ${n}`);
    const fenced = 'Quiet.\n\n```\n<Changes>\n+ item Rope\n</Changes>\n```\n';
    assert.deepEqual(extractBlock(fenced).split('\n').filter(Boolean), ['+ item Rope']);
});

test('F1: a fenced block cut off and then continued reads as the same one block', () => {
    const cut = 'Quiet.\n```\n<Changes>\n+ item A\n';
    const blocks = findBlocks(cut, 'Changes');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].open, true);
    const joined = `${cut}+ item B\n</Changes>\n\`\`\`\n`;
    const done = findBlocks(joined, 'Changes');
    assert.equal(done.length, 1);
    assert.equal(done[0].open, undefined);
    assert.match(done[0].body, /item A[\s\S]*item B/);
});

test('F1: a stray fence does not hide a later block; a mention in a fence or in inline code still is no block', () => {
    assert.equal(findBlocks('a\n```\nb\n<Changes>\n+ item A\n</Changes>\nc\n```\n', 'Changes').length, 1);
    assert.equal(findBlocks('a\n```\nb\nQuiet.\n<Changes>\n+ item A\n</Changes>\n', 'Changes').length, 1);
    assert.equal(findBlocks('Use:\n```\nwrite <Changes> here\n```\nDone.', 'Changes').length, 0);
    assert.equal(findBlocks(T10, 'Changes').length, 0);
});

test('F2: the open lines are the newest 20, capped by length, before Carried, and the prompt limit never cuts them', () => {
    const threads = {};
    for (let i = 0; i < 30; i += 1) threads[`h${i}`] = { kind: 'hook', status: 'active', key: `Hook number ${i}` };
    const lines = openThreadLines({ state: { domains: { director: { threads } } } });
    assert.match(lines[0], /^Open hooks: Hook number 10; /);
    assert.match(lines[0], /Hook number 29$/);
    assert.equal(lines[0].split('; ').length, 20);
    const long = {};
    for (let i = 0; i < 20; i += 1) long[`q${i}`] = { kind: 'quest', status: 'active', key: `${i} ${'x'.repeat(58)}` };
    const quests = openThreadLines({ state: { domains: { director: { threads: long } } } })[0];
    assert.equal(quests.length <= 620, true);
    assert.match(quests, /19 x+$/, 'the newest stay');
    const state = ['Place: Mill', 'Wallet: 8', 'Open hooks: Rats', `Carried: ${'rope, '.repeat(800)}`];
    const fit = fitState(state, 2500);
    assert.equal(fit.length <= 2500, true);
    assert.match(fit, /Open hooks: Rats\n/);
    assert.equal(fit.includes('Carried:'), true);
    const prompt = repairPrompt('Walk.', [], [...state.slice(0, 3), `Carried: ${'rope, '.repeat(800)}`], null, 'A');
    assert.match(prompt, /Open hooks: Rats\n/);
});

test('F2: the state lines put the open lines before Carried', { skip }, async () => {
    const prompts = [];
    const host = await directorHost(async prompt => { prompts.push(prompt); return '<Changes></Changes>'; });
    await host.send('Hello.', 'A board.\n<Changes>\n+ hook Grain rats — rats\n+ item Rope\n</Changes>');
    await host.send('Read.', 'You walk on.');
    await wait(60);
    assert.match(prompts[0], /\nOpen hooks: Grain rats\nCarried: Rope\n/);
    host.close();
});

test('F3: a problem raised after the chat changed never copies the old chat\'s rows into the new chat', { skip }, async () => {
    const host = await directorHost(async () => 'none');
    host.turn.report({ code: 'PROBLEM', message: 'old chat row', quiet: true });
    assert.equal(host.ctx.chatMetadata.storySuiteProblems.length, 1);
    // The next chat: its own metadata (none kept), a late problem of the old chat arrives while the chat is still loading.
    host.ctx.chatMetadata = {};
    const changing = host.turn.onChatChanged();
    host.turn.report({ code: 'PROBLEM', message: 'late', quiet: true });
    await changing;
    assert.equal(rows(host).some(row => /old chat row/.test(row)), false, 'the old rows are gone');
    assert.equal((host.ctx.chatMetadata.storySuiteProblems ?? []).some(row => /old chat row/.test(row.message)), false);
    host.close();
});

test('F3: a problem raised while a chat loads does not overwrite that chat\'s kept rows, and both are listed', { skip }, async () => {
    const host = await directorHost(async () => 'none');
    host.ctx.chatMetadata = { storySuiteProblems: [{ code: 'PROBLEM', message: 'kept', quiet: true, at: 1 }] };
    const changing = host.turn.onChatChanged();
    host.turn.report({ code: 'PROBLEM', message: 'during', quiet: true });
    await changing;
    assert.deepEqual(host.turn.problems().map(row => row.message), ['kept', 'during']);
    assert.deepEqual(host.ctx.chatMetadata.storySuiteProblems.map(row => row.message), ['kept', 'during']);
    host.close();
});

test('F4: the Problems rows kept with the chat follow a Re-read that drops the row (events-hooks keepLog)', { skip }, async () => {
    let n = 0;
    const host = await directorHost(async () => { n += 1; if (n < 2) throw new Error('no connection'); return '<Changes>\n+ item Rope | qty: 1\n</Changes>'; });
    const turn = await host.send('Hello.', 'You take a rope.');
    await wait(80);
    assert.equal((host.ctx.chatMetadata.storySuiteProblems ?? []).some(row => row.code === 'NO_CHANGES'), true, 'the row is kept');
    await host.sdk.reread(turn.index);
    await wait(80);
    assert.equal(host.turn.problems().some(row => row.code === 'NO_CHANGES'), false);
    assert.equal((host.ctx.chatMetadata.storySuiteProblems ?? []).some(row => row.code === 'NO_CHANGES'), false, 'the dropped row is dropped from the kept list too');
    host.close();
});

test('F4: the repair prompt holds a state longer than 1500 characters, and keeps an open line that follows a long one', () => {
    const state = [`Place: ${'a'.repeat(1800)}`, 'Open hooks: Rats'];
    const prompt = repairPrompt('Walk.', [], state, null, 'A');
    assert.match(prompt, /Place: a{1800}\n/);
    assert.match(prompt, /\nOpen hooks: Rats\n/);
    const huge = repairPrompt('Walk.', [], [`Place: ${'a'.repeat(5000)}`, 'Open hooks: Rats'], null, 'A');
    assert.match(huge, /\nOpen hooks: Rats\n/, 'never cut');
});
