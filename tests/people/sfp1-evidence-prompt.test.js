import test from 'node:test';
import assert from 'node:assert/strict';
import { stripUiNoise } from '../../modules/people/core/core-text-parts/ui-evidence.js';
import { linesMeterText } from '../../modules/people/meters/npc-meters-prompt-parts/lines-text.js';

// SOAKPEOPLE F22: a stored reply keeps its change lines in Story Suite's hidden comment; the scan and Refresh windows read them as story text.
test('F22: the evidence text of a reply leaves out the STORY_SUITE_V2 comment and a <Changes> block; the prose stays', () => {
    const mes = 'Old Wen leans on the bar. "Back room. Pay me tomorrow."\n\n<!-- STORY_SUITE_V2\n<Changes>\n~ npc Old Wen | trust: up | why: she likes a man who pays\n~ memory Wenna Coll | She gave Astra the room.\n</Changes>\n-->';
    assert.equal(stripUiNoise(mes), 'Old Wen leans on the bar. "Back room. Pay me tomorrow."');
    assert.equal(stripUiNoise('The rain stops.\n<!-- STORY_SUITE_V2_ -->'), 'The rain stops.', 'an empty marker is not text');
    assert.equal(stripUiNoise('Before. <Changes>\n~ npc X | trust: up\n</Changes> After.'), 'Before. After.');
    assert.equal(stripUiNoise('Plain <b>story</b> text.'), 'Plain story text.', 'other markup is stripped as before');
});

// SOAKPEOPLE F20: the Relationships rule listed only the four built-in meters while the Meter rules named the reader's own meter (Respect).
test('F20: the Relationships rule names the meters the Meter rules name; with none it is the approved text, byte for byte', () => {
    const four = linesMeterText({ via: false, meters: ['trust', 'affection', 'desire', 'tension'] });
    assert.equal(four, linesMeterText({ via: false }));
    assert.match(four, /Name each meter that moved \(trust, affection, desire, tension\) and say up or down/);
    const custom = linesMeterText({ via: false, meters: ['respect', 'loyalty'], rules: ['respect rises when she is treated as an equal', 'loyalty grows with shared danger'] });
    assert.match(custom, /Name each meter that moved \(trust, affection, desire, tension, respect, loyalty\) and say up or down/);
    assert.match(custom, /Meter rules: respect rises/);
});

test('F20 through the module: a custom meter with a rule is named in the list; one with no rule is named nowhere (G2)', async () => {
    const { createNpcPart } = await import('../../modules/people/meters/npc-meters.js');
    const settings = { customMeters: [{ name: 'Respect', min: 0, max: 100, start: 10, describe: 'rises when she is treated as an equal' }, { name: 'Nerves', min: 0, max: 100 }] };
    const part = createNpcPart({ settings: () => settings, feature: () => true });
    const text = part.context.static();
    assert.match(text, /Name each meter that moved \(trust, affection, desire, tension, respect\)/);
    assert.doesNotMatch(text, /nerves/);
});
