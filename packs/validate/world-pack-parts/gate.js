// The job: checking a reveal gate string (spec §7): anchors, place:, quote:, and stage / meter tests joined by "or" / "and" (no parentheses).
// `owner`: the person a secret belongs to ({ id, stages, meters }), or null for a lore gate, where `stage of <id>` / `meter <m> of <id>` name the person.

import { CAST_BUILT_IN_METERS, STANDING } from '../../limits.js';
import { checkAnchorText } from './entries.js';
import { parseAnchor } from './grammar.js';

const JOIN = /\s+(?:and|or)\s+(?=(?:fired|ended|set|cleared|lapsed|died|departed|fact|place|quote):|stage\b|meter\b)/;
const ANCHORS = ['fired', 'ended', 'set', 'cleared', 'lapsed', 'died', 'departed', 'fact'];

function personFor(of, owner, ctx, field, text) {
    if (owner && (of === undefined || of === owner.id)) return owner;
    if (owner) return ctx.say(field, `"${text}": a secret's stage and meter tests are about its owner; drop "of ${of}".`), null;
    if (of === undefined) return ctx.say(field, `"${text}": in a lore gate a stage or meter test names the person ("of <cast id>").`), null;
    if (ctx.index.refused.has(of)) return ctx.collect.warnings.push([field, `"${text}": "${of}" was refused (see the cast Problems).`]), null;
    const person = ctx.index.person(of);
    if (!person) return ctx.say(field, `"${text}": "${of}" is not a cast id.`, 'UNKNOWN_REF'), null;
    return person;
}

function stageTest(match, owner, ctx, field, text) {
    const person = personFor(match[1], owner, ctx, field, text);
    if (!person) return;
    const stages = person.stages ?? [];
    const named = /^"(.*)"$/.exec(match[2]);
    if (named && !stages.some(stage => stage.name === named[1])) ctx.say(field, `"${text}": ${person.id} has no stage named "${named[1]}".`, 'UNKNOWN_REF');
    else if (!named && !(Number.isInteger(Number(match[2])) && Number(match[2]) >= 1 && Number(match[2]) <= stages.length)) ctx.say(field, `"${text}": a stage number is 1 to ${stages.length} (the person has ${stages.length} stages); name the stage instead.`, 'UNKNOWN_REF');
}

function meterTest(match, owner, ctx, field, text) {
    const person = personFor(match[2], owner, ctx, field, text);
    if (!person) return;
    const known = CAST_BUILT_IN_METERS.includes(match[1]) || Object.hasOwn(person.meters ?? {}, match[1]) || typeof person.meters?.preset === 'string';
    if (!known) ctx.say(field, `"${text}": "${match[1]}" is not one of ${person.id}'s meters.`, 'UNKNOWN_REF');
    const at = Number(match[3]);
    if (!Number.isInteger(at) || at < STANDING.min || at > STANDING.max) ctx.say(field, `"${text}": the number must be a whole number from ${STANDING.min} to ${STANDING.max}.`);
}

/** Checks the whole gate; says one Problem per bad term. */
export function checkGate(gate, ctx, field, owner = null) {
    if (typeof gate !== 'string' || !gate.trim()) return ctx.say(field, 'a gate is one non-empty string (no object form), like "fact:vault-opened or meter trust of sir-lothar >= 40".');
    if (/[()]/.test(gate.replace(/quote:.*$/, ''))) return ctx.say(field, `"${gate}": a gate has no parentheses ("and" binds tighter than "or").`);
    for (const term of gate.trim().split(JOIN).map(part => part.trim())) {
        let match;
        if ((match = /^stage(?: of ([a-z0-9-]+))?\s*>=\s*("[^"]*"|\d+)$/.exec(term))) stageTest(match, owner, ctx, field, term);
        else if ((match = /^meter ([a-z0-9-]+)(?: of ([a-z0-9-]+))?\s*>=\s*(-?\d+)$/.exec(term))) meterTest(match, owner, ctx, field, term);
        else if ((match = /^meter ([a-z0-9-]+)\s*>=\s*(-?\d+) of ([a-z0-9-]+)$/.exec(term))) meterTest([match[0], match[1], match[3], match[2]], owner, ctx, field, term);
        else if (term.startsWith('place:')) { if (!ctx.index.ref(term.slice(6).trim()).has('place')) ctx.say(field, `"${term}": "${term.slice(6).trim()}" is not a place of this pack.`, 'UNKNOWN_REF'); }
        else if (term.startsWith('quote:')) { if (!term.slice(6).trim()) ctx.say(field, `"${term}" quotes nothing.`); }
        else if (term.startsWith('stage') || term.startsWith('meter')) ctx.say(field, `"${term}" is not a stage or meter test: write stage >= "Trusted" or meter trust >= 40 (">=" only).`);
        else {
            const anchor = parseAnchor(term);
            if (anchor.error || !ANCHORS.includes(anchor.kind) || anchor.offset) ctx.say(field, `"${term}" is not a gate term (fired:, ended:, set:, cleared:, lapsed:, died:, departed:, fact:, place:, quote:, stage, meter).`);
            else checkAnchorText(term, ctx, field);
        }
    }
}
