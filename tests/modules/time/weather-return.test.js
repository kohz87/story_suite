// Soak bug 7: the story's own `~ weather` is kept while the party stays in that day and place. Leaving the region brings the rule's weather back and a return the same day
// does not bring the story's word back (MODULES §F122: "kept for the rest of that day and place" = while there). The rule's pick for a day and region is seeded, so a return reads the same every time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';

const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const weather = host => host.head().domains.scene.weather;
const START = ['~ time June 3, 1200, 08:00 am', '~ place Bluewatch | kind: settlement | region: the Lowmere'];

test('story weather stays while there; leaving and coming back the same day gives the day\'s rule weather, the same on a rebuild', async () => {
    const host = await createHost({ modules: [createModule()] });
    await host.send('Morning.', reply('Bluewatch wakes.', START));
    const rule = weather(host);
    await host.send('Look up.', reply('Cold and bright.', ['~ weather bright and cold']));
    assert.equal(weather(host).text, 'bright and cold');
    await host.send('Ride.', reply('The moors.', ['~ place Hollin\'s Reach | kind: village | region: Shornmarch']));
    assert.match(weather(host).key, /\|shornmarch$/);
    assert.notEqual(weather(host).text, 'bright and cold', 'another region: the rule\'s weather');
    await host.send('Back.', reply('Bluewatch again.', ['~ place Bluewatch | kind: settlement | region: the Lowmere']));
    assert.equal(weather(host).key, rule.key, 'the day and region of the first reply');
    assert.equal(weather(host).text, rule.text, 'the rule\'s weather for that day and region, as at the first reply');
    const head = structuredClone(host.head());
    host.store.rebuild();
    assert.deepEqual(host.head(), head);
    host.close();
});
