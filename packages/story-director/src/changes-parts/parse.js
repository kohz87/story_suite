// Story Director: parsing Director change lines into structured ops and errors.
import { FIELDS, questDifficulty } from './fields.js';
import { inferKind, kindOf, lineKey } from './identity.js';
import { QUEST_TYPE_WORDS } from './kinds.js';
import { splitLabel } from './shared-label.js';
import { isSpace, stripMarkdown, wordCount } from './shared-text.js';

// A comma or semicolon before one of the format's fields ("…, giver: Nelke"), for runs written without "|".
// Read at each comma or semicolon with a sticky regex (see splitFieldRun), so a long run of spaces
// is walked once, not once per space.
const FIELD_AFTER = new RegExp(`\\s*(?:${FIELDS.join('|')})\\s*:`, 'iy');

const MAX_COLON_KEY_WORDS = 8;

// The format's own words (CHANGE_INSTRUCTION, the capture prompt), copied as if they were text.
const PLACEHOLDER = /^(?:part|summary|reason|what happened|(?:label|field):\s*value)$/i;

// The first spaced dash in `text` as `{ index, length }` (the spaces around it included), or null.
function keyDash(text) {
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const long = ch === '—' || ch === '–';
        const spaced = ch === '-' && i > 0 && isSpace(text[i - 1]) && (i + 1 === text.length || isSpace(text[i + 1]));
        if (!long && !spaced) continue;
        let start = i;
        while (start > 0 && isSpace(text[start - 1])) start -= 1;
        let end = i + 1;
        while (end < text.length && isSpace(text[end])) end += 1;
        return { index: start, length: end - start };
    }
    return null;
}

// `text` split at each comma or semicolon that comes before one of the format's fields.
function splitFieldRun(text) {
    const pieces = [];
    let from = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] !== ',' && text[i] !== ';') continue;
        FIELD_AFTER.lastIndex = i + 1;
        if (!FIELD_AFTER.test(text)) continue;
        pieces.push(text.slice(from, i).trimEnd());
        from = i + 1;
        while (from < text.length && isSpace(text[from])) from += 1;
        i = from - 1;
    }
    pieces.push(text.slice(from));
    return pieces;
}

/** Splits the first part into the key and whatever follows it. */
function splitKey(first) {
    const dash = keyDash(first);
    if (dash) {
        return { key: first.slice(0, dash.index), head: first.slice(dash.index + dash.length) };
    }
    const colon = first.search(/:(?:\s|$)/);
    if (colon > 0 && wordCount(first.slice(0, colon)) <= MAX_COLON_KEY_WORDS) {
        let key = first.slice(0, colon);
        let head = first.slice(colon + 1).trim();
        // `Geva now: Court` (what is left of `**Geva now:** Court`): the trailing field word
        // labels the first part. Lowercase only, so a name like `The Long Leg` keeps its word.
        const tail = key.match(/^(.*\S)\s+([a-z]+)$/);
        if (tail && FIELDS.includes(tail[2])) {
            key = tail[1];
            head = `${tail[2]}: ${head}`;
        }
        return { key, head };
    }
    return { key: first, head: '' };
}

// Repeated loose text is joined rather than overwritten, so nothing the model wrote is lost.
function addText(target, name, value) {
    target[name] = target[name] && value ? `${target[name]}; ${value}` : target[name] || value;
}

function parseLine(raw) {
    let text = raw.replace(/\*\*|__/g, '').trim();
    // A bullet is decoration only when an op follows it: `- Thys — …` is itself an op.
    text = text.replace(/^[*•-]\s*(?=[+~!-]\s)/, '');
    const opMatch = text.match(/^([+~!-])\s+(.*)$/s);
    if (!opMatch) return { error: 'not a change line (expected + ~ - or ! followed by a key)' };
    const op = opMatch[1];
    let body = opMatch[2].trim();

    let kind = null;
    let kindWord = '';
    if (op === '+') {
        // `+ kind hook …`, the format's own word copied in front of the kind.
        const copied = body.match(/^kind\s*:?\s+(\S+)\s+(.*)$/is);
        if (copied && kindOf(copied[1])) {
            kind = kindOf(copied[1]);
            kindWord = copied[1].toLowerCase();
            // The kind is certain here, so a separator after it only means the key comes next.
            body = copied[2].replace(/^(?:[—–:|]|-(?=\s))\s*/, '');
        } else {
            const first = body.match(/^(\S+)\s+(.*)$/s);
            // The kind word only counts when a key follows it, not a separator.
            if (first && kindOf(first[1]) && !/^(?:[—–:|]|-(?:\s|$))/.test(first[2])) {
                kind = kindOf(first[1]);
                kindWord = first[1].toLowerCase();
                body = first[2];
            }
        }
    }

    // Split at "|" and trimmed (as `/\s*\|\s*/` did, without its quadratic walk over spaces).
    const parts = body.split('|').map(part => part.trim());
    const { key: rawKey, head } = splitKey(parts.shift());
    // (0.9.10) "~ Hook: Sheepfold Wolves — …": a kind and a colon in front of the key name the
    // kind, they are not part of the key. On a + with no kind yet, they set it.
    let key = stripMarkdown(rawKey).trim();
    const prefixed = key.match(/^([A-Za-z]+)\s*:\s*(\S.*)$/s);
    if (prefixed && kindOf(prefixed[1])) {
        key = prefixed[2].trim();
        if (op === '+' && !kind) {
            kind = kindOf(prefixed[1]);
            kindWord = prefixed[1].toLowerCase();
        }
    }
    const id = lineKey(key);
    if (!id) return { error: 'missing key' };
    if (head.trim()) parts.unshift(head);
    // (0.9.8) Fields run together with commas or semicolons, "type: contract, giver: Nelke, reward:
    // 2 silver", are split as if written with "|": only before a field the format knows, so a
    // comma inside a value ("Nelke, the clerk") stays.
    const expanded = parts.flatMap(splitFieldRun);

    const closing = op === '-' || op === '!';
    const fields = {};
    const extra = {};
    const loose = { text: '' };
    for (const part of expanded) {
        const trimmed = part.trim();
        // A placeholder copied from the format (`- Key — part`) says nothing.
        if (!trimmed || PLACEHOLDER.test(trimmed)) continue;
        const labelled = splitLabel(trimmed);
        if (labelled?.field === 'desc') addText(fields, 'desc', labelled.value);
        // Stored as one of the four words; an empty one clears it (and reads as normal).
        else if (labelled?.field === 'difficulty') fields.difficulty = labelled.value ? questDifficulty(labelled.value) : '';
        else if (labelled?.field) fields[labelled.field] = labelled.value;
        else if (labelled && closing && labelled.label === 'reason') addText(loose, 'text', labelled.value);
        // `label: …` or `field: …` copied from the format: the value is plain text.
        else if (labelled && (labelled.label === 'label' || labelled.label === 'field')) addText(loose, 'text', labelled.value);
        else if (labelled) extra[labelled.label] = labelled.value;
        else addText(loose, 'text', trimmed);
    }

    let reason = '';
    if (closing) reason = loose.text;
    else if (loose.text) {
        // Unlabeled text comes before an explicit `desc:` in the joined description.
        const labelled = fields.desc;
        fields.desc = '';
        addText(fields, 'desc', loose.text);
        addText(fields, 'desc', labelled ?? '');
    }

    if (op === '+' && !kind) kind = inferKind(fields);
    if (kind === 'quest' && !fields.type && Object.hasOwn(QUEST_TYPE_WORDS, kindWord)) fields.type = QUEST_TYPE_WORDS[kindWord];
    return { op: { op, kind, key, id, fields, extra, reason, raw: raw.trim() } };
}

/**
 * Parses change lines, one op per line. Blank lines are ignored; any other line that is not
 * an op becomes `{ line, text, message }` in `errors` (line is 1-based).
 */
export function parseChanges(text) {
    const ops = [];
    const errors = [];
    String(text ?? '').split(/\r?\n/).forEach((raw, index) => {
        if (!raw.trim()) return;
        const result = parseLine(raw);
        if (result.op) ops.push(result.op);
        else errors.push({ line: index + 1, text: raw.trim(), message: result.error });
    });
    return { ops, errors };
}
