import test from 'node:test';
import assert from 'node:assert/strict';
import { replyPreview } from '../../modules/people/npc-api/reply-preview.js';

test('v1.2.13 replyPreview(): what the next reply gets, each part with its size, never throws', () => {
    const preview = replyPreview({ injection: 'NPC STATE DELTA DOSSIER.\n- Elke: IDENTITY …', capture: 'One-pass capture: write …' });
    assert.equal(preview.label, 'NPC State');
    assert.deepEqual(preview.parts.map(part => part.label), ['Live dossier', 'One-pass capture instruction (end of the prompt)']);
    assert.equal(preview.parts[0].tokens, Math.ceil(preview.parts[0].text.length / 4));
    assert.equal(preview.text, `${preview.parts[0].text}\n\n${preview.parts[1].text}`);
    assert.deepEqual(replyPreview({ injection: '', capture: '' }), { label: 'NPC State', text: '', parts: [] });
    assert.deepEqual(replyPreview().parts, []);
});
