// LAB2-5 on the host, with the recorded A/B v2 B chat's lines (inline): the names check of a `person` line ("Name: Torger Venn is new;
// look: …") is bookkeeping, never the day's event in [Earlier days]; the day keeps its own facts. #141 (main) took out only the
// "NPC meters: the reply was counted" tick; this receipt is the second kind the run showed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, newHost, reply } from '../daily/daily-host.helpers.js';

const TURNS = [
    ['~ time October 1, 1200, 08:00 am', '~ place Bluewatch', '+ npc Watch-Captain Edda Rorke | the watch-captain'],
    ['! time +15m', '- coin 32 copper | to: Oska Weaver', '+ item Trail rations | qty: 1 | note: week of salt-cod strips and oat-biscuits in waxed linen',
        '+ person Oska Weaver | look: stout woman past fifty, sheepskin vest, iron-grey braids under wool cap | flaw: tight-fisted over coin weight | voice: brisk and blunt | temper: flinty',
        '+ npc Oska Weaver | the provision stallkeeper | stout woman in sheepskin vest, iron-grey braids, wool cap'],
    ['! time +5d', '~ place Highmark'],
    ['~ time 11:25 am', '- coin 4 copper | to: Torger Venn', '+ present Torger Venn', '+ npc Torger Venn | the cookshop owner | Heavy-set man in his mid-forties with rolled sleeves, a knotted beard, and a stained leather apron.',
        '+ person Torger Venn | look: heavy-set man in his mid-forties with thick forearms and a knotted salt-and-pepper beard | flaw: impatient with loiterers who nurse one cup | voice: blunt and gruff | temper: curt'],
    ['! time +30 days'],
    ['! time +6h', '+ present Torger Venn'],
];

async function play() {
    const host = await newHost(true, { realms: [], events: [] });
    host.features.set('story-director.names', true);
    for (const lines of TURNS) await host.send('Go on.', reply('The story goes on.', lines));
    return host;
}
const earlier = async host => {
    const mark = host.st.promptLog.length;
    await host.send('Go on.', reply('The story goes on.', ['! time +1h']));
    return host.st.promptLog.slice(mark).map(entry => String(entry.value ?? '')).join('\n').match(/\[Earlier days\]\n[^[]*/)?.[0] ?? '';
};

test('LAB2-5: the names check of a person line is not the day\'s event in [Earlier days]; the day\'s own facts are', async () => {
    const host = await play();
    try {
        assert.ok(host.sdk.receipts().some(entry => entry.receipt.type === 'capture.person' && /^Name: Torger Venn is new/.test(entry.receipt.summary)), 'the run\'s receipt is there');
        const block = await earlier(host);
        assert.match(block, /October 6, 1200 \(4 weeks ago\): to Highmark/, 'the day\'s own line (Torger is present, so his day is picked)');
        assert.doesNotMatch(block, /is new|look:|flaw:/, 'no names-check receipt as the day\'s event');
        const journalDay = (host.sdk.query('director.journal', {})?.days ?? []).find(entry => /^October 6, 1200/.test(entry.date ?? ''));
        assert.ok(journalDay?.met?.some(name => /Torger Venn/.test(name)), `the meeting is still in the Journal's Met (${JSON.stringify(journalDay?.met)})`);
        assert.ok(!(journalDay?.happened ?? []).some(line => /^Name: /.test(line)), 'and not among its events');
        // Replay == live: rebuild and a fresh load, a swipe and back, an edited Re-read (grown, shrunk) of the day's reply, a middle delete, a rewind.
        await agrees(host, 'live');
        const last = host.ctx.chat.length - 1;
        await host.swipe(reply('Another way.', ['! time +2h']));
        await host.st.swipeTo(last, 0);
        await agrees(host, 'swipe and back');
        const day = host.ctx.chat.findIndex(message => !message.is_user && /person Torger Venn/.test(message.mes));
        assert.ok(day > 0);
        await host.st.editMessage(day, reply('The story goes on.', [...TURNS[3], '+ person Bente Kroon | look: tall square-built woman | flaw: blunt | voice: even and dry | temper: watchful']));
        assert.equal((await host.sdk.reread(day)).ok, true);
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(day, reply('The story goes on.', ['~ time 11:25 am']));
        assert.equal((await host.sdk.reread(day)).ok, true);
        await agrees(host, 'shrunk Re-read');
        assert.doesNotMatch(await earlier(host), /is new|look:/);
        await host.st.deleteMessage(day);
        await agrees(host, 'middle delete');
        while (host.ctx.chat.length > 4) await host.st.deleteMessage(host.ctx.chat.length - 1);
        await agrees(host, 'rewind');
    } finally { host.done(); }
});
