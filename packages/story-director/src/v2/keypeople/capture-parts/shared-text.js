// Story Director v2, part **keypeople**: message text of a line and the JSON pointers of away and taken-off records.

/** The line as the story wrote it, for messages. */
export function lineText(line) {
    const labels = Object.entries(line?.labels ?? {}).map(([label, value]) => ` | ${label}: ${value}`).join('');
    return `${line?.op ?? ''} ${line?.kind ?? ''} ${line?.name ?? ''}${line?.text ? ` — ${line.text}` : ''}${labels}`.trim();
}

// The JSON pointer of one away record (or taken-off record), inside the domain.
export const awayPath = key => `/away/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
export const gonePath = key => `/gone/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
