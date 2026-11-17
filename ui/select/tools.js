// Builds the Tools page's view-models from the engine handle: what is sent, the problems (with the rebuild entry) and one Inspector reply.
import { STRINGS } from '../../core/strings.js';
import { rebuildTarget } from '../legacy/screens/rebuild-banner-parts/target.js';
import { preview } from '../legacy/inspect.js';

const INSPECTOR_HINT = 'Every change of a reply: lines, what code did, the state after; older and newer replies';
const STATE_CUT = 4000;

const text = v => String(v ?? '');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function problemItem(p) {
  const module = text(p?.module);
  return { module, code: text(p?.code ?? p?.why), message: text(p?.message ?? p?.reason ?? p?.line ?? ''), reply: Number.isInteger(p?.index) ? p.index + 1 : null };
}

/**
 * `answers`: { problems: the turn's list, blocked: the timeline's block or null, nameOf(module) }.
 * → { items: [{ module, code, message, reply }], rebuild: null | { module, name, title, body, choices: [{ read, label }] } }.
 * A permanent dossier block (the old banner) is a Problems entry here, with the same two ways to start again.
 */
export function selectProblems(answers) {
  const a = answers ?? {};
  const items = (Array.isArray(a.problems) ? a.problems : []).map(problemItem);
  const target = rebuildTarget(a.blocked);
  const R = STRINGS.rebuild;
  const rebuild = target ? {
    module: target.module, name: text(a.nameOf?.(target.module) ?? target.module), title: R.rowTitle, body: R.body,
    choices: [{ read: 'last-40', label: R.last }, { read: 'all', label: R.all }],
  } : null;
  return { items, rebuild };
}

const BAR = { notes: '#f0b84a', fixed: '#5aa0ff', own: '#c08aff' };

/** The "what is sent" card and the footer meter from the handle's `sent()` answer (null with no chat) and the problems view: `{ used, cap, total, budget, text, tools }`, or null. */
export function selectSent(read, problems, limits = []) {
  if (!read?.size) return null;
  const { size, budget } = read;
  const own = size.own.reduce((n, o) => n + o.tokens, 0);
  const bars = [
    { name: 'Notes this reply', used: size.tail, cap: budget, color: BAR.notes },
    { name: 'Fixed part', used: size.static, cap: null, color: BAR.fixed },
    ...(own > 0 ? [{ name: 'Modules on their own', used: own, cap: null, color: BAR.own }] : []),
  ];
  const count = problems.items.length + (problems.rebuild ? 1 : 0);
  return {
    used: size.tail, cap: budget, total: size.total, budget: bars, text: read.text, limits,
    tools: [
      { label: 'Inspector', hint: INSPECTOR_HINT, button: 'Open' },
      { label: 'Problems', hint: count ? plural(count, 'problem to look at', 'problems to look at') : 'none right now', button: 'Show' },
    ],
  };
}

const lineOf = e => ({ kind: e.kind, path: e.path || '/', before: e.before === undefined ? null : preview(e.before), after: e.after === undefined ? null : preview(e.after) });

/** One reply for the Inspector sheet: `{ replies, index, reply }` where `reply` is null (nothing open) or `{ ok: false, message }` or the reply's lines, receipts, problems and state. `index` null follows the newest. */
export function selectInspector(handle, index = null) {
  const replies = (Array.isArray(handle?.replies) ? handle.replies : []).map(r => ({ index: r.index, name: r.name, snippet: r.snippet, rev: r.rev, head: r.head }));
  const at = Number.isInteger(index) && replies.some(r => r.index === index) ? index : (replies[0]?.index ?? null);
  const got = at === null ? null : handle.reply?.(at) ?? null;
  if (!got) return { replies, index: at, reply: null };
  if (!got.ok) return { replies, index: at, reply: { ok: false, message: text(got.message) } };
  let state = '';
  try { state = JSON.stringify(got.state, null, 2) ?? ''; } catch { state = ''; }
  return {
    replies, index: at,
    reply: {
      ok: true, name: got.name, rev: got.rev, head: got.head, lines: got.diff.entries.map(lineOf), more: got.diff.more,
      ops: Array.isArray(got.ops) ? got.ops.length : 0, receipts: got.receipts.map(r => ({ id: r.id, type: r.type, module: r.module, summary: r.summary })),
      problems: got.problems, state: state.length > STATE_CUT ? `${state.slice(0, STATE_CUT)}\n…` : state,
    },
  };
}
