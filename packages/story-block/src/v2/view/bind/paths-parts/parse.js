// Parses binding path text (`name.key[0]['key']`) into a root and steps.

/**
 * Parse a path: `name`, then `.key` or `[0]` / `['key']` / `["key"]` / `[other.path]` steps.
 * Returns `{ root, steps, source }` (a step is `{ key }` or `{ path }`) or null when the text is not a path.
 */
export function parsePath(source) {
    const text = String(source ?? '').trim();
    const reader = { text, at: 0 };
    const path = readPath(reader);
    return path && reader.at === text.length ? path : null;
}

export function readPath(reader) {
    const { text } = reader;
    const head = /^[A-Za-z_$][\w$]*/.exec(text.slice(reader.at));
    if (!head) return null;
    const start = reader.at;
    reader.at += head[0].length;
    const steps = [];
    for (;;) {
        const char = text[reader.at];
        if (char === '.') {
            const key = /^\.(\w+)/.exec(text.slice(reader.at));
            if (!key) return null;
            steps.push({ key: key[1] });
            reader.at += key[0].length;
        } else if (char === '[') {
            reader.at += 1;
            skipSpace(reader);
            const rest = text.slice(reader.at);
            const number = /^\d+/.exec(rest);
            const quoted = /^(?:'([^'\\]*)'|"([^"\\]*)")/.exec(rest);
            if (number) {
                steps.push({ key: number[0] });
                reader.at += number[0].length;
            } else if (quoted) {
                steps.push({ key: quoted[1] ?? quoted[2] });
                reader.at += quoted[0].length;
            } else {
                const inner = readPath(reader);
                if (!inner) return null;
                steps.push({ path: inner });
            }
            skipSpace(reader);
            if (text[reader.at] !== ']') return null;
            reader.at += 1;
        } else break;
    }
    return { root: head[0], steps, source: text.slice(start, reader.at) };
}

export function skipSpace(reader) {
    while (/\s/.test(reader.text[reader.at] ?? '')) reader.at += 1;
}
