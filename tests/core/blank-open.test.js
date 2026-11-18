// HK-1: a reply whose only change block was left open with no line in it (the tag written, then nothing) counts as no block:
// the repair is asked (live and on Re-read), and a closed empty block stays the model's "nothing changed".
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankOpen } from '../../core/capture.js';
import { SETTING } from '../../modules/assist/index.js';
import { createHost } from '../../testkit/index.js';
import { skip, wait } from '../modules/assist/safety-net.helpers.js';

const HIDDEN = (open, body) => `Story.\n\n<!-- STORY_SUITE_V2${open ? ' open' : ''}\n<Changes>\n${body}\n</Changes>\n-->`;

test('blankOpen: only a block left open with no line', () => {
    assert.equal(blankOpen('Story.\n\n<Changes>\n'), true);
    assert.equal(blankOpen('Story.\n\n<Changes>'), true);
    assert.equal(blankOpen(HIDDEN(true, '')), true, 'hidden with the open mark, as Re-read finds it');
    assert.equal(blankOpen('Story.\n\n<Changes>\n</Changes>'), false, 'a closed empty block is "nothing changed"');
    assert.equal(blankOpen(HIDDEN(false, '')), false);
    assert.equal(blankOpen('Story.\n\n<Changes>\n+ item Rope\n'), false, 'an open block with a line has something');
    assert.equal(blankOpen(HIDDEN(true, '+ item Rope')), false);
    assert.equal(blankOpen('Story, with `<Changes>` named in it.'), false);
    assert.equal(blankOpen('Story.'), false);
});

test('a reply ending in an open empty block asks for the repair, as a reply with no block does; a closed empty block does not', { skip }, async () => {
    for (const [tail, asked] of [['<Changes>\n', 1], ['<Changes>\n</Changes>', 0]]) {
        let n = 0;
        const host = await createHost({ callModel: async () => { n += 1; return '<Changes>\n+ item Rope | qty: 1\n</Changes>'; }, settings: { modules: { 'story-block': { [SETTING.repair]: true } } } });
        try {
            await host.send('I pay.', `You pay Bob and take a rope.\n\n${tail}`);
            await wait(40);
            assert.equal(n, asked, `tail ${JSON.stringify(tail)}`);
        } finally { host.close(); }
    }
});
