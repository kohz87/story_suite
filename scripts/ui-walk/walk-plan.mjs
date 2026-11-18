// The settings walk's pure decisions: its command line, the value each control is changed to, what is never clicked and why, and which stored paths a change touched.

const USAGE = 'Usage: node scripts/ui-walk/settings-walk.mjs --url <SillyTavern URL> --out <folder> [--sizes 1920x1080,1280x800,390x844] [--themes dark,light] [--only start,look,...] [--character <name>]';
const DEFAULT_SIZES = '1920x1080,1280x800,390x844';
const THEMES = new Set(['dark', 'light']);

// Controls the walk must never change, with the reason it prints.
const SKIP = [
  [/^dev\.oldView$/, 'Use the old view takes the new view off the page; the walk would end itself'],
  [/^ctl:Modules and features for$/, 'chooses which set the page edits (This chat / New chats); not a setting'],
];

/** Reads the command line: `{ url, out, sizes: [{ w, h, name }], themes, only, character }`, or `{ error }` with the usage line. */
export function parseArgs(argv = []) {
  const opts = { url: null, out: null, sizes: DEFAULT_SIZES, themes: 'dark,light', only: '', character: null };
  for (let i = 0; i < argv.length; i += 1) {
    const name = /^--([a-z]+)$/.exec(argv[i])?.[1];
    if (!name || !(name in opts) || argv[i + 1] === undefined) return { error: `Unknown or empty option ${argv[i]}\n${USAGE}` };
    opts[name] = argv[i + 1];
    i += 1;
  }
  if (!opts.url || !opts.out) return { error: `--url and --out are needed\n${USAGE}` };
  const sizes = String(opts.sizes).split(',').map((s) => {
    const m = /^(\d+)x(\d+)$/.exec(s.trim());
    return m ? { w: Number(m[1]), h: Number(m[2]), name: `${m[1]}x${m[2]}` } : null;
  });
  if (!sizes.length || sizes.some(s => s === null)) return { error: `--sizes takes WxH,WxH\n${USAGE}` };
  const themes = String(opts.themes).split(',').map(s => s.trim());
  if (themes.some(t => !THEMES.has(t))) return { error: `--themes takes dark and/or light\n${USAGE}` };
  const only = String(opts.only).split(',').map(s => s.trim()).filter(Boolean);
  return { url: opts.url, out: opts.out, sizes, themes, only, character: opts.character };
}

/** Why the walk leaves this control alone (a fixed skip or an action button), or null when it walks it. */
export function skipReason(control) {
  if (control.kind === 'act') return control.reason ?? 'action button: the walk changes settings, it does not run actions';
  for (const [pattern, reason] of SKIP) if (pattern.test(control.id)) return reason;
  return null;
}

const listOf = text => String(text ?? '').split(', ').filter(Boolean);

/**
 * The value a control is changed to from `from` (what it shows now): a switch flips, a choice takes the next option,
 * a number goes up one step (its `control.step`, else 1; `step` -1 for the walk's second try), text gets " walk" added, chips toggle the first chip.
 * Returns undefined when there is no other value to pick.
 */
export function nextValue(control, from, step = 1) {
  const options = Array.isArray(control.options) ? control.options.map(String) : [];
  if (control.kind === 'sw') return !(from === true || from === 'true');
  if (control.kind === 'seg' || control.kind === 'sel') {
    const others = options.filter(o => o !== String(from));
    if (!others.length) return undefined;
    const at = options.indexOf(String(from));
    return at < 0 ? others[0] : options[(at + 1) % options.length];
  }
  if (control.kind === 'num') {
    const n = Number(from);
    if (String(from ?? '').trim() === '' || !Number.isFinite(n)) return step > 0 ? '1' : undefined;
    return String(n + step * (Number(control.step) || 1));
  }
  if (control.kind === 'txt') return String(from ?? '') === '' ? 'Walk' : `${from} walk`;
  if (control.kind === 'chips') {
    if (!options.length) return undefined;
    const on = new Set(listOf(from));
    if (on.has(options[0])) on.delete(options[0]); else on.add(options[0]);
    return options.filter(o => on.has(o)).join(', ');
  }
  return undefined;
}

const short = v => (v === undefined ? '(none)' : JSON.stringify(v).slice(0, 60));

function walk(a, b, path, out, limit) {
  if (out.length >= limit) return;
  if (Object.is(a, b)) return;
  const objA = a !== null && typeof a === 'object';
  const objB = b !== null && typeof b === 'object';
  if (!objA || !objB || Array.isArray(a) !== Array.isArray(b)) { out.push({ path: path || '(root)', before: short(a), after: short(b) }); return; }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], path ? `${path}.${key}` : key, out, limit);
}

/** Where two stored snapshots differ (at most `limit`): `[{ path, before, after }]`, values as short JSON ("(none)" when absent). */
export function diffPaths(a, b, limit = 40) {
  const out = [];
  walk(a, b, '', out, limit);
  return out;
}
