// World events, generated arcs (spec §5): running an arc the Director planned. `startArc` copies the checked plan into the step's state
// (`ws.arcs[slot key]`, so later steps never read the ledger); `arcsDay` fires each running arc's next step like a chain stage: its window
// opens `after` days (tempo-scaled) after the previous step, lasts `within` days, and a seeded draw picks the day (1 in the days left, so it
// fires by the window's last day). A step is checked again when it fires (a ladder or a figure may have changed); one that no longer holds is
// skipped with a Problems line, the plan is never rewritten. A minor step counts against the region's density but is not blocked by it;
// an arc with a major step holds one major slot in its realm while it runs (caps.js), takes it, and resets the realm's 45-day timer when it
// starts. When the last step (the ending) has fired or been skipped the arc ends and `arc-ended:<template>@<ref>` is recorded. No Director call. Pure on `ws`.

import { applyEffects } from './effects.js';
import { scaleDays } from './durations.js';
import { checkOpen } from './open-check.js';
import { recordAnchor } from './anchors.js';
import { capBlock, takeSlots } from './caps.js';

const KEEP_ENDED_DAYS = 40;
const KEEP_ARCS = 12;

/** Starts the arc of an applied slot, or returns why not (the caps) as text. `plan` is from arc-plan.js `checkAnswer`. */
export function startArc(ws, def, slot, plan, day) {
    if (plan.major) {
        const block = capBlock(ws, [slot.realm], day);
        if (block) return block;
        takeSlots(ws, [slot.realm], day);
    }
    ws.arcs[slot.key] = { template: def.id, place: slot.place, placeSlug: slot.key.slice(slot.key.lastIndexOf('|') + 1), region: slot.region || '', ...(slot.regionName ? { regionName: slot.regionName } : {}), realm: slot.realm, started: day, major: plan.major, state: 'running', next: 0, from: day, steps: structuredClone(plan.steps) };
    return '';
}

function finish(ws, arc, day) {
    arc.state = 'ended';
    arc.ended = day;
    for (const ref of [arc.place, arc.placeSlug, arc.region, arc.regionName, arc.realm]) if (ref) recordAnchor(ws.anchors, `arc-ended:${arc.template}@${String(ref).toLowerCase()}`, day);
}

function fire(ws, arc, step, day) {
    const def = ws.templates.get(arc.template);
    const bind = { place: arc.place, region: arc.region || null, realm: arc.realm };
    const checked = def ? checkOpen(ws, def, bind, step, day) : { errors: ['the template is gone'] };
    if (checked.errors.length) ws.warnings.push(`The arc of "${arc.template}" at ${arc.place}: step "${step.name}" no longer holds (${checked.errors[0]}); it was skipped.`);
    else {
        applyEffects(ws, checked.block, { kind: 'template', id: arc.template, title: checked.name, held: false, open: true }, day, bind);
        ws.journal.push({ day, text: checked.summary, title: checked.name, by: `template:${arc.template}`, place: arc.place, reach: def.reach });
        if (!step.major) ws.minors.push({ region: arc.region || arc.place, day });
        ws.log.push({ kind: 'arc', key: arc.template, day, place: arc.place, step: arc.next + 2 });
    }
    arc.from = day;
    arc.next += 1;
    if (step.ending || arc.next >= arc.steps.length) finish(ws, arc, day);
}

/** One day of every running arc, in the order they started. */
export function arcsDay(ws, day) {
    for (const arc of Object.values(ws.arcs)) {
        if (arc.state !== 'running') continue;
        const step = arc.steps[arc.next];
        const open = arc.from + scaleDays(step.after, ws.tempo);
        const left = open + scaleDays(step.within, ws.tempo) - day;
        if (day < open) continue;
        if (left > 0 && ws.draw(day, `arc:${arc.template}:${arc.started}:${arc.place}#${arc.next}`) >= 1 / left) continue;
        if (left <= 0) {
            ws.warnings.push(`The arc of "${arc.template}" at ${arc.place}: step "${step.name}" did not come in its window; it was skipped.`);
            arc.from = day;
            arc.next += 1;
            if (step.ending || arc.next >= arc.steps.length) finish(ws, arc, day);
        } else fire(ws, arc, step, day);
    }
    const keys = Object.keys(ws.arcs);
    for (const key of keys) if (ws.arcs[key].state === 'ended' && day - ws.arcs[key].ended > KEEP_ENDED_DAYS) delete ws.arcs[key];
    for (const key of Object.keys(ws.arcs).slice(0, Math.max(0, Object.keys(ws.arcs).length - KEEP_ARCS))) if (ws.arcs[key].state === 'ended') delete ws.arcs[key];
}
