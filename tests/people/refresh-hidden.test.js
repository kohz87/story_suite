// N8 part 2: a Refresh also reads the messages SillyTavern hid (/hide), as evidence in [mN] order; the narrator prompt and the rest keep skipping them.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { useTranscriptSource, useMessageGate, refreshMessageGate, recentTranscript, recentUserDevelopmentContext, activeReplyIds } = await import('../../modules/people/transcript/transcript.js');

const msg = (name, mes, extra = {}) => ({ name, mes, is_user: name === 'You', is_system: false, ...extra });
const chat = [
    msg('You', 'We reach the gate.'),                                      // m0
    msg('Narrator', 'Myla opens the gate for them.', { is_system: true }),   // m1: hidden by /hide
    msg('You', 'I thank her.', { is_system: true }),                       // m2: a hidden user turn
    msg('Narrator', 'Rules: stay near the wall.', { is_system: true, extra: { type: 'narrator' } }),   // m3: SillyTavern's own note
    msg('Narrator', 'Myla leads the way.'),                                // m4
    msg('Narrator', 'A reply of the dead timeline.', { is_system: true }),   // m5: faded by the story gate (it hides with the same flag)
    msg('You', 'We follow.'),                                              // m6
    msg('SillyTavern System', 'TOOL: Called WeatherTool', { is_system: true, force_avatar: 'img/five.png', extra: { isSmallSys: true, tool_invocations: [{ name: 'WeatherTool' }] } }),   // m7: a tool-call record (no extra.type)
    msg('Megumin', '[Megumin sends a picture that contains: 1girl, red eyes, eyepatch].', { is_system: true, extra: { media: [{ source: 'generated', url: 'a.png' }], inline_image: true } }),   // m8: an image-generation message (no extra.type)
    msg('Megumin', '{{be shy}}', { is_system: true, extra: { bias: '{{be shy}}' } }),   // m9: a bias-only /sendas
];
useTranscriptSource({ context: () => ({ chat, name1: 'You', name2: 'Narrator' }), scanDepth: () => 10 });
useMessageGate({ refresh: async () => chat.map((_, at) => at !== 5) });
await refreshMessageGate();

test('a Refresh window reads the hidden story reply and the hidden user turn, in [mN] order', () => {
    const text = recentTranscript(10, { messageIds: true, hidden: true });
    assert.equal(text, [
        '[m0] You: We reach the gate.', '[m1] Narrator: Myla opens the gate for them.', '[m2] You: I thank her.', '[m4] Narrator: Myla leads the way.', '[m6] You: We follow.',
    ].join('\n'));
    assert.match(recentUserDevelopmentContext(10, { messageIds: true, hidden: true }), /\[m2\] You: I thank her\./);
});

test('SillyTavern system notes and our faded replies are not read', () => {
    const text = recentTranscript(10, { messageIds: true, hidden: true });
    assert.doesNotMatch(text, /Rules: stay near the wall/);
    assert.doesNotMatch(text, /dead timeline/);
    assert.doesNotMatch(text, /WeatherTool/, 'a tool-call record is not story');
    assert.doesNotMatch(text, /sends a picture/, 'a generated image message is not story');
    assert.doesNotMatch(text, /be shy/, 'a bias-only /sendas is not story');
});

test('the narrator prompt, the reply scans and every other read still skip hidden messages (byte for byte as before)', () => {
    assert.equal(recentTranscript(10, { messageIds: true }), ['[m0] You: We reach the gate.', '[m4] Narrator: Myla leads the way.', '[m6] You: We follow.'].join('\n'));
    assert.equal(recentTranscript(10), ['You: We reach the gate.', 'Narrator: Myla leads the way.', 'You: We follow.'].join('\n'));
    assert.equal(recentUserDevelopmentContext(10, { messageIds: true }), '[m0] You: We reach the gate.\n[m6] You: We follow.');
    assert.deepEqual(activeReplyIds(), [4]);
});

test('the window is the same on every read of the same chat (replay == live: a swipe only changes the message text it reads)', () => {
    const first = recentTranscript(10, { messageIds: true, hidden: true });
    assert.equal(recentTranscript(10, { messageIds: true, hidden: true }), first);
    chat[4].mes = 'Myla leads the way, swiped.';
    assert.match(recentTranscript(10, { messageIds: true, hidden: true }), /\[m4\] Narrator: Myla leads the way, swiped\./);
    chat[4].mes = 'Myla leads the way.';
    assert.equal(recentTranscript(10, { messageIds: true, hidden: true }), first, 'swiped back: as before');
});

test('the window keeps its size: hidden messages count as lines inside the Refresh window', () => {
    assert.equal(recentTranscript(3, { messageIds: true, hidden: true }), ['[m2] You: I thank her.', '[m4] Narrator: Myla leads the way.', '[m6] You: We follow.'].join('\n'));
});
