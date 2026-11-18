// B4-5: NPC State's "open this person's dossier" (present cards, the world's People list, the public openDossier) calls the view's opener
// (pageHandles.openPerson) with the person's id and name; the old dossier panel and its page event are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiCaptureParts } from '../../modules/people/runtime/runtime-entry-ui-events.js';
import { pageHandles } from '../../modules/people/runtime/handles.js';

const people = { npc_mira: { id: 'npc_mira', name: 'Mira' } };
const parts = () => createUiCaptureParts({ currentNpcById: id => people[id] ?? null });

test('openPersonDossier asks the view to open that person, by id and name, and says whether it did', () => {
    const asked = [];
    const warned = [];
    const saved = globalThis.toastr;
    globalThis.toastr = { warning: text => warned.push(text) };
    pageHandles.openPerson = who => { asked.push(who); return true; };
    try {
        assert.equal(parts().openPersonDossier('npc_mira'), true);
        assert.deepEqual(asked, [{ id: 'npc_mira', name: 'Mira' }]);
        assert.deepEqual(warned, []);
        pageHandles.openPerson = () => false;
        assert.equal(parts().openPersonDossier('npc_mira'), false, 'the view has no dossier for her');
        assert.match(warned.at(-1), /no dossier for Mira/);
    } finally { pageHandles.openPerson = null; globalThis.toastr = saved; }
});

test('openPersonDossier opens nothing for an unknown id, and tells the reader while the view is not up', () => {
    const warned = [];
    const saved = globalThis.toastr;
    globalThis.toastr = { warning: text => warned.push(text) };
    let calls = 0;
    pageHandles.openPerson = () => { calls += 1; return true; };
    try {
        assert.equal(parts().openPersonDossier('npc_nobody'), false);
        assert.equal(parts().openPersonDossier(''), false);
        assert.equal(calls, 0);
        pageHandles.openPerson = null;
        assert.equal(parts().openPersonDossier('npc_mira'), false);
        assert.match(warned.at(-1), /still starting/);
    } finally { pageHandles.openPerson = null; globalThis.toastr = saved; }
});
