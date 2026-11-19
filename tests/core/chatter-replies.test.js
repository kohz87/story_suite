// Query `chatter.replies`: every reply's own Inner chatter, read from its own text (a swipe, a delete and a reload give the same).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { CHATTER_FEATURE, CHOICES_FEATURE, replyChatter, replyChoices } from '../../modules/scene/extras.js';

const block = (story, list) => `${story}\n\n<Changes>\n${list.join('\n')}\n</Changes>`;

test('two replies each keep their own chatter; the greeting and the reader have none', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { [CHATTER_FEATURE]: true } } });
    t.after(() => host.close());
    await host.send('Hello.', block('The road.', ['~ chatter Mira: first thought']));
    await host.send('Look.', block('The gate.', ['~ chatter Kell: second thought', '~ chatter Mira: third thought']));
    const all = host.sdk.query('chatter.replies');
    assert.equal(all.length, 2);
    assert.deepEqual(all.map(item => item.lines.map(line => line.text)), [['first thought'], ['second thought', 'third thought']]);
    assert.notEqual(all[0].index, all[1].index);
    // a swipe: the same reply with other text shows that text's chatter
    host.ctx.chat[all[1].index].mes = block('The gate, again.', ['~ chatter Kell: swiped thought']);
    const swiped = host.sdk.query('chatter.replies');
    assert.deepEqual(swiped.map(item => item.lines.map(line => line.text)), [['first thought'], ['swiped thought']]);
    // a delete leaves the remaining reply with its own
    host.ctx.chat.splice(all[1].index - 1, 2);
    assert.deepEqual(host.sdk.query('chatter.replies').map(item => item.lines.map(line => line.text)), [['first thought']]);
});

test('replyChatter skips faded replies, system messages and the greeting', () => {
    const display = mes => ({ chatter: mes ? [{ name: 'A', text: mes }] : [] });
    const chat = [{ mes: 'greeting' }, { is_user: true, mes: 'hi' }, { mes: 'one' }, { mes: 'two', is_system: true }, { mes: 'three' }, { mes: '' }];
    assert.deepEqual(replyChatter(chat, new Set([4]), display).map(item => [item.index, item.lines[0].text]), [[2, 'one']]);
    assert.deepEqual(replyChatter(chat, new Set(), display).map(item => item.index), [2, 4]);
    assert.deepEqual(replyChatter([{ mes: 'greeting' }], new Set(), display), []);
});

test('Inner chatter off: the query is a gap', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { [CHATTER_FEATURE]: false } } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    assert.ok(!host.sdk.query('chatter.replies')?.length);
});

test('choices.replies: each reply keeps its own choices; a swipe shows the swiped text\'s', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { [CHOICES_FEATURE]: true } } });
    t.after(() => host.close());
    await host.send('Hello.', block('The road.', ['? choice Walk on', '? choice Rest']));
    await host.send('Look.', block('The gate.', ['? choice Knock']));
    const all = host.sdk.query('choices.replies');
    assert.deepEqual(all.map(item => item.choices), [['Walk on', 'Rest'], ['Knock']]);
    host.ctx.chat[all[1].index].mes = block('The gate, again.', ['? choice Climb', '? choice Leave']);
    assert.deepEqual(host.sdk.query('choices.replies').map(item => item.choices), [['Walk on', 'Rest'], ['Climb', 'Leave']]);
    const display = mes => ({ choice: mes ? [{ text: mes }] : [] });
    assert.deepEqual(replyChoices([{ mes: 'g' }, { is_user: true, mes: 'u' }, { mes: 'a' }, { mes: '' }], new Set(), display), [{ index: 2, choices: ['a'] }]);
});
