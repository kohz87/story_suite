import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

/**
 * Loads a SillyTavern `.jsonl` or `.jsonl.gz` chat export into `{ header, messages }`.
 */
export function loadChat(filePath) {
  const raw = readFileSync(filePath);
  const text = (filePath.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error(`Empty chat export: ${filePath}`);
  }
  const header = JSON.parse(lines[0]);
  const messages = lines.slice(1).map(line => JSON.parse(line));
  return { header, messages };
}
