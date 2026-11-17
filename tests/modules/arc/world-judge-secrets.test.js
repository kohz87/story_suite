// The Director judge is told the secrets not yet learned (the planner's brief carries them), under a never-reveal line, so it can refuse a beat that gives one away.
import test from 'node:test';
import assert from 'node:assert/strict';

import { judgeContext } from '../../../modules/arc/judge/context.js';
import { JUDGE_SYSTEM } from '../../../modules/arc/judge/prompt.js';

test('judgeContext lists the unlearned secrets under a never-reveal line; none, no block; the system text names them', () => {
    const text = judgeContext({ brief: { threads: [], secrets: [{ name: 'Temiwa', text: 'The prior forged the last rite.' }] } });
    assert.match(text, /Secrets not yet learned \(never reveal or hint at them in any item\):\n- Temiwa: The prior forged the last rite\./);
    assert.equal(judgeContext({ brief: { threads: [] } }).includes('Secrets not yet learned'), false);
    assert.match(JUDGE_SYSTEM, /reveals or hints at hidden lore or a secret not yet learned/);
});
