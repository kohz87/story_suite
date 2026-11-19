// The dossier's dates read through the real host: NPC State's stored memory stamps and the meter rows reach the UI's dossier (memory date and reply,
// the change's reply, the top bar's last reply), and a swipe gives the same dossier as a fresh run of the same replies (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { dossierMap } from '../../ui/select/people-parts.js';
import { normalizeName } from '../../modules/people/core/core-text-parts/clean.js';

const OLD = 'Oren paid five silver and signed the roll.';
const UNDATED = 'Oren was there before the stamps.';

function records() {
  const out = dossiers();
  out.npc_oren.memories = [UNDATED, OLD];
  out.npc_oren.memoryStamps = { [normalizeName(OLD)]: { m: 1, d: 'Goldwane 3' } };
  return out;
}

// (the UI's port reads a query nobody answers as null, as here: this host has no Director or RPG)
const dossierOf = s => dossierMap((name, args) => { try { return s.host.sdk.query(name, args); } catch { return null; } }).npc_oren;

test('memory stamps and the meter rows reach the dossier through the host\'s queries', async () => {
  const s = await suite({ records: records() });
  const reply = await s.say(['~ npc Oren | trust: +2 | why: you paid on time']);
  const d = dossierOf(s);
  assert.ok(d, 'Oren has a dossier');
  const old = d.past.find(m => m.text === OLD);
  assert.deepEqual([old.date, old.reply, old.dayRef], ['Goldwane 3', 1, 'Goldwane 3'], 'the stamped memory keeps its date and reply');
  const undated = d.past.find(m => m.text === UNDATED);
  assert.deepEqual([undated.date, 'reply' in undated, undated.dayRef], ['', false, null], 'no stamp: no date');
  const change = d.changes.find(c => c.meter === 'trust');
  assert.ok(change, `the trust change is listed: ${JSON.stringify(d.changes)}`);
  assert.equal(change.reply, reply, 'the change carries the reply it came in');
  assert.ok(d.lastReply >= reply, `the top bar's reply is the last recorded change (${d.lastReply} for reply ${reply})`);
});

test('a swipe gives the same dossier dates as replaying the kept reply', async () => {
  const live = await suite({ records: records() });
  await live.say(['~ npc Oren | trust: +2 | why: you paid on time']);
  await live.swipe(['~ npc Oren | trust: +1 | why: you paid late']);
  const fresh = await suite({ records: records() });
  await fresh.say(['~ npc Oren | trust: +1 | why: you paid late']);
  const pick = d => ({ past: d.past, changes: d.changes, lastReply: d.lastReply, moodChanges: d.moodChanges });
  assert.deepEqual(pick(dossierOf(live)), pick(dossierOf(fresh)));
});
