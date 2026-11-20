// The wear a v1 fight costs the gear, worked out from the played record (pure; the settle makes the calls): a DECISIVE hit TAKEN wears the hit hero's body armour (else the off-hand) one step,
// a DECISIVE miss of the hero's own attack (a natural 1, or a lead of the decisive margin the other way) wears their weapon one step; a broken piece, or no piece, wears nothing.
// The same rule as the earlier engine's (gear-parts/wear.js); it is paid once per settle (the settle is claimed once), so a swipe, a Re-read, a rewind and a reload wear the same.
import { V1 } from '../combat/numbers.js';
import { actorIdOf } from '../roster.js';
import { condWord, stepDown } from '../../inventory/gear.js';

const EVENTS_MAX = 24;

/**
 * `{ events, calls }`: `events` = [{ n (the exchange), who, item, from, to }] as the narrator is told them, `calls` = [{ owner, slot: 'defence' | 'weapon' }] one `gear.wear` each.
 * `modules` maps a hero key to its Character block; `slotsOf(owner)` answers what the owner wears now ({ body, 'off-hand', weapon } with `cond`, `name`; nothing while gear is off).
 */
export function wearOfV1(record, { modules = {}, slotsOf }) {
    const heroes = new Map((record?.party ?? []).map(hero => [hero.label, hero])), first = (record?.party ?? [])[0]?.id;
    const conds = new Map(), events = [], calls = [], areas = new Set();
    let n = 0;
    for (const line of record?.lines ?? []) {
        if (line[0] === 'exchange') { n = Number(line[1]) || n + 1; areas.clear(); continue; }
        if (events.length >= EVENTS_MAX) break;
        let hero = null, place = null;
        if (line[0] === 'foe-attack' && line[7] === 'decisive') { hero = heroes.get(line[2]); place = ['body', 'off-hand']; }
        else if (line[0] === 'attack' && (line[8] === 'miss-nat1' || (line[8] === 'miss' && Number(line[7]) - Number(line[5]) >= V1.decisiveMargin))) {
            hero = heroes.get(line[1]);
            if (line[2] === 'area') { if (areas.has(hero?.label)) hero = null; else areas.add(hero?.label); }   // (one area blow is one blow, however many foes it meets)
            place = ['weapon'];
        }
        if (!hero || !modules[hero.id]) continue;
        const owners = [actorIdOf(modules[hero.id]), ...(hero.id === first ? ['party'] : [])];
        for (const owner of owners) {
            const worn = slotsOf(owner) ?? {}, slot = place.find(name => worn[name]);
            if (!slot) continue;
            const mark = `${owner}/${slot}`, before = conds.get(mark) ?? worn[slot].cond;
            if (!(before > 0) || worn[slot].broken === true) break;
            const now = stepDown(before, 1);
            conds.set(mark, now);
            events.push({ n, who: hero.label, item: worn[slot].name, from: condWord(before), to: condWord(now) });
            calls.push({ owner, slot: line[0] === 'foe-attack' ? 'defence' : 'weapon' });
            break;
        }
    }
    return { events, calls };
}
