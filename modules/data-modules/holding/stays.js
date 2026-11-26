// Who may take a post of the holding, asked once, when the story's line is read (the answer is recorded with the line): a person the story knows,
// not travelling with You, who is staying at the seat, one post each. Staying is read from the cast's record ("waits for You at <place>"), else
// from where NPC State last put them, else from the scene when it is at the seat and lists them.
import { fold, readSheet, sameWho } from '../../rpg/read.js';
import { isMet } from '../../cast/cast/domain.js';
import { samePlace } from '../../cast/cast/entries-parts/places.js';
import { POSTS, postsOf, travels } from './posts.js';

const CHAPLAIN = new Set(['chaplain', 'healer/chaplain', 'healer or chaplain']);

/** The line's labels as the kind declares them: `who:` is its `person` (`who` is the host's own word), and a chaplain's post is the healer's (one post under two names). */
export function postLabels(labels) {
    const { who, ...rest } = labels ?? {};
    return { ...rest, ...(who !== undefined ? { person: who } : {}), ...(CHAPLAIN.has(fold(rest.post ?? '')) ? { post: 'healer' } : {}) };
}

const namesOf = person => [person?.name, ...(Array.isArray(person?.aliases) ? person.aliases : [])].filter(name => typeof name === 'string' && name.trim());
const listOf = value => (Array.isArray(value) ? value : []);

/** `{ who }` (the name the story keeps them under) when the person may take the post, else `{ why }`, the reason in words. */
export function postProblem(ctx, prefix, fields, { post, person: who }, isReader) {
    const ask = name => { try { return ctx.query(name, {}); } catch { return null; } };
    if (!fields.seat) return { why: 'the holding has no seat yet, so nobody can stay there' };
    const named = (person, names) => namesOf(person).some(name => names.some(other => fold(name) === fold(other)));
    const rows = listOf(ask('people.list')).filter(row => named(row, [who]));
    const row = rows.length === 1 ? rows[0] : null;
    const party = readSheet(prefix, { withLeft: true }).characters;
    const member = party.find(one => sameWho(one, who, row ? namesOf(row) : [], party));
    const names = [who, ...namesOf(row), ...(member ? [member.who] : [])];
    let cast = null;
    try { cast = ctx.read('cast')?.people; } catch { cast = null; }
    // (only someone already met: a pack person the story has not shown is not known yet)
    const known = Object.values(cast ?? {}).find(one => isMet(one) && named(one, names)) ?? null;
    if (!row && !member && !known) return { why: `${who} is nobody the story knows` };
    const name = [...String(member?.who ?? row?.name ?? known.name)].slice(0, 40).join('');
    if (isReader(name)) return { why: `${name} is You; a post is for someone who stays behind` };
    if (row?.lifeState === 'deceased' || known?.alive === false) return { why: `${name} is dead` };
    if (travels(prefix, name)) return { why: `${name} travels with You; only someone who stays at the seat can hold a post` };
    if (fields[post]) return { why: fold(fields[post]) === fold(name) ? `${name} already holds that post` : `${fields[post]} holds the ${POSTS[post]} post; free it first (kind: unpost)` };
    const [other] = postsOf(fields, name);
    if (other) return { why: `${name} already holds the ${POSTS[other]} post; one post each` };
    const inScene = listOf(ask('scene.present')).some(entry => names.some(one => fold(typeof entry === 'string' ? entry : entry?.name ?? '') === fold(one)));
    const here = String(ask('scene.place')?.name ?? '');
    if (inScene && samePlace(here, fields.seat)) return { who: name };
    if (inScene) return { why: `${name} is with You at ${here || 'another place'}, not at the seat (${fields.seat})` };
    // The cast's record, unless NPC State has put them somewhere new since the cast last looked (an earlier line of this reply).
    const first = slot => (Array.isArray(slot) ? slot[0] : slot) ?? null;
    const base = first(known?.base), told = first(known?.told), where = String(row?.location ?? '').trim();
    const moved = Boolean(where && told && fold(where) !== fold(told.where));
    const at = (base?.at && !moved ? base.at : where) || base?.at || '';
    if (at) return samePlace(at, fields.seat) ? { who: name } : { why: `${name} is at ${at}, not at the seat (${fields.seat})` };
    return { why: `nothing says ${name} is staying at the seat (${fields.seat})` };
}
