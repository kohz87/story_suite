// Test helper for the format 4 Packs page: real packs in a real store, the view-model the engine's answers give, and the Settings overlay over it.
import assert from 'node:assert/strict';
import { createInstalled } from '../../../packs/installed.js';
import { pairingView, ownView } from '../../../packs/index-parts/page-queries.js';
import { selectPacks } from '../../../ui/select/packs.js';
import { selectYouStartRows } from '../../../ui/select/you-start.js';
import { fakeSettings } from '../../packs/helpers/fake-settings.js';
import { packsCommand } from '../../../ui/port/packs.js';
import { mountSettings } from './sections/mount.js';

const REQ = { suite: '^0.1' };
export const months = n => Array.from({ length: n }, (_, i) => ({ name: `M${i + 1}`, days: 30 }));
export const world = (extra = {}, start = { date: { year: 611, month: 10, day: 1 } }) => ({ id: 'ersveil', format: 4, kind: 'world', version: '4.0.0', name: 'Ersveil', requires: REQ, content: { start, places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }] }, ...extra });
export const game = (id, name, content = {}, version = '1.0.0') => ({ id, format: 4, kind: 'game', version, name, requires: REQ, content: { calendar: { months: months(12) }, ...content } });
export const suggesting = id => world({ recommends: { game: { id, version: '^1.0' } } });

export async function store(...packs) {
    const installed = createInstalled({ settings: fakeSettings() });
    for (const input of packs) assert.equal((await installed.install(input)).ok, true);
    return installed;
}

/** `selectPacks` over what the engine answers now (the page's `packs` view-model). */
export const packsView = (installed, setup = []) => selectPacks({ list: installed.list(), setup, pairing: pairingView(installed), own: ownView(installed) });

/** Opens Settings over a live store: every `packs.*` change goes to `store`, and the page reads the view again from it. */
export function mountPacks(installed, { setup = [] } = {}) {
    const startRows = () => selectYouStartRows(ownView(installed));
    const view = () => ({ packs: packsView(installed, setup), sections: [{ id: 'start', rows: packsView(installed).v4 ? startRows() : [] }] });
    const sent = [];
    const mounted = mountSettings({ packs: view().packs }, {
        onView: name => (name === 'settings' ? view() : null),
        // the same path the port takes: a Settings change reaches the store through packsCommand
        onChange: (key, value) => { sent.push(['c', key, value]); return packsCommand({ packs: installed }, null, 'settings.set', { key, value }); },
        onAction: async (key, value) => { sent.push(['a', key, value]); return key === 'packs.remove' ? (await installed.remove(value), { ok: true, text: 'Removed.', errors: [] }) : { ok: true }; },
    });
    const start = mounted.sec('start');
    if (start) start.rows = view().sections[0].rows;
    return { ...mounted, sent, view };
}
