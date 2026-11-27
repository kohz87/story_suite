// NPC State's kept `<Changes>` cue beside the Director's pacing lines: with a pulse cue already on the shared kept room, and a
// Breather and a Quiet scene line in the tail, the cue is still sent however small the tail budget is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, estimateTokens } from '../../core/prompt.js';
import { directorTail } from '../../modules/time/tracker/note.js';
import { suite } from './helpers/pacing-suite.js';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { ON } from './npc-notes-kinds.helpers.js';

const PULSE = '[World] A rider brings word that the north road is closed.';

test('the Changes cue stays kept with a pulse cue, a Breather and a Quiet scene line', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const director = {
        turn: { n: 5 }, keys: {},
        threads: { th_aaaaaaaa: { id: 'th_aaaaaaaa', key: 'Toll Man', kind: 'beat', status: 'resolved', summary: '', fields: {}, track: { created: { turn: 3 }, closed: { turn: 5 } } } },
    };
    const note = {
        kinds: [], moduleId: 'story-director', name: 'Story Director', domains: ['director'],
        tail: view => directorTail({ state: { domains: { director } }, settings: {}, chat: view.chat, query: name => (name === 'pulse.quiet' ? { on: true } : null) }),
    };
    const registry = { statics: () => [], contexts: () => [note, ...s.host.registry.contexts()] };
    const view = { state: s.host.head(), query: () => null, settings: {}, chat: { length: s.host.ctx.chat.length, lastUser: '' } };
    const built = assemble({ registry, view, settings: { tailBudget: 1 }, keptTokens: estimateTokens(PULSE) });
    assert.ok(note.tail(view).lines.some(line => String(line).startsWith('Breather: ')), 'the note holds a Breather');
    assert.ok(note.tail(view).lines.some(line => String(line).startsWith('Quiet scene: ')), 'and the Quiet scene line');
    const ours = built.parts.find(part => part.module === MODULE_ID && part.place === 'tail');
    assert.match(ours.text, /^Whenever anything changed, write it in the <Changes> block/m);
});
