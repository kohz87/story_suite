// Choices and Inner chatter (MODULES §F115, src/v2/extras.js, src/v2/extras-ui.js): display kinds a reply
// may carry for the reader alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CHATTER_CHARS, CHATTER_FEATURE, CHOICE_CHARS, CHOICE_KEEP, CHOICES_FEATURE, cutPoints, displayLines, readChatter, readChoice,
} from '../../ui/legacy/extras.js';
import { block, REPLY, lastIndex, extrasOf, staticText, fresh } from './extras.helpers.js';

// ---------------------------------------------------------------------------------------------------
// Reading one line

test('a choice is text: markup stays text, invisible characters go, it is cut by code points', () => {
    assert.deepEqual(readChoice({ raw: '? choice <img src=x onerror=alert(1)> **now**' }).value, { text: '<img src=x onerror=alert(1)> now' });
    assert.deepEqual(readChoice({ raw: '- ? choice: Climb​ the‮ wall\n' }).value, { text: 'Climb the wall' });
    // A letter outside the BMP (a surrogate pair in UTF-16).
    const long = `? choice ${'𐐷'.repeat(200)}`;
    const text = readChoice({ raw: long }).value.text;
    assert.equal(Array.from(text).length, CHOICE_KEEP, 'at most the kept length, in code points');
    assert.ok(text.endsWith('…'));
    assert.ok(Array.from(text).slice(0, -1).every(point => point === '𐐷'), 'no character split in half');
    assert.match(readChoice({ raw: '? choice ...' }).error, /no text/);
});

test('a choice longer than the narrator is asked for (80) is kept whole up to 160, so a click sends all of it', () => {
    assert.equal(CHOICE_CHARS, 80);
    assert.equal(CHOICE_KEEP, 160);
    const long = 'Pay Sister Temiwa two silver, strip off the bloodied shirt and ask her to stitch it before the lye-wash';
    assert.ok(Array.from(long).length > CHOICE_CHARS && Array.from(long).length <= CHOICE_KEEP);
    assert.equal(readChoice({ raw: `? choice ${long}` }).value.text, long);
});

test('a 200-character thought is kept whole; a 300-character one is cut to 240 with an ellipsis', () => {
    assert.equal(CHATTER_CHARS, 240);
    assert.equal(readChatter({ raw: `~ chatter Minke: ${'a'.repeat(200)}` }).value.text, 'a'.repeat(200));
    const cut = readChatter({ raw: `~ chatter Minke: ${'b'.repeat(300)}` }).value.text;
    assert.equal(Array.from(cut).length, 240);
    assert.equal(cut, `${'b'.repeat(239)}…`);
});

test('a chatter line is a name and a thought; no name or no thought is refused', () => {
    assert.deepEqual(readChatter({ raw: '~ chatter Minke: …he\'d better not die down there' }).value, { name: 'Minke', text: '…he\'d better not die down there' });
    assert.deepEqual(readChatter({ raw: '~ chatter Jean-Luc — *keep moving*' }).value, { name: 'Jean-Luc', text: 'keep moving' });
    assert.deepEqual(readChatter({ raw: '~ chatter **Old Tam**: <b>bold</b> thought' }).value, { name: 'Old Tam', text: '<b>bold</b> thought' });
    const long = readChatter({ raw: `~ chatter ${'N'.repeat(90)}: ${'x'.repeat(400)}` });
    assert.match(long.error ?? '', /names no one/, 'a "name" past the speaker window is no name');
    const cut = readChatter({ raw: `~ chatter Minke: ${'ж'.repeat(400)}` }).value;
    assert.equal(Array.from(cut.text).length, CHATTER_CHARS);
    assert.match(readChatter({ raw: '~ chatter just a thought with no speaker' }).error, /names no one/);
    assert.match(readChatter({ raw: '~ chatter Minke:' }).error, /no thought/);
    assert.equal(cutPoints('abc', 3), 'abc');
});

// ---------------------------------------------------------------------------------------------------
// Capture on the real host

test('on: both grammar lines are in the static part, which stays byte-identical reply to reply', async t => {
    const host = await fresh(t);
    await host.send('Look.', 'You look.');
    const first = staticText(host);
    assert.match(first, /^\? choice /m);
    assert.match(first, /^~ chatter /m);
    await host.send('I look.', REPLY);
    await host.send('Then?', block('Later.', ['? choice Run', '~ chatter Minke: hm']));
    assert.equal(staticText(host), first);
});

test('off (the default): no grammar line, and a line written anyway is a quiet Problem, not a refusal', async t => {
    const host = await fresh(t, null);
    assert.ok(staticText(host).includes('<Changes>'), 'the static part was sent');
    assert.equal(host.features.on(CHOICES_FEATURE), false);
    assert.equal(host.features.on(CHATTER_FEATURE), false);
    assert.doesNotMatch(staticText(host), /choice|chatter/);
    await host.send('I look.', REPLY);
    const index = lastIndex(host);
    const off = host.turn.problems().filter(item => item.index === index);
    assert.deepEqual(off.map(item => [item.code, item.quiet]), [['FEATURE_OFF', true], ['FEATURE_OFF', true], ['FEATURE_OFF', true], ['FEATURE_OFF', true]]);
    assert.match(off[0].message, /Choices is turned off/);
    assert.match(off[2].message, /Inner chatter is turned off/);
    assert.deepEqual(extrasOf(host), {}, 'nothing to show while off');
    // The rest of the reply was used, and the lines are hidden like any block.
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Rope')?.qty, 1);
    assert.doesNotMatch(host.ctx.chat[index].mes.replace(/<!--[\s\S]*?-->/g, ''), /choice|chatter/);
    // B-a1-5 (beta-candidate break): turned on later, lines told as not used stay unshown (the hidden
    // comment marks them `off:`); a Re-read reads them again, and then they show.
    host.features.set(CHOICES_FEATURE, true);
    assert.deepEqual(extrasOf(host), {}, 'told as not used, so not shown when turned on');
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(extrasOf(host).choice.map(item => item.text), ['Climb the wall', 'Bribe the guard']);
});

test('display lines change no state: no receipt, no op, no meta.rev for them', async t => {
    const host = await fresh(t);
    const rev = host.head().meta.rev;
    await host.send('I look.', block('Quiet.', ['? choice Wait', '? choice Leave', '~ chatter Minke: …dull']));
    const index = lastIndex(host);
    assert.equal(host.head().meta.rev, rev, 'meta.rev did not move');
    assert.deepEqual(host.store.opsAt(index), []);
    assert.equal(host.store.receipts().filter(receipt => /choice|chatter/.test(receipt.type)).length, 0);
    assert.deepEqual(host.turn.problems().filter(item => item.index === index), []);
    assert.deepEqual(extrasOf(host), { choice: [{ text: 'Wait' }, { text: 'Leave' }], chatter: [{ name: 'Minke', text: '…dull' }] });
});

test('a long choice (over 80, up to 160) shows whole after the reply, a reload and a Re-read', async t => {
    const host = await fresh(t);
    const long = 'Pay Sister Temiwa two silver, strip off the bloodied shirt and ask her to stitch it before the lye-wash';
    await host.send('Hello.', block('The wash-house.', [`? choice ${long}`, '? choice Leave']));
    const index = lastIndex(host);
    assert.deepEqual(extrasOf(host).choice.map(item => item.text), [long, 'Leave']);
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual(extrasOf(host, index).choice.map(item => item.text), [long, 'Leave'], 'a Re-read reads it whole');
    // Nothing is stored for a choice: the reply keeps the line, so a reload reads the same text.
    assert.deepEqual(displayLines(JSON.parse(JSON.stringify(host.ctx.chat[index])).mes, { entryOf: word => host.registry.capture(word) }).choice[0].text, long);
});

test('hostile input: too many lines are Problems (first ones kept), markup and junk are refused or kept as text', async t => {
    const host = await fresh(t);
    const lines = [
        '? choice One', '? choice <script>alert(1)</script>', '? choice Three', '? choice Four', '? choice Five', '? choice Six',
        '~ chatter A: one', '~ chatter B: two', '~ chatter C: three', '~ chatter D: four',
        '~ chatter nobody speaks here', '? choice ***',
    ];
    await host.send('Go.', block('Chaos.', lines));
    const index = lastIndex(host);
    const told = host.turn.problems().filter(item => item.index === index);
    assert.deepEqual(told.map(item => [item.code, item.line]), [
        ['LIMITED', '? choice Five'], ['LIMITED', '? choice Six'], ['LIMITED', '~ chatter D: four'],
        ['INVALID', '~ chatter nobody speaks here'], ['INVALID', '? choice ***'],
    ]);
    assert.ok(told.every(item => item.quiet !== true), 'refusals are told on the card, not quietly');
    assert.match(told[0].message, /at most 4 choices/);
    const shown = extrasOf(host);
    assert.deepEqual(shown.choice.map(item => item.text), ['One', '<script>alert(1)</script>', 'Three', 'Four']);
    assert.deepEqual(shown.chatter.map(item => item.name), ['A', 'B', 'C']);
    // A line as long as the host reads (2,000 characters) is still cut, to the kept length.
    await host.send('More.', block('Long.', [`? choice ${'a'.repeat(1900)}`]));
    assert.equal(Array.from(extrasOf(host).choice[0].text).length, CHOICE_KEEP);
});

test('choices a Continue adds past the cap get the same "not applied" Problem as the original reply\'s', async t => {
    const host = await fresh(t);
    await host.send('Go.', block('The gate.', ['? choice One', '? choice Two', '? choice Three', '~ chatter A: one', '~ chatter B: two']));
    const index = lastIndex(host);
    assert.deepEqual(host.turn.problems().filter(item => item.index === index), []);
    await host.cont(`\n\nThe guard turns.\n\n${block('', ['? choice Four', '? choice Five', '? choice Six', '~ chatter C: three', '~ chatter D: four']).trim()}`);
    assert.equal(lastIndex(host), index, 'the same reply');
    const told = host.turn.problems().filter(item => item.index === index);
    assert.deepEqual(told.map(item => [item.code, item.line]), [['LIMITED', '? choice Five'], ['LIMITED', '? choice Six'], ['LIMITED', '~ chatter D: four']]);
    assert.match(told[0].message, /"\? choice Five" was not used: a reply shows at most 4 choices, and this one had more/);
    assert.ok(told.every(item => item.quiet !== true));
    // What the card shows agrees: the first four, in order; Re-read tells the same lines.
    assert.deepEqual(extrasOf(host).choice.map(item => item.text), ['One', 'Two', 'Three', 'Four']);
    assert.deepEqual(extrasOf(host).chatter.map(item => item.name), ['A', 'B', 'C']);
    const again = await host.turn.reread(index);
    assert.deepEqual((again?.problems ?? []).filter(item => item.code === 'LIMITED').map(item => item.line), ['? choice Five', '? choice Six', '~ chatter D: four']);
});

test('a Continue under the cap tells nothing', async t => {
    const host = await fresh(t);
    await host.send('Go.', block('The gate.', ['? choice One', '? choice Two']));
    const index = lastIndex(host);
    await host.cont(`\n\nThen.\n\n${block('', ['? choice Three', '? choice Four']).trim()}`);
    assert.deepEqual(host.turn.problems().filter(item => item.index === index), []);
    assert.deepEqual(extrasOf(host).choice.map(item => item.text), ['One', 'Two', 'Three', 'Four']);
});

test('a choice line written in the story near the block is taken and hidden like any change line', async t => {
    const host = await fresh(t);
    await host.send('Go.', 'The gate stood open.\n\n? choice Slip through the gate\n\n<Changes>\n? choice Wait for dusk\n</Changes>');
    const mes = host.ctx.chat[lastIndex(host)].mes;
    assert.doesNotMatch(mes.replace(/<!--[\s\S]*?-->/g, ''), /\? choice/);
    assert.deepEqual(extrasOf(host).choice.map(item => item.text), ['Wait for dusk', 'Slip through the gate']);
});
