#!/usr/bin/env node
// Click-through test of every Settings row in a running SillyTavern (a replica: it changes settings and puts them back).
// It starts nothing: give it the URL. Per size and theme it opens the suite and Settings, changes every editable control,
// checks the visible effect or the stored value, reloads to check it stuck, restores it, and writes results.md, results.json
// and a screenshot of each failure into --out. Exit 1 when anything failed. See docs/dev/release-walkthrough.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs, diffPaths } from './walk-plan.mjs';
import { createSession } from './walk-session.mjs';
import { walkSection } from './walk-section.mjs';
import { finishCombo } from './walk-batch.mjs';
import { toMarkdown, countResults } from './walk-report.mjs';

const opts = parseArgs(process.argv.slice(2));
if (opts.error) {
  console.error(opts.error);
  process.exit(2);
}
const out = resolve(opts.out);
mkdirSync(out, { recursive: true });
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const started = new Date().toISOString();
const results = [];
const notes = [];
let character = opts.character;

function write(finished = '(running)') {
  const meta = { url: opts.url, started, finished, character, notes };
  writeFileSync(`${out}/results.json`, `${JSON.stringify({ meta, results }, null, 1)}\n`);
  writeFileSync(`${out}/results.md`, toMarkdown(results, meta));
}

for (const size of opts.sizes) {
  for (const theme of opts.themes) {
    const combo = `${size.name}-${theme}`;
    const log = text => console.log(`[${new Date().toISOString().slice(11, 19)}] ${combo} ${text}`);
    let session = null;
    try {
      session = await createSession({ browser, url: opts.url, size, theme, character });
      log('loading');
      await session.boot();
      character = session.character();
      const store0 = await session.store();
      await session.openSettings();
      const sections = (await session.sections()).filter(id => !opts.only.length || opts.only.includes(id));
      const walked = new Set();
      const pages = [];
      for (const section of sections) {
        log(`page ${section}`);
        try {
          const page = await walkSection(session, { combo, section }, walked, out);
          results.push(...page.results);
          pages.push({ section, kept: page.kept, gates: page.gates });
          if (page.broken) { await session.reload(); await session.openSettings(); }
        } catch (error) {
          console.error(error.stack);
          results.push({ combo, section, id: '(page)', label: section, status: 'fail', checks: {}, notes: [`the walk stopped on this page: ${String(error.message).split('\n')[0]}`], shots: [] });
          await session.shot(`${out}/${combo}__${section}__stopped.png`);
          await session.reload();
          await session.openSettings();
        }
        write();
      }
      log('reload, check and put back');
      try {
        await finishCombo(session, pages, out);
      } catch (error) {
        console.error(error.stack);
        notes.push(`${combo}: RESCUE: the reload-and-restore step stopped (${String(error.message).split('\n')[0]}); the suite's stored settings and device keys were written back from the snapshot taken before the walk, by script, not by clicks`);
        await session.shot(`${out}/${combo}__restore-stopped.png`);
        await session.rescue(store0);
      }
      write();
      await session.reload();
      const left = diffPaths(store0, await session.store());
      const added = left.filter(d => d.before === '(none)');
      const changed = left.filter(d => d.before !== '(none)');
      if (changed.length) notes.push(`${combo}: after the walk these stored values differ from before: ${changed.map(d => `${d.path} ${d.before} → ${d.after}`).join('; ')}`);
      if (added.length) notes.push(`${combo}: stored now where nothing was before (a default written out by a change and its restore): ${added.map(d => `${d.path} = ${d.after}`).join('; ')}`);
      if (session.errors.length) notes.push(`${combo}: page errors: ${[...new Set(session.errors)].slice(0, 5).join(' / ')}`);
    } catch (error) {
      console.error(error.stack);
      results.push({ combo, section: '-', id: '(run)', label: 'open the suite and Settings', status: 'fail', checks: {}, notes: [String(error.message).split('\n')[0]], shots: [] });
      if (session) await session.shot(`${out}/${combo}__run.png`);
    } finally {
      await session?.close();
    }
    write();
    log(JSON.stringify(countResults(results)[combo] ?? {}));
  }
}
await browser.close();
write(new Date().toISOString());
const failed = results.filter(r => r.status === 'fail').length;
console.log(`${failed} failed; ${out}/results.md`);
process.exit(failed ? 1 : 0);
