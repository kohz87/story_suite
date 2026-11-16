// The notes as editor lines and editor lines back to notes.
import { clean, MAX_SECRETS, SECRET_TEXT_MAX, SECRET_TITLE_MAX, SECRET_WHEN_MAX, slug } from '../npc-meters-config.js';
import { normalizeSecrets, secretId } from './notes.js';

/** The notes as editor lines: `trust 40: [Her past] She is the duke's daughter.`; an event note: `when the duke falls => text`. */
export function secretsToLines(list) {
    return normalizeSecrets(list).map(secret => {
        const body = `${secret.title ? `[${secret.title}] ` : ''}${secret.text}`;
        if (secret.meter === undefined) return `when ${secret.when} => ${body}`;
        return secret.when ? `${secret.meter} ${secret.at} or when ${secret.when} => ${body}` : `${secret.meter} ${secret.at}: ${body}`;
    }).join('\n');
}

/**
 * Editor lines back to notes: one per line, `meter at: text` (`trust 40: …`, `trust >= 40: …`,
 * `tension -30: …`), with an optional title in brackets before the text (`trust 60: [Her past] …`;
 * a title is only for the reader: screens never show it while the note is hidden). A note that opens
 * on a story event is `when the duke falls => text`, and `trust 60 or when the duke falls => text`
 * opens by whichever comes first. A note whose rule and text are unchanged keeps its id. Lines that do
 * not read are returned in `problems`.
 */
export function secretsFromLines(text, previous = []) {
    const kept = new Map(normalizeSecrets(previous).map(secret => [`${secret.meter ?? ''}|${secret.at ?? ''}|${secret.when ?? ''}|${secret.text}`, secret]));
    const secrets = [];
    const problems = [];
    for (const line of String(text ?? '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let meter = '';
        let at = null;
        let when = '';
        let rest = '';
        const event = /^(?:([\p{L}][\p{L}\p{N} _-]*?)\s*(?:>=|≥|<=|≤|at)?\s*([+\-−]?\d{1,4})\s+or\s+)?when\s+(.{1,200}?)\s*=>\s*(.+)$/u.exec(trimmed);
        const plain = event ? null : /^([\p{L}][\p{L}\p{N} _-]*?)\s*(?:>=|≥|<=|≤|at)?\s*([+\-−]?\d{1,4})\s*:\s*(.+)$/u.exec(trimmed);
        if (event) {
            meter = event[1] ? slug(event[1]) : '';
            at = event[2] ? Number(event[2].replace('−', '-')) : null;
            when = clean(event[3], SECRET_WHEN_MAX);
            rest = event[4];
        } else if (plain) {
            meter = slug(plain[1]);
            at = Number(plain[2].replace('−', '-'));
            rest = plain[3];
        } else { problems.push(trimmed); continue; }
        const titled = /^\[([^\]]{1,80})\]\s*(.+)$/u.exec(rest.trim());
        const title = titled ? clean(titled[1], SECRET_TITLE_MAX) : '';
        const body = clean(titled ? titled[2] : rest, SECRET_TEXT_MAX);
        if ((event ? !when : !meter) || !body) { problems.push(trimmed); continue; }
        const byMeter = Boolean(meter) && at !== null;
        // A line left as it was is the note it was: its id and what it came from (`from`) go with it.
        const same = kept.get(`${byMeter ? meter : ''}|${byMeter ? at : ''}|${when}|${body}`);
        const id = same?.id ?? secretId(byMeter ? meter : '', byMeter ? at : 0, body, when);
        if (secrets.some(secret => secret.id === id)) continue;
        if (secrets.length >= MAX_SECRETS) { problems.push(trimmed); continue; }
        secrets.push({ id, ...(byMeter ? { meter, at } : {}), ...(when ? { when } : {}), text: body, ...(title ? { title } : {}), ...(same?.from ? { from: same.from } : {}) });
    }
    return { secrets, problems };
}
