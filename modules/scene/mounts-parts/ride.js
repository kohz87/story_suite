// The reader puts a party member on a mount or takes them off it (`mounts.ride`): the Party paper-doll's Mount slot.
// A rider is a name in the row's `where` ("ridden by Wessel and Tam": riders.js). Every row it changes is written through
// apply (its own `where` only), so a replay after an earlier reply was deleted finds the rows as they are. One rider per
// counted mount (mountsPace's rule: a party with more riders than mounts walks); a mount left behind is not ridden.

import { STRINGS, fill } from '../../../core/strings.js';
import { foldKey } from '../../../core/text.js';
import { cleanName } from '../names.js';
import { travelsWith } from '../../inventory/gear/carry-parts/mount-travel.js';
import { MAX_WHERE } from './caps-text.js';
import { ridersOf } from './riders.js';
import { nameKey } from './shared-keys.js';
import { apply } from './apply.js';

const M = STRINGS.mounts;
const VERB = /^\s*([a-z]+)\s+by\s+/i;

/** "Wessel", "Wessel and Tam", "Wessel, Tam and Mara". */
export const nameList = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** A row's `where` with these riders: the verb it had ("led by") or "ridden by"; '' (with the party) for nobody. */
export function whereWith(where, riders) {
    if (!riders.length) return '';
    const verb = ridersOf(where).length ? VERB.exec(String(where))?.[1] ?? 'ridden' : 'ridden';
    return `${verb} by ${nameList(riders)}`;
}

/** `mounts.ride({ who, mount })`: `who` rides `mount` (off any other one first); `mount: null` takes them off. The reader's only. */
export function ride(ctx, payload = {}) {
    if (ctx.cause !== 'ui' || ctx.caller !== null) ctx.fail('REFUSED', M.readerOnly);
    const who = cleanName(payload.who);
    if (!who) ctx.fail('INVALID', M.rideWho);
    const wanted = payload.mount === null || payload.mount === undefined || payload.mount === '' ? null : cleanName(payload.mount);
    const scene = ctx.draft('scene');
    const rows = Object.values(scene.mounts ?? {});
    const same = name => foldKey(name) === foldKey(who);
    const target = wanted ? rows.find(row => nameKey(row.name) === nameKey(wanted)) ?? null : null;
    if (wanted && !target) ctx.fail('NOT_FOUND', fill(M.none, { name: wanted }));
    let where = null;
    if (target) {
        const riders = ridersOf(target.where);
        if (riders.some(same)) ctx.fail('REFUSED', fill(M.rideAlready, { who, name: target.name }));
        if (!travelsWith(target.where, scene.place?.name ?? '')) ctx.fail('REFUSED', fill(M.rideAway, { name: target.name, where: target.where }));
        if (riders.length >= target.count) ctx.fail('REFUSED', fill(M.rideFull, { name: target.name, riders: nameList(riders) }));
        where = whereWith(target.where, [...riders, who]);
        if (Array.from(where).length > MAX_WHERE) ctx.fail('REFUSED', fill(M.rideLong, { name: target.name }));
    }
    const off = rows.filter(row => row !== target && ridersOf(row.where).some(same));
    if (!target && !off.length) ctx.fail('REFUSED', fill(M.rideNone, { who }));
    for (const row of off) apply(ctx, { match: row.name, where: whereWith(row.where, ridersOf(row.where).filter(name => !same(name))) }, { create: false });
    if (target) apply(ctx, { match: target.name, where }, { create: false });
    return {
        summary: target ? fill(M.rides, { who, name: target.name }) : fill(M.rideOff, { who }),
        data: { who, mount: target?.name ?? null, off: off.map(row => row.name), edit: true },
        narrate: true,
    };
}
