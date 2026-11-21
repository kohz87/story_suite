// The clean-up of the old NPC State files (scripts/people/old-files.mjs): the dry run lists only the old data, recovery and checkpoint
// files with their sizes and deletes nothing; with --delete only "yes" deletes, and portraits and other extensions' files always stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { deleteOldFiles, listOldFiles, main } from '../../scripts/people/old-files.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const OLD = ['npc-state-delta-1a2b3c.json', 'npc-state-delta-recovery-1a2b-xyz-abc.json', 'npc-state-delta-checkpoint-9f9f.json', 'npc-state-v3-77.json', 'npc-state-15fusak.json'];
const KEEP = ['npc-state-delta-portrait-1a2b.webp', 'npc-state-portrait-index.json', 'storysuite-portrait-aa.webp', 'world-state-alpha-1.json', 'stmb-arc.json', 'notes.txt'];

function folder() {
    const dir = tempDir('old-npc-');
    [...OLD, ...KEEP].forEach((name, n) => fs.writeFileSync(path.join(dir, name), 'x'.repeat(100 * (n + 1))));
    return dir;
}
const sink = () => { let text = ''; return { stream: new Writable({ write(chunk, _e, done) { text += chunk; done(); } }), text: () => text }; };

test('the dry run lists the old files with their sizes and deletes nothing', async t => {
    const dir = folder();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const { files, total } = listOldFiles(dir);
    assert.deepEqual(files.map(file => file.name), [...OLD].sort());
    assert.equal(total, files.reduce((sum, file) => sum + file.size, 0));
    const out = sink();
    assert.equal(await main([dir], { output: out.stream }), 0);
    assert.match(out.text(), /5 old NPC State files \(the kind kept before the merge\), \d+ KB in all\. Story Suite no longer reads them\. Portraits are kept\./);
    assert.deepEqual(fs.readdirSync(dir).sort(), [...OLD, ...KEEP].sort(), 'nothing deleted');
});

test('each file is listed with its date, and a file changed after the merge (or after --since) is flagged', async t => {
    const dir = folder();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const before = new Date('2026-10-01T10:00:00Z');
    for (const name of OLD) fs.utimesSync(path.join(dir, name), before, before);
    const after = new Date('2026-11-20T09:30:00Z');
    fs.utimesSync(path.join(dir, OLD[1]), after, after);
    const out = sink();
    assert.equal(await main([dir], { output: out.stream }), 0);
    assert.match(out.text(), /2026-10-01 10:00 {4}npc-state-delta-1a2b3c\.json/);
    assert.match(out.text(), /2026-11-20 09:30 ! {2}npc-state-delta-recovery-1a2b-xyz-abc\.json/);
    assert.match(out.text(), /! 1 of them changed after 2026-11-16 23:11 \(UTC\), the merge: something wrote them since\./);
    const later = sink();
    assert.equal(await main(['--since', '2026-11-21', dir], { output: later.stream }), 0);
    assert.doesNotMatch(later.text(), / ! /);
    assert.doesNotMatch(later.text(), /changed after/);
    const bad = sink();
    assert.equal(await main([dir, '--since', 'soon'], { output: bad.stream }), 2);
    assert.deepEqual(fs.readdirSync(dir).sort(), [...OLD, ...KEEP].sort(), 'nothing deleted');
});

test('with --delete only "yes" deletes, and only the old files', async t => {
    const dir = folder();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const no = sink();
    assert.equal(await main([dir, '--delete'], { input: Readable.from(['no\n']), output: no.stream }), 0);
    assert.match(no.text(), /Nothing was deleted/);
    assert.equal(fs.readdirSync(dir).length, OLD.length + KEEP.length);
    const yes = sink();
    assert.equal(await main([dir, '--delete'], { input: Readable.from(['yes\n']), output: yes.stream }), 0);
    assert.match(yes.text(), /Deleted 5 old NPC State files/);
    assert.deepEqual(fs.readdirSync(dir).sort(), [...KEEP].sort());
});

test('a name that is not an old NPC State file is never deleted, whoever asks', t => {
    const dir = folder();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const out = deleteOldFiles(dir, ['storysuite-portrait-aa.webp', 'npc-state-delta-portrait-1a2b.webp', '../escape.json', OLD[0]]);
    assert.deepEqual(out.deleted, [OLD[0]]);
    assert.equal(out.failed.length, 3);
    assert.ok(fs.existsSync(path.join(dir, 'storysuite-portrait-aa.webp')));
});
