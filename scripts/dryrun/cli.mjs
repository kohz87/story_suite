import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atEitherLayout } from '../release/layout-paths.mjs';
import { pathToFileURL } from 'node:url';
import { loadLayout } from '../layout.mjs';
import { loadChat } from './load-chat.mjs';
import { recordChat } from './record-chat.mjs';
import { runHistoryOps } from './history-ops.mjs';
import { historyErrors } from './compare-history.mjs';
import { parseFlagList } from './flags.mjs';
import { compareCards } from './compare-cards.mjs';
import { compareRecords } from './compare-records.mjs';
import { prepareOutDir, writeManifest } from './out-guard.mjs';

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--fresh' || arg === '--history' || arg === '--cards') {
      flags[arg.slice(2)] = true;
    } else if (arg.startsWith('--')) {
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
    throw new Error('Usage: record --code <repo root> --chats <folder> --out <folder> [--fresh] [--history] [--flags name=value,...]');
  }
  const setFlags = parseFlagList(flags.flags);
  prepareOutDir({ outDir, repoRoot, fresh: flags.fresh === true });

  mkdirSync(outDir, { recursive: true });
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'story-suite-dryrun-'));
  try {
    const farm = loadLayout().suiteFarm;
    for (const { link, dir } of farm) symlinkSync(path.join(repoRoot, dir), path.join(tmpRoot, link));
    for (const name of ['SUITE_SB', 'SUITE_SD', 'SUITE_NSD']) delete process.env[name];
    process.env.STORY_SUITE_ROOT = tmpRoot;
    process.env.NPC_STATE_DELTA_PATH = path.join(tmpRoot, 'npc_state_delta');

    // the suite helper is named as of the old layout; a checkout from after the move has it at its layout-mapped place
    const suiteUrl = pathToFileURL(path.join(repoRoot, atEitherLayout(repoRoot, path.posix.join(farm.find(f => f.link === 'Story_block').dir, 'tests/v2/break/helpers/suite.js')))).href;
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
    const written = [];
    for (const file of files) {
      const start = performance.now();
      const chat = loadChat(path.join(chatsDir, file));
      const record = await recordChat({ suite, chat, flags: setFlags });
      if (flags.history) {
        record.history = await runHistoryOps({ suite, chat, chatId: file.replace(/\.jsonl(\.gz)?$/, '') });
        record.errors.push(...historyErrors(record, 'new').map(item => ({ reply: null, step: item.field, detail: item.before })));
      }
      const ms = Math.round(performance.now() - start);
      written.push(`${file}.json`);
      writeManifest(outDir, written);
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
  const { flags, positional } = parseFlags(args);
  if (positional.length < 2) {
    throw new Error('Usage: compare [--cards] <dirA> <dirB>');
  }
  const dirA = path.resolve(positional[0]);
  const dirB = path.resolve(positional[1]);
  const filesA = new Set(readdirSync(dirA).filter(name => name.endsWith('.json')));
  const filesB = new Set(readdirSync(dirB).filter(name => name.endsWith('.json')));
  const allFiles = [...new Set([...filesA, ...filesB])].sort();

  if (flags.cards) {
    compareCardsIn({ dirA, dirB, allFiles, filesA, filesB });
    return;
  }
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

// The replies whose card text differs, per chat: a file missing on one side or a record with no card text is a failure, not "no change".
function compareCardsIn({ dirA, dirB, allFiles, filesA, filesB }) {
  let bad = allFiles.length === 0;
  if (bad) console.log('no recordings found: nothing was compared');
  let changed = 0;
  for (const file of allFiles) {
    if (!filesA.has(file) || !filesB.has(file)) {
      console.log(`${file}: missing in ${filesA.has(file) ? dirB : dirA}`);
      bad = true;
      continue;
    }
    const res = compareCards(JSON.parse(readFileSync(path.join(dirA, file), 'utf8')), JSON.parse(readFileSync(path.join(dirB, file), 'utf8')));
    if (res.missing) {
      console.log(`${file}: a recording has no card text (record it again with code that has the card): nothing was compared`);
      bad = true;
      continue;
    }
    console.log(`${file}: ${res.replies.length} replies with a changed card`);
    for (const item of res.replies) console.log(`  reply=${item.reply}\n    before: ${item.before}\n    after:  ${item.after}`);
    changed += res.replies.length;
  }
  console.log(`${changed} replies with a changed card in total`);
  if (bad) process.exitCode = 1;
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
