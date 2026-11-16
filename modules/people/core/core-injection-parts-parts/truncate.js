/* NPC State Delta injection: cutting injection text to a budget, fairly across fields or at a clause boundary. */


export function truncateInjectionText(value, maxChars) {
    const text = String(value || '').trim();
    const cap = Math.max(0, Math.floor(maxChars));
    if (!text || cap <= 0) return '';
    if (text.length <= cap) return text;
    if (cap <= 1) return text.slice(0, cap);
    return `${text.slice(0, cap - 1).trimEnd()}…`;
}

export function fairInjectionParts(parts, maxChars) {
    const entries = (Array.isArray(parts) ? parts : []).map(value => String(value || '').trim()).filter(Boolean);
    const cap = Math.max(0, Math.floor(maxChars));
    if (!entries.length || cap <= 0) return '';
    if (entries.length === 1) return truncateInjectionText(entries[0], cap);
    const separators = (entries.length - 1) * 2;
    const usable = Math.max(entries.length * 20, cap - separators);
    const share = Math.max(20, Math.floor(usable / entries.length));
    const itemCaps = entries.map(() => share);
    let rendered = entries.map((entry, i) => truncateInjectionText(entry, itemCaps[i]));
    let used = rendered.join('; ').length;
    let remaining = Math.max(0, cap - used);
    // Redistribute unused room to the fields that were actually truncated, so short fields
    // do not waste the budget while every established identity channel still gets a seat.
    for (let rounds = 0; rounds < entries.length * 3 && remaining > 0; rounds += 1) {
        let best = -1;
        let bestNeed = 0;
        for (let i = 0; i < entries.length; i += 1) {
            const need = entries[i].length - rendered[i].length;
            if (need > bestNeed) { bestNeed = need; best = i; }
        }
        if (best < 0 || bestNeed <= 0) break;
        const add = Math.min(bestNeed, remaining, 80);
        itemCaps[best] += add;
        rendered[best] = truncateInjectionText(entries[best], itemCaps[best]);
        used = rendered.join('; ').length;
        remaining = Math.max(0, cap - used);
    }
    return truncateInjectionText(rendered.join('; '), cap);
}

export function clauseBoundedInjection(text, room) {
    const labelEnd = text.indexOf('): ') + 3;
    if (room < 80 || labelEnd < 3) return '';
    const cut = text.slice(0, room);
    const boundary = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', '));
    return boundary >= labelEnd + 20 ? cut.slice(0, boundary) : '';
}
