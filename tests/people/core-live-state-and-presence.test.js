import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNpcRecord,
    mergeScanResult,
} from '../core.js';

test('existing scanner deltas may use dossier id without repeating name or unchanged profile fields', () => {
    const npc = createNpcRecord('Myla Fenn');
    npc.id = 'npc_myla';
    npc.appearance = 'Established appearance that must survive a compact delta.';
    const result = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false, mood: 'terrified',
        relationshipImpact: 'meaningful', relationshipDelta: { tension: 8 },
        relationshipEvidence: { trust: '', affection: '', desire: '', tension: 'The threat created fear and unresolved tension.' },
        relationshipChangeReason: 'A threat in the current exchange raised Myla\'s tension.',
    }] }, { turn: 5, relationshipCaps: { ordinary: 4, meaningful: 8, major: 15, extreme: 25 } });
    const updated = result.state.npcs[0];
    assert.equal(updated.name, 'Myla Fenn');
    assert.equal(updated.present, true);
    assert.equal(updated.mood, 'terrified');
    assert.equal(updated.appearance, 'Established appearance that must survive a compact delta.');
    assert.equal(Object.prototype.hasOwnProperty.call(updated, 'importance'), false, 'retired Importance metadata must not survive normalization');
    assert.equal(updated.relationship.tension, 8);
});

test('goal lifecycle preserves unchanged goals, replaces new objectives, and explicitly clears completed goals', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.goal = 'Reach the capital';

    const unchanged = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false,
    }] }, { turn: 2 });
    assert.equal(unchanged.state.npcs[0].goal, 'Reach the capital');

    const replaced = mergeScanResult(unchanged.state, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false, goal: 'Find the missing courier',
    }] }, { turn: 3 });
    assert.equal(replaced.state.npcs[0].goal, 'Find the missing courier');

    const cleared = mergeScanResult(replaced.state, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false, goalState: 'clear',
    }] }, { turn: 4 });
    assert.equal(cleared.state.npcs[0].goal, '');
});

test('status lifecycle preserves active status, replaces changed condition, and explicitly clears resolved status', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.status = 'Badly wounded and unable to stand';

    const unchanged = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false,
    }] }, { turn: 2 });
    assert.equal(unchanged.state.npcs[0].status, 'Badly wounded and unable to stand');

    const replaced = mergeScanResult(unchanged.state, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false, status: 'Bandaged and walking with a limp',
    }] }, { turn: 3 });
    assert.equal(replaced.state.npcs[0].status, 'Bandaged and walking with a limp');

    const cleared = mergeScanResult(replaced.state, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false, statusState: 'clear',
    }] }, { turn: 4 });
    assert.equal(cleared.state.npcs[0].status, '');
});

test('mood and location are live fields that replace or explicitly clear when story state changes', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.mood = 'Furious and frightened';
    npc.location = 'Bluewatch Guildhall';

    const unchanged = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, worldActive: false,
    }] }, { turn: 2 });
    assert.equal(unchanged.state.npcs[0].mood, 'Furious and frightened');
    assert.equal(unchanged.state.npcs[0].location, 'Bluewatch Guildhall');

    const replaced = mergeScanResult(unchanged.state, { npcs: [{
        id: npc.id, present: true, worldActive: false, mood: 'Relieved but exhausted', location: 'South Gate infirmary',
    }] }, { turn: 3 });
    assert.equal(replaced.state.npcs[0].mood, 'Relieved but exhausted');
    assert.equal(replaced.state.npcs[0].location, 'South Gate infirmary');

    const cleared = mergeScanResult(replaced.state, { npcs: [{
        id: npc.id, present: false, worldActive: true, moodState: 'clear', locationState: 'clear',
    }] }, { turn: 4 });
    assert.equal(cleared.state.npcs[0].mood, '');
    assert.equal(cleared.state.npcs[0].location, '');
});

test('presence is reset for off-screen NPCs on each scan while persistent dossier remains', () => {
    const yunyun = createNpcRecord('Yunyun');
    yunyun.present = true;
    yunyun.relationship.desire = 22;
    const wiz = createNpcRecord('Wiz', [yunyun.id]);
    wiz.present = true;
    const result = mergeScanResult({ npcs: [yunyun, wiz], turn: 7 }, { npcs: [
        { id: yunyun.id, name: 'Yunyun', present: true, relationshipImpact: 'ordinary', relationshipDelta: { desire: 3 }, relationshipEvidence: { trust: '', affection: '', desire: 'Yunyun explicitly admitted romantic attraction and wanted intimate closeness.', tension: '' }, relationshipChangeReason: 'Yunyun explicitly admitted romantic attraction to the player.' },
    ] }, { maxNpcs: 40, turn: 8 });
    assert.equal(result.state.npcs.length, 2, 'off-screen NPC should remain persisted');
    assert.equal(result.state.npcs.find(n => n.name === 'Yunyun').present, true);
    assert.equal(result.state.npcs.find(n => n.name === 'Yunyun').relationship.desire, 23);
    assert.equal(result.state.npcs.find(n => n.name === 'Wiz').present, false);
});


test('each scanner merge clears stale present and World State activity flags when an NPC is not observed', () => {
    const npc = createNpcRecord('Wiz');
    npc.present = true;
    npc.worldActive = true;
    const result = mergeScanResult({ npcs: [npc], turn: 9 }, { npcs: [] }, { turn: 10 });
    assert.equal(result.state.npcs[0].present, false);
    assert.equal(result.state.npcs[0].worldActive, false);
});

test('compact World State merges may preserve omitted off-screen activity without preserving stale physical presence', () => {
    const npc = createNpcRecord('Wiz');
    npc.present = true;
    npc.worldActive = true;
    const result = mergeScanResult({ npcs: [npc], turn: 9 }, { npcs: [] }, { turn: 10, preserveWorldActive: true });
    assert.equal(result.state.npcs[0].present, false);
    assert.equal(result.state.npcs[0].worldActive, true);
});
