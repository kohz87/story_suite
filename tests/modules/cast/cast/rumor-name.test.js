// FU137: a sought person who is elsewhere is named to the narrator (the export: the party at a wild spot in the Reach, the sealer in the village).
// The narrator's line carries the public face and "not in this scene"; the reader's card stays nameless; a secret or the history never shows.
import test from 'node:test';
import assert from 'node:assert/strict';

import { castHost, castSource, createFakeModel, entry, people, said, sent, settle, TAIL_KEY } from './helpers.js';
import { rumorLine } from '../../../../modules/cast/cast/note-parts/rumor-line.js';

const castLines = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').filter(line => line.startsWith('[Cast]'));
const quiet = t => t.mock.method(console, 'warn', () => {});
const OPEN = ['~ time June 3, 1200, 08:00 am', '~ place Bluewatch Reach / Salt-Yard Treeline'];
const temiwa = entry('temiwa', {
    name: 'Sister Temiwa', aliases: ['Temiwa'], role: 'Village sealer, healer', species: 'fox-eared',
    about: 'A secret past: she once burned the archive.', personality: 'Brisk and dry. Hides a deep fear.', voice: 'clipped',
    start: { place: 'Bluewatch Village', goal: 'Serve the posting.', routine: 'Watchhouse infirmary by day' },
    secrets: [{ title: 'The archive fire', text: 'She lit the archive herself.', meter: 'trust', at: 60 }],
});

test('FU137: sought "the village sealer" from the Reach: the narrator\'s line names her, says she is not here, and tells no secret', async t => {
    quiet(t);
    const model = createFakeModel([], { fallback: call => (/People who might fit/.test(call.prompt) ? '? cast temiwa | "the village sealer"' : '') });
    const host = await castHost({ source: castSource([temiwa]), model });
    try {
        await host.send('Hello.', said('Dawn in the Reach.', OPEN));
        await host.send('We haul the cart back to the Watchhouse, and with luck the village sealer.', said('The cart creaks.'));
        await settle();
        await host.send('I look around.', said('Quiet.'));
        assert.equal(people(host)['ersveil:temiwa'].met, null);
        const lines = castLines(host);
        assert.equal(lines.length, 1);
        assert.match(lines[0], /^\[Cast\] Someone sought is not in this scene: Sister Temiwa, Village sealer, healer \(fox-eared\. weathered\), manner: Brisk and dry, speaks: clipped, at Bluewatch Village\. If the story goes to them/);
        assert.doesNotMatch(lines[0], /archive|fear/i);
        assert.doesNotMatch(sent(host, TAIL_KEY).join('\n') + sent(host, 'story_suite_static').join('\n'), /archive|lit the/i);
    } finally {
        host.close();
    }
});

test('FU137: rumorLine is the public face plus where, "not in this scene" and the use-this-name instruction, never a secret or history', () => {
    const line = rumorLine({ name: temiwa.name, raw: { role: temiwa.role, species: temiwa.species, look: 'weathered', personality: temiwa.personality, voice: temiwa.voice, secrets: temiwa.secrets, history: temiwa.about } }, 'Bluewatch Village');
    assert.equal(line, 'Someone sought is not in this scene: Sister Temiwa, Village sealer, healer (fox-eared. weathered), manner: Brisk and dry, speaks: clipped, at Bluewatch Village. If the story goes to them or needs someone of their role, use this person by this name rather than making up someone new; the narration uses the name only after someone in the story says it.');
    assert.doesNotMatch(line, /archive|fear|secret/i);
    assert.equal(rumorLine(null, 'Kesh'), '');
});
