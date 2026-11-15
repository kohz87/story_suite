import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadChat } from './load-chat.mjs';
import { recordChat } from './record-chat.mjs';
import { compareRecords } from './compare-records.mjs';

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[++i];
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

async function runRecord(args) {
  const { flags } = parseFlags(args);
  const repoRoot = path.resolve(flags.code ?? '');
  const chatsDir = path.resolve(flags.chats ?? '');
  const outDir = path.resolve(flags.out ?? '');
  if (!flags.code || !flags.chats || !flags.out) {
    throw new Error('Usage: record --code <repo root> --chats <folder> --out <folder>');
  }

  mkdirSync(outDir, { recursive: true });
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'story-suite-dryrun-'));
  try {
    symlinkSync(path.join(repoRoot, 'packages', 'story-block'), path.join(tmpRoot, 'Story_block'));
    symlinkSync(path.join(repoRoot, 'packages', 'story-director'), path.join(tmpRoot, 'Story_director'));
    symlinkSync(path.join(repoRoot, 'packages', 'npc-state-delta'), path.join(tmpRoot, 'npc_state_delta'));
    for (const name of ['SUITE_SB', 'SUITE_SD', 'SUITE_NSD']) delete process.env[name];
    process.env.STORY_SUITE_ROOT = tmpRoot;
    process.env.NPC_STATE_DELTA_PATH = path.join(tmpRoot, 'npc_state_delta');

    const suiteUrl = pathToFileURL(path.join(repoRoot, 'packages/story-block/tests/v2/break/helpers/suite.js')).href;
    const { loadSuite, suiteHost } = await import(suiteUrl);
    const loaded = await loadSuite();
    if (loaded.skip) {
      throw new Error(`loadSuite skipped: ${loaded.skip}`);
    }
    for (const [key, dir] of [['sb', 'story-block'], ['sd', 'story-director'], ['nsd', 'npc-state-delta']]) {
      if (loaded.roots?.[key] && !loaded.roots[key].startsWith(tmpRoot) && !loaded.roots[key].startsWith(repoRoot)) {
        throw new Error(`${dir} loaded from ${loaded.roots[key]}, not from --code ${repoRoot}`);
      }
    }
    const suite = { ...loaded, suiteHost };

    const files = readdirSync(chatsDir)
      .filter(name => name.endsWith('.jsonl') || name.endsWith('.jsonl.gz'))
      .sort();

    if (files.length === 0) {
      throw new Error(`No .jsonl or .jsonl.gz chats in ${chatsDir}`);
    }
    let failed = 0;
    for (const file of files) {
      const start = performance.now();
      const chat = loadChat(path.join(chatsDir, file));
      const record = await recordChat({ suite, chat });
      const ms = Math.round(performance.now() - start);
      writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(record));
      console.log(`${file}: ${record.replyCount} replies, ${record.errors.length} errors (${ms} ms)`);
      for (const item of record.errors.slice(0, 5)) console.log(`  ERROR reply=${item.reply} ${item.step}: ${String(item.detail).slice(0, 120)}`);
      failed += record.errors.length;
    }
    if (failed > 0) {
      console.log(`${failed} failed steps: this recording is not a pass`);
      process.exitCode = 1;
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function runCompare(args) {
  const { positional } = parseFlags(args);
  if (positional.length < 2) {
    throw new Error('Usage: compare <dirA> <dirB>');
  }
  const dirA = path.resolve(positional[0]);
  const dirB = path.resolve(positional[1]);
  const filesA = new Set(readdirSync(dirA).filter(name => name.endsWith('.json')));
  const filesB = new Set(readdirSync(dirB).filter(name => name.endsWith('.json')));
  const allFiles = [...new Set([...filesA, ...filesB])].sort();

  let anyDiff = false;
  if (allFiles.length === 0) {
    console.log('no recordings found: nothing was compared');
    anyDiff = true;
  }
  for (const file of allFiles) {
    if (!filesA.has(file)) {
      console.log(`${file}: 1 differences (missing in ${dirA})`);
      anyDiff = true;
      continue;
    }
    if (!filesB.has(file)) {
      console.log(`${file}: 1 differences (missing in ${dirB})`);
      anyDiff = true;
      continue;
    }
    const a = JSON.parse(readFileSync(path.join(dirA, file), 'utf8'));
    const b = JSON.parse(readFileSync(path.join(dirB, file), 'utf8'));
    const res = compareRecords(a, b);
    if (res.equal) {
      console.log(`${file}: identical${res.expectedRefusals ? ` (${res.expectedRefusals.length} expected refusals)` : ''}`);
    } else {
      anyDiff = true;
      const preview = res.differences
        .slice(0, 3)
        .map(d => `[reply=${d.reply} ${d.field}: ${d.before} -> ${d.after}]`)
        .join('; ');
      console.log(`${file}: ${res.differences.length} differences (${preview})${res.expectedRefusals ? ` (${res.expectedRefusals.length} expected refusals)` : ''}`);
    }
  }
  if (anyDiff) {
    process.exitCode = 1;
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'record') {
    await runRecord(rest);
  } else if (cmd === 'compare') {
    runCompare(rest);
  } else {
    console.error('Usage: node scripts/dryrun/cli.mjs <record|compare> ...');
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err?.stack ?? String(err));
  process.exitCode = 1;
});
