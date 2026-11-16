// The scene's place: `~ place Name | kind | region | with: …` and the `scene.place` command. A move takes the place's kind from a
// pack when one names it (on a reply marked `placeFromMap`, its kind and region from the map or a pack), keeps who came along, and leaves the rest behind. Pure.

import { labelOf } from '../common.js';
import { cleanName } from '../names.js';
import { foldKey } from '../../../text.js';
import { MAX_NAME, MAX_PRESENT } from './constants.js';
import { companions } from './present.js';
import { clearLook } from './you-look.js';
import { knownPlace, knownPlaces } from './place-known.js';
import { told } from './shared.js';

function field(ctx, value, what) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') ctx.fail('INVALID', `The place's ${what} must be text.`);
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length > MAX_NAME) ctx.fail('INVALID', `The place's ${what} is longer than ${MAX_NAME} characters.`);
    return text;
}

// The kind of a place a pack names (by name or alias, `packs.content({ kind: 'places' })`), or null. Kept beside `knownPlace` for byte-identical replay of unmarked replies.
function packPlaceKind(ctx, name) {
    let places;
    try { places = ctx.query('packs.content', { kind: 'places' }); } catch { return null; }
    if (!Array.isArray(places)) return null;
    const key = foldKey(name);
    const place = places.find(entry => [entry?.name, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])].some(other => typeof other === 'string' && foldKey(other) === key));
    return typeof place?.kind === 'string' && place.kind.trim() ? place.kind : null;
}

// A place's kind: what the line says (an explicit empty `kind:` clears it); without `kind:`, the
// same place keeps its stored kind (a model often leaves it out), and a move to another place takes
// the kind a pack gives a place of that name, else none (B4r2-5: never the old place's kind). The
// region is kept unless the line says otherwise. Who was
// present stays behind: after a move only the people named in `with` (they came along) are here, and
// the story adds whoever it meets there (`+ present`). The same place keeps everyone; `with` adds to them.
export function setPlace(ctx, { name, kind, region, with: along }, { keepPresent = false, departed = [], fromMap = false } = {}) {
    const scene = ctx.draft('scene');
    const placeName = field(ctx, name, 'name');
    if (!placeName) ctx.fail('INVALID', 'A place needs a name.');
    const moved = placeName.toLowerCase() !== scene.place.name.toLowerCase();
    const came = companions(ctx, along).filter(person => !keepPresent || !departed.includes(person.toLowerCase()));
    // A move leaves the passing look behind (only a reply marked `youLook`: an older one keeps its look on Re-read).
    if (moved && scene.you && ctx.carrier?.rules?.includes('youLook')) scene.you = clearLook(scene.you);
    // Whoever comes along is added once: replayed after a reply that took them out was deleted, the add is passed over.
    ctx.unique('scene', '/present');
    // A marked reply's move takes a kind and region the line leaves out from the map (or a pack) when it knows the place; an explicit label wins.
    const known = fromMap && moved ? knownPlace(ctx, placeName) : null;
    const fromKnown = what => (typeof known?.[what] === 'string' && known[what].trim() ? field(ctx, known[what], what) : null);
    const given = { kind: field(ctx, kind, 'kind'), region: field(ctx, region, 'region') };
    const filled = [given.kind === null && fromKnown('kind') ? 'kind' : '', given.region === null && fromKnown('region') ? 'region' : ''].filter(Boolean);
    scene.place = {
        name: placeName,
        kind: given.kind ?? fromKnown('kind') ?? (moved ? field(ctx, packPlaceKind(ctx, placeName), 'kind') ?? '' : scene.place.kind),
        region: given.region ?? fromKnown('region') ?? scene.place.region,
    };
    const keys = list => new Set(list.map(person => person.toLowerCase()));
    const cameKeys = keys(came);
    const left = moved && !keepPresent ? scene.present.filter(person => !cameKeys.has(person.toLowerCase())) : [];
    const staying = moved && !keepPresent ? scene.present.filter(person => cameKeys.has(person.toLowerCase())) : [...scene.present];
    const stayingKeys = keys(staying);
    const present = [...staying, ...came.filter(person => !stayingKeys.has(person.toLowerCase()))];
    if (present.length > MAX_PRESENT) ctx.fail('INVALID', `At most ${MAX_PRESENT} people can be listed as present.`);
    if (present.length !== scene.present.length || present.some((person, at) => person !== scene.present[at])) scene.present = present;
    const withWho = came.length ? ` with ${came.join(', ')}` : '';
    const fromTheMap = filled.length ? ` (${filled.map(what => (filled.length > 1 ? '' : `${what} `) + scene.place[what]).join(', ')}, from the map)` : '';
    return {
        summary: moved ? `The scene moves to ${placeName}${fromTheMap}${withWho}.` : `${placeName} is described anew.`,
        data: { ...scene.place, moved, present: [...scene.present], left },
        narrate: told(ctx),
    };
}

/** `~ place Name | kind | region | with: who came along` (or `+ place`). */
export function capturePlace(ctx, line) {
    if (line?.op !== '~' && line?.op !== '+') {
        ctx.fail('INVALID', `"${line?.op} place" is not a change the scene understands; use ~ place Name.`);
    }
    const keepPresent = ['now', 'late'].includes(ctx.carrier?.assist) && ctx.carrier?.rules?.includes('assistPlace');
    // A safety-net place the reply's own lines contradict is refused (the carrier's check; absent on Re-read of a line already kept).
    const why = keepPresent && typeof ctx.carrier.assistCheck === 'function' ? ctx.carrier.assistCheck(line, knownPlaces(ctx)) : '';
    if (why) ctx.fail('REFUSED', why);
    return setPlace(ctx, {
        name: cleanName(line.name),
        kind: labelOf(line, 'kind', 'type'),
        region: labelOf(line, 'region', 'area'),
        with: labelOf(line, 'with', 'present'),
    }, { keepPresent, departed: keepPresent ? ctx.carrier.assistLeft : [], fromMap: Boolean(ctx.carrier?.rules?.includes('placeFromMap')) });
}
