// NSD16 reads "the reply has no <Changes> block" at MESSAGE_RECEIVED. In production NPC State's capture listener is makeFirst (runtime-entry-events.js), so it
// reads the raw reply; any later listener sees Story Block's hidden comment. Both forms must count as a block, and the comment's words are not names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { hasChangesBlock, replyNamesSomeone } from '../../modules/people/core/core-parts/reply-names.js';

test('a makeFirst listener reads the raw block, a later one the hidden comment; both count as a block', async () => {
  const host = await createHost();
  try {
    const first = [], late = [];
    host.st.eventSource.makeFirst('message_received', i => { first.push(String(host.ctx.chat[i]?.mes)); });
    host.st.eventSource.on('message_received', i => { late.push(String(host.ctx.chat[i]?.mes)); });
    await host.send('a', 'Mira nods at Orsen.\n<Changes>\n~ scene | where: hall\n</Changes>');
    await host.send('b', 'Mira nods at Orsen.');
    assert.match(first[0], /^Mira nods at Orsen\.\n<Changes>/, 'the first listener sees the block as written');
    assert.match(late[0], /<!-- STORY_SUITE_V2\n<Changes>/, 'a later listener sees it inside the hidden comment');
    assert.ok(hasChangesBlock(first[0]) && hasChangesBlock(late[0]));
    assert.equal(hasChangesBlock(first[1]) || hasChangesBlock(late[1]), false, 'a reply with no block has none in either form');
  } finally { host.close(); }
});

test('the hidden comment of a reply is not prose: its capitals are not a name', () => {
  assert.equal(replyNamesSomeone('it was quiet.\n\n<!-- STORY_SUITE_V2\n<Changes>\n</Changes>\n-->'), false);
  assert.equal(replyNamesSomeone('it was quiet.\n\n<!-- STORY_SUITE_V2 -->'), false);
  assert.equal(replyNamesSomeone('it was quiet; then Orsen came in.'), true);
});
