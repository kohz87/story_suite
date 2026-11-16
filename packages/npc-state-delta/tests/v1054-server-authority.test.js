import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeSource } from './helpers/runtime-source.js';

test('freshness boundaries cover resume, editor, portrait and destructive mutation paths without polling', () => {
    const source = runtimeSource();
    assert.match(source, /addEventListener\?\.\('pageshow',[\s\S]*refreshCurrentChatFromServer\('pageshow'\)/);
    assert.match(source, /visibilityState === 'visible'[\s\S]*refreshCurrentChatFromServer\('visibility-resume'\)/);
    assert.match(source, /activeEditorBaseRevision[\s\S]*workingCopyAdoption\(originChatKey\)/);
    assert.match(source, /portrait-commit[\s\S]*originCanonicalRevision/);
    assert.match(source, /runFreshMutation\('archive a dossier'/);
    assert.match(source, /runFreshMutation\('delete a dossier'/);
    assert.doesNotMatch(source, /setInterval\([^\n]*ensureHydratedStateFresh|setInterval\([^\n]*inspectNpcStateDataFile/);
});
