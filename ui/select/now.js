// Builds the Now-tab view-model from recorded query answers; gaps come back as null or empty lists.

import { selectDrawer, replyLines } from './chat.js';

// answers: { [queryName]: answer } as the port read them. opts: as selectDrawer, plus `fight` (a `fight.board` answer, not a query yet),
// `torn` (`gear.view` answer) and `pinned` ([{ id, name, view }]: each pinned block's `dataModules.view` answer, SB/data-modules/part/views.js:51).

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);

// `time.overdue` (SD/time/index.js:183): { overdue, pay, due } lists of { id, key, kind, due }. Points to spend and an open fight have no query (UI-PLAN §2.1).
function needsYou(answers, opts) {
  const out = [];
  if (isRec(opts.fight) && opts.fight.state && opts.fight.state !== 'end') out.push({ kind: 'fight', title: 'A fight is open', detail: null, go: 'fight' });
  const overdue = list(answers['time.overdue']?.overdue);
  if (overdue.length) {
    const names = overdue.map(row => text(row.key)).filter(Boolean).join(', ');
    out.push({ kind: 'overdue', title: `${overdue.length} overdue`, detail: names || null, go: 'journal' });
  }
  return out;
}

// `atlas.trip` (SD/atlas/trip-query.js:74 over tripView trip.js:363): phase road | arrived, `to`, `row`, `leg`, `legCount`, `fraction` (of the leg).
// "planned" is a gap (UI-PLAN §2.2), so a trip not yet started is not shown.
function tripOf(trip) {
  if (!isRec(trip) || trip.on !== true || !['road', 'arrived'].includes(trip.phase)) return null;
  const done = trip.phase === 'arrived' ? 1 : ((trip.leg - 1) + (trip.fraction || 0)) / trip.legCount;
  return { state: trip.phase, title: text(trip.to), detail: text(trip.row), progressPct: Number.isFinite(done) ? Math.round(done * 100) : null };
}

// `director.goal` (SD/screens/queries.js:72): { goal, step, ... }; `director.next` (:131): { summary, key, when, reached }. The focus is the newest quest
// until the reader's own pick exists (a per-chat pref: a gap).
function focusOf(goal) {
  return isRec(goal) && text(goal.goal) ? { title: text(goal.goal), detail: text(goal.step) || null } : null;
}

function dueOf(next) {
  if (!isRec(next)) return null;
  const title = text(next.summary) || text(next.key);
  if (!title) return null;
  return { title, detail: [text(next.when), next.reached === true ? 'due now' : ''].filter(Boolean).join(' · ') || null };
}

// `gear.view` (SB/domains/gear/views.js:156): rows { [stack]: { word, broken } } and names from slots (worn) and bag (unworn).
function tornOf(view) {
  if (!isRec(view) || !isRec(view.rows)) return [];
  const named = [...Object.values(isRec(view.slots) ? view.slots : {}), ...list(view.bag)].filter(isRec);
  return Object.entries(view.rows)
    .filter(([, row]) => isRec(row) && (row.word === 'torn' || row.word === 'broken'))
    .map(([stack, row]) => ({ stack, name: text(named.find(item => item.stack === stack)?.name) || stack, detail: text(row.word) }));
}

function thisTurn(answers) {
  const lines = replyLines(answers);
  if (!lines) return { count: 0, items: [] };
  const items = lines.map(line => ({ ...line, heldBack: line.applied ? null : { asked: line.line, why: line.detail || 'not used' } }));
  return { count: items.length, items };
}

function pinnedOf(pinned) {
  return list(pinned).filter(item => isRec(item) && isRec(item.view?.chat)).map(item => ({
    trackerId: text(item.id),
    name: text(item.name),
    fields: Object.entries(item.view.chat).map(([label, value]) => ({ label, value: String(value) })),
  }));
}

export function selectNow(answers = {}, opts = {}) {
  const followed = new Set(list(answers['director.keyPeople']).map(row => text(row?.name)));
  const party = new Set(list(answers['party.actors']).map(row => text(row?.name)));
  const you = isRec(answers['scene.you']) ? answers['scene.you'] : null;
  return {
    needsYou: needsYou(answers, opts),
    today: { focus: focusOf(answers['director.goal']), trip: tripOf(answers['atlas.trip']), dueSoon: dueOf(answers['director.next']), torn: tornOf(opts.torn) },
    // The scene line (doing, wearing) and the situational secrets are gaps (UI-PLAN §2.2).
    here: selectDrawer(answers, opts).map(row => ({ ...row, followed: followed.has(row.name), inParty: party.has(row.name), doing: null, wearing: null, scene: null })),
    thisTurn: thisTurn(answers),
    // `scene.you` (SB/domains/scene.js:102) answers wearing and condition; null while the feature is off. Position is a gap.
    you: { look: you ? text(you.wearing) || null : null, position: null, condition: you ? text(you.condition) || null : null },
    pinned: pinnedOf(opts.pinned),
  };
}
