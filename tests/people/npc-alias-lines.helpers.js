// A real-adapter host with lines mode on and the dossiers a test names. Tests only.
import assert from 'node:assert/strict';
import { fakeDelta, host } from './storysuite-v2-meters.helpers.js';
import { seedPeople } from './helpers/seed-people.js';

export const ID = 'sec_cccccccc';
export const note = (who, extra) => ({ id: ID, title: `${who} title`, when: `${who} event happens`, text: `${who} keeps a spare oar.`, from: 'pack', ...extra });
export const person = (id, name, aliases = [], extra = {}) => ({ id, name, aliases, present: true, relationship: { trust: 10, affection: 0, desire: 0, tension: 0 }, ...extra });
export const DEATH = { archived: true, present: false, lifeState: 'deceased', lifeStateCertainty: 'explicit' };

export const cast = (...records) => castWith(null, ...records);

// The same with feature switches ({ [feature id]: true }) and the host's answers to queries.
export async function castWith(options, ...records) {
    const delta = fakeDelta();
    delta.records = Object.fromEntries(records.map(record => [record.id, record]));
    const publicPaths = [];
    const h = await host({ delta, linesMode: true, publicPaths, ...options });
    h.publicPaths = publicPaths;
    h.bonds = () => h.store.head().domains.people.bonds?.npcs ?? {};
    const send = text => h.reply('Later.', text).results[0];
    h.line = text => {
        const result = send(text);
        assert.equal(result?.ok, true, JSON.stringify([result, h.problems]));
        return result;
    };
    h.refused = text => {
        const result = send(text);
        assert.equal(result?.ok, false, JSON.stringify(result));
        return result;
    };
    // The dossiers stored again on a new reply (they carry no archive flag; only the live list has one).
    const later = async () => {
        h.reply('Later.');
        await seedPeople(h.sdk, h.store, Object.values(delta.records).map(({ archived, ...record }) => record));
    };
    h.add = record => { delta.records[record.id] = record; return later(); };
    h.change = (id, change) => { Object.assign(delta.records[id], change); return later(); };
    h.die = id => h.change(id, DEATH);
    return h;
}
