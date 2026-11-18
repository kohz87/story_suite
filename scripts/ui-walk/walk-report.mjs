// Writes the settings walk's results as a Markdown pass/fail table: counts per run, then every failure, then the full table.

const CHECKS = ['walk', 'click', 'visible', 'shown', 'effect', 'stored', 'redraw', 'reopen', 'reload', 'restored'];
const cell = text => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mark = v => (v === true ? 'ok' : v === false ? 'FAIL' : v === null ? 'not run' : '');
const value = v => (v === undefined ? '' : String(v));

/** Counts per combo: `{ [combo]: { pass, fail, skip } }`. */
export function countResults(results = []) {
  const out = {};
  for (const r of results) {
    const c = (out[r.combo] ??= { pass: 0, fail: 0, skip: 0 });
    c[r.status] = (c[r.status] ?? 0) + 1;
  }
  return out;
}

/** The report text. `meta` = { url, started, finished, sizes, themes, character, notes[] }. */
export function toMarkdown(results = [], meta = {}) {
  const lines = ['# Settings walk', ''];
  lines.push(`URL ${meta.url ?? ''} · character ${meta.character ?? '(latest chat)'} · ${meta.started ?? ''} to ${meta.finished ?? ''}`, '');
  for (const note of meta.notes ?? []) lines.push(`- ${note}`);
  if ((meta.notes ?? []).length) lines.push('');
  lines.push('| Run | Pass | Fail | Skip |', '|---|---|---|---|');
  for (const [combo, c] of Object.entries(countResults(results))) lines.push(`| ${combo} | ${c.pass} | ${c.fail} | ${c.skip} |`);
  lines.push('', '## Failures', '');
  const failed = results.filter(r => r.status === 'fail');
  if (!failed.length) lines.push('None.');
  else {
    lines.push('| Run | Page | Control | Label | Failed | Note | Screenshot |', '|---|---|---|---|---|---|---|');
    for (const r of failed) {
      const which = CHECKS.filter(k => r.checks?.[k] === false).join(', ');
      lines.push(`| ${r.combo} | ${r.section} | \`${cell(r.id)}\` | ${cell(r.label)} | ${which} | ${cell((r.notes ?? []).join('; '))} | ${(r.shots ?? []).map(s => s.split('/').pop()).join(' ')} |`);
    }
  }
  lines.push('', '## Every control', '', `| Run | Page | Control | Kind | From | To | ${CHECKS.join(' | ')} | Result | Note |`, `|${'---|'.repeat(CHECKS.length + 8)}`);
  for (const r of results) {
    const checks = CHECKS.map(k => mark(r.checks?.[k])).join(' | ');
    lines.push(`| ${r.combo} | ${r.section} | \`${cell(r.id)}\` | ${r.kind ?? ''} | ${cell(value(r.from))} | ${cell(value(r.to))} | ${checks} | ${r.status.toUpperCase()} | ${cell((r.notes ?? []).join('; '))} |`);
  }
  return `${lines.join('\n')}\n`;
}
