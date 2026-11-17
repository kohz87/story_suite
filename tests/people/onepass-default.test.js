// One-pass capture is on by default (owner 17 Nov); a stored false stays off; a typed 0 in "Refresh every" is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { npcBucket } = await import('../../modules/people/settings/bucket.js');
const { getSettings } = await import('../../modules/people/settings/runtime-settings.js');
const { DEFAULTS } = await import('../../modules/people/settings/runtime-settings-parts/defaults.js');
const { cutSettingNumber } = await import('../../modules/people/settings/number-cut.js');

test('a new install has one-pass capture on; a stored false and a stored true are kept', () => {
    assert.equal(DEFAULTS.narrationCapture, true);
    assert.equal(getSettings().narrationCapture, true);
    const bucket = npcBucket(globalThis.__npcMock.extensionSettings, { create: true });
    for (const [given, want] of [[false, false], [true, true], [undefined, true]]) {
        bucket.narrationCapture = given;
        assert.equal(getSettings().narrationCapture, want, `${given}`);
    }
});

test('the number box keeps a typed 0 where 0 is allowed, and a blank or junk box is the fallback', () => {
    for (const [raw, want] of [['0', 0], [0, 0], ['7', 7], ['99', 50], ['', 4], ['  ', 4], ['abc', 4], [undefined, 4], ['2.6', 3]]) assert.equal(cutSettingNumber(raw, 0, 50, 4), want, `${raw}`);
    assert.equal(cutSettingNumber('0', 1, 12, 3), 3, 'where 0 is not allowed it is still the fallback, as before');
    assert.equal(cutSettingNumber('-5', 1, 12, 3), 1);
});
