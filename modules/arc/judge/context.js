// Story Director v2, part **arc**: what the Director judge is told about the world (switch story-director.world-events): the Active events, the events still to
// come, the conditions in the party's realm, the protected cast, hidden lore by title only, and the lore digest (titles, then the entries whose keys match the
// place). Hidden lore's text is never sent, whatever the digest holds. Pure on the brief (`chronicle.world.brief`) and the query handed in.

const MAX_TITLES_CHARS = 4400;
const MAX_ENTRIES_CHARS = 2400;
const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const list = value => (Array.isArray(value) ? value : []);

function lore(ask, hidden, place) {
    const keep = title => !hidden.has(norm(title).toLowerCase());
    let digest = null;
    let found = null;
    try { digest = ask('director.loreDigest', {}); } catch { digest = null; }
    try { found = ask('director.loreFor', { place }); } catch { found = null; }
    const titles = list(digest?.lines).map(line => norm(line?.title)).filter(title => title && keep(title)).join('; ').slice(0, MAX_TITLES_CHARS);
    const entries = list(found?.entries).filter(entry => entry && keep(entry.title)).map(entry => `${norm(entry.title)}: ${norm(entry.text)}`).join('\n').slice(0, MAX_ENTRIES_CHARS);
    return [titles ? `Lore titles: ${titles}` : '', entries ? `Lore for here:\n${entries}` : ''].filter(Boolean);
}

/** The world text for the judge's prompt; `ask(name, args)` is the host's query, `place` the scene's place. */
export function judgeContext({ brief, ask, place = '' } = {}) {
    if (!brief || typeof brief !== 'object') return '';
    const hidden = new Set(list(brief.hidden).map(title => norm(title).toLowerCase()));
    const parts = [];
    const events = list(brief.threads).filter(thread => thread && typeof thread.key === 'string');
    if (events.length) parts.push('Active world events (the world settles them):', ...events.map(thread => `- ${norm(thread.key)}${thread.now ? ` — ${norm(thread.now)}` : ''}`));
    const toCome = list(brief.toCome).filter(title => typeof title === 'string' && title.trim());
    if (toCome.length) parts.push('Still to come:', ...toCome.map(title => `- ${norm(title)}`));
    const conditions = list(brief.conditions).filter(text => typeof text === 'string' && text.trim());
    if (conditions.length) parts.push('Conditions in this realm:', ...conditions.map(text => `- ${norm(text)}`));
    const cast = list(brief.protectedCast).filter(name => typeof name === 'string' && name.trim());
    if (cast.length) parts.push(`Protected cast (never killed, moved or changed by a plan): ${cast.map(norm).join('; ')}`);
    const hiddenTitles = list(brief.hidden).filter(title => typeof title === 'string' && title.trim());
    if (hiddenTitles.length) parts.push(`Hidden lore, titles only (never reveal or hint): ${hiddenTitles.map(norm).join('; ')}`);
    if (typeof ask === 'function') parts.push(...lore(ask, hidden, place));
    return parts.join('\n');
}
