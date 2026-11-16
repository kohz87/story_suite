// The safety net's place guards: an arrival located elsewhere, explicit departures, and which arrivals the reply names.

import { stripBlock, withoutReasoning } from '../../capture.js';
import { cleanName } from '../../domains/names.js';
import { fold } from './shared-text.js';
import { knownPlace, mapPlaces } from './places.js';

// A safety-net move is refused only on evidence against the proposed place: the reply's own `+ present ... | at: Place` locates an
// arrival somewhere else. A bare `+ present` or chatter names no place (and `with:` need not list people already at the destination),
// so neither refuses a move. Two places agree when they are the same, one holds the other ("Village" and "Village / Office"),
// or they end in the same spot; siblings ("Village / Market", "Village / Office") do not. Map aliases resolve through `places`.
export function assistPlaceConflict(line, own = [], places = []) {
    if (line?.kind !== 'place' || !['~', '+'].includes(line.op)) return '';
    const arrivals = new Map();
    for (const item of own) {
        if (item.kind !== 'present' || !['+', '-'].includes(item.op)) continue;
        for (const name of String(item.name ?? '').split(',').map(name => name.trim()).filter(Boolean)) {
            if (item.op === '-') arrivals.delete(fold(name));
            else arrivals.set(fold(name), { name, place: item.labels?.place ?? item.labels?.at ?? item.labels?.where ?? '' });
        }
    }
    const map = mapPlaces(places);
    const path = text => String(knownPlace(map, text)?.name ?? text).split(/\s[\/|]\s|\s—\s/).map(fold).filter(Boolean);
    const agree = (a, b) => {
        const [short, long] = a.length <= b.length ? [a, b] : [b, a];
        return short.length > 0 && (short.every((part, at) => part === long[at]) || a.at(-1) === b.at(-1));
    };
    const destination = path(line.name);
    for (const { name, place } of arrivals.values()) {
        if (place && !agree(path(place), destination)) return `the reply places ${name} at ${place}`;
    }
    return '';
}

// Explicit departures already read for this reply win over an Assist place's companion list, including
// people who were already absent. A later explicit arrival cancels the departure.
export function assistDepartures(receipts = []) {
    const left = new Set();
    for (const receipt of receipts) {
        if (receipt?.type !== 'capture.present') continue;
        for (const name of [...(receipt.data?.removed ?? []), ...(receipt.data?.missing ?? [])]) left.add(name.toLowerCase());
        for (const name of receipt.data?.added ?? []) left.delete(name.toLowerCase());
    }
    return [...left];
}

// Decide before saving either a now or a late answer, so a Re-read never re-judges a kept line.
// Preview the actual place handler: this catches a conflict, invalid place or no-op without changing state.
// A name must be a whole name in the last story paragraph, not a substring or a name in a hidden block.
export function assistPresentGuard({ lines, places, text, heads, own, state, marks, registry, bus, index, sid, receipts }) {
    const withLine = line => line.kind === 'place' && /\|\s*(?:with|present)\s*:/iu.test(line.raw ?? '');
    const arrivals = lines.filter(line => (line.kind === 'present' && line.op === '+') || withLine(line));
    if (!arrivals.length || !places.length) return { lines, refused: [] };
    const kept = new Set(lines.map(line => line.raw));
    const entry = registry.capture('place');
    const badPlace = places.some(line => {
        if (!kept.has(line.raw) || !entry) return true;
        const carrier = { index, sid, rules: marks, assist: 'now', assistLeft: assistDepartures(receipts), assistCheck: (item, map) => assistPlaceConflict(item, own, map) };
        const result = bus.run('capture.place', { ...line, kind: entry.kind, word: line.kind }, { cause: 'story', state, seed: 0, capture: entry, carrier });
        return !result?.ok || result.receipt?.data?.moved === false;
    });
    if (!badPlace) return { lines, refused: [] };
    const paragraph = stripBlock(withoutReasoning(text), 'Changes', { heads }).trim().split(/\r?\n\s*\r?\n/u).at(-1) ?? '';
    const normalize = value => String(value ?? '').normalize('NFKC').replace(/[‘’`]/gu, "'").replace(/\s+/gu, ' ').toLowerCase();
    const last = normalize(paragraph);
    const named = name => {
        const literal = normalize(cleanName(name)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return literal && new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${literal}(?![\\p{L}\\p{N}\\p{M}])`, 'u').test(last);
    };
    const refused = [];
    const why = missing => `the safety net's place was refused or is the current place, and ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not named in the reply's last paragraph`;
    // A comma line is split: the names in the final scene stay (the line is rewritten without the others), the rest are refused.
    // The same rule covers a place line's `with:` companions, which add people even when the place does not change.
    const split = names => ({ keep: names.filter(name => !name || named(name)), missing: names.filter(name => name && !named(name)) });
    const accepted = [];
    for (const line of lines) {
        if (line.kind === 'present' && line.op === '+') {
            const { keep, missing } = split(String(line.name ?? '').split(',').map(cleanName));
            if (!missing.length) { accepted.push(line); continue; }
            refused.push({ line: line.raw, why: why(missing) });
            const rest = String(line.raw ?? '').split(/\s\|\s/u).slice(1);
            const names = keep.filter(Boolean);
            if (names.length) accepted.push({ ...line, name: names.join(', '), raw: [`+ present ${names.join(', ')}`, ...rest].join(' | ') });
        } else if (withLine(line)) {
            const parts = String(line.raw).split(/\s\|\s/u);
            const at = parts.findIndex(part => /^(?:with|present)\s*:/iu.test(part));
            const key = /^present/iu.test(parts[at]) ? 'present' : 'with';
            const { keep, missing } = split(parts[at].replace(/^(?:with|present)\s*:/iu, '').split(',').map(cleanName));
            if (!missing.length) { accepted.push(line); continue; }
            refused.push({ line: line.raw, why: why(missing) });
            const names = keep.filter(Boolean);
            if (names.length) parts[at] = `${key}: ${names.join(', ')}`; else parts.splice(at, 1);
            accepted.push({ ...line, raw: parts.join(' | '), labels: { ...line.labels, [key]: names.join(', ') } });
        } else accepted.push(line);
    }
    return { lines: accepted, refused };
}
