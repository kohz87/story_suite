// A person who left a place is stored "away, at that place"; coming back to the place without them must not show them as present
// (the owner's chat, 20 Nov: Edda Rorke left the Guild Office at reply 6, the scene returned to it at reply 8 without her, and the Here list still had her).
// Replayed with the story's own change lines: +/- present decide who is here; where someone was last placed does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from '../../people/helpers/pacing-suite.js';
import { isHere } from '../../../ui/select/people.js';

const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
const rec = (id, name) => ({ id, name, aliases: [], present: false, memories: [], memoryStamps: {}, relationship: { ...blank } });
const records = () => ({ npc_rorke: rec('npc_rorke', 'Watch-Captain Edda Rorke'), npc_pella: rec('npc_pella', 'Pella Breck'), npc_temiwa: rec('npc_temiwa', 'Sister Temiwa') });
const GUILD = '~ place Bluewatch Village / Guild Office';
const STORE = '~ place Bluewatch Village / River Storehouse';

test('present means who the story put in the scene: coming back to a place does not bring back who left it', async () => {
    const s = await suite({ lines: true, records: records(), clock: false });
    const warn = console.warn; console.warn = () => {};
    try {
        const q = (name, args = {}) => s.host.sdk.query(name, args);
        const here = () => { const place = q('scene.place')?.name; const list = q('scene.present'); return q('people.list').filter(row => isHere(row, place, list)).map(row => row.name).sort(); };
        const say = async lines => { await s.host.send('And then?', `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`); await s.adapter.ticked(); };
        await say([GUILD, '+ present Pella Breck', '+ present Watch-Captain Edda Rorke']);
        assert.deepEqual(here(), ['Pella Breck', 'Watch-Captain Edda Rorke']);
        await say([STORE, '- present Pella Breck', '- present Watch-Captain Edda Rorke']);
        assert.deepEqual(here(), []);
        const rorke = () => q('people.list').find(row => row.name.includes('Rorke'));
        assert.equal(rorke().location, 'Bluewatch Village / Guild Office', 'the rig: she is stored away at the Guild Office');
        await say([GUILD, '+ present Pella Breck', '+ present Sister Temiwa']);
        assert.deepEqual(here(), ['Pella Breck', 'Sister Temiwa'], 'Rorke is not here: the story did not bring her back');
        await say([]);
        assert.deepEqual(here(), ['Pella Breck', 'Sister Temiwa'], 'still not, on a reply with no present lines');
        const live = JSON.stringify(q('people.list'));
        s.host.store.rebuild();
        assert.equal(JSON.stringify(q('people.list')), live, 'replay equals live');
    } finally { console.warn = warn; }
});
