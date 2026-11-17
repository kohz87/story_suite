/* What a Refresh reads of a person's recorded tastes and ties (read-only): the dossier notes' rows as the two short strings the prompt shows. */
const TASTE_LIMIT = 12;
const word = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/** `notes` is the hosted dossier view's notes ({ tastes: [{ sign, item }], ties: [{ name, tags, owes }] }); null when it holds neither. */
export function storedReads(notes) {
    const rows = (Array.isArray(notes?.tastes) ? notes.tastes : []).filter(row => word(row?.item)).slice(0, TASTE_LIMIT);
    const likes = rows.filter(row => row.sign !== '-').map(row => word(row.item));
    const dislikes = rows.filter(row => row.sign === '-').map(row => word(row.item));
    const tastes = [likes.length ? `likes: ${likes.join(', ')}` : '', dislikes.length ? `dislikes: ${dislikes.join(', ')}` : ''].filter(Boolean).join('; ');
    const ties = (Array.isArray(notes?.ties) ? notes.ties : []).filter(row => word(row?.name) && (row.tags?.length || row.owedBy))
        .map(row => `with ${word(row.name)}: ${[...(row.tags || []), ...(row.owedBy && !(row.tags || []).includes('owed') ? ['owed by them'] : [])].join(', ')}`);
    return tastes || ties.length ? { tastes, ties } : null;
}
