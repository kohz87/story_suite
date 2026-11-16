// The modifier one NPC gives one social skill: meter points and the reasons that add up to it.
import { clean, words } from './shared-text.js';
import { socialSettings } from './settings.js';
import {
    RANK_BONUS_MAX,
    STEPS,
    SKILL_METERS,
    DISPOSITION_WORDS,
} from './rules.js';

/** What a meter's value says, high (+) and low (−); a meter not listed reads "<Name>: <label> high/low". */
const METER_WORDS = Object.freeze({
    trust: ['trusts you', 'distrusts you'],
    affection: ['is fond of you', 'dislikes you'],
    desire: ['is drawn to you', 'is put off by you'],
    tension: ['is wary of you', 'is at ease with you'],
    fear: ['fears you', 'is not afraid of you'],
    loyalty: ['is loyal to you', 'owes you little loyalty'],
    respect: ['respects you', 'looks down on you'],
    approval: ['approves of you', 'disapproves of you'],
    suspicion: ['suspects you', 'takes you at your word'],
    rivalry: ['sees you as a rival', 'does not see you as a rival'],
});

const NAME_MAX = 60;
const TEXT_MAX = 100;
// Half away from 0, so −1.5 and +1.5 round alike.
const roundAway = value => Math.sign(value) * Math.round(Math.abs(value));
const DISPOSITION_BY_WORD = new Map(Object.entries(DISPOSITION_WORDS).flatMap(([kind, list]) => list.map(word => [word, kind])));

/** Points for a meter's value: 0..3 by STEPS on its share of the range's far end, signed like the value. */
export function meterPoints(value, def) {
    if (!Number.isInteger(value) || !value) return 0;
    const reach = Math.max(Math.abs(Number(def?.min) || 0), Math.abs(Number(def?.max) || 0)) || 100;
    const share = Math.abs(value) * 100 / reach;
    const points = STEPS.filter(step => share >= step).length;
    return Math.sign(value) * points;
}

/**
 * The modifier for one NPC and one social skill (rules in the header).
 *   name         the NPC's name as the reasons show it
 *   skill        one of SOCIAL_SKILLS (socialSkill's answer)
 *   meters       [{ def, value, stage }] in Delta's meter order (def: { id, label, min, max })
 *   rank         { name, index } the ladder rung reached (index from 0), or null
 *   disposition  the slice's disposition word, or ''
 *   settings     { scale, cap } (socialSettings)
 * → { mod, name, skill, reasons: [{ text, value }] }.
 */
export function socialModifier({ name, skill, meters = [], rank = null, disposition = '', settings = socialSettings() }) {
    const who = clean(name, NAME_MAX) || 'They';
    const weights = SKILL_METERS[skill] ?? {};
    const raw = [];
    for (const { def, value, stage } of Array.isArray(meters) ? meters : []) {
        const weight = weights[def?.id];
        if (!weight) continue;
        const points = meterPoints(value, def);
        if (!points) continue;
        const said = METER_WORDS[def.id]?.[points > 0 ? 0 : 1] ?? `${clean(def.label, 40).toLocaleLowerCase()} ${points > 0 ? 'high' : 'low'}`;
        const where = clean(stage, 40);
        raw.push({ text: `${who} ${said}${where ? ` (${where})` : ''}`, value: points * weight });
    }
    if (skill !== 'intimidate' && rank && Number.isInteger(rank.index) && rank.index >= 0) {
        raw.push({ text: `${who}: ${clean(rank.name, 40) || 'stage reached'}`, value: Math.min(RANK_BONUS_MAX, rank.index + 1) });
    }
    const word = words(disposition)[0] ?? '';
    const kind = DISPOSITION_BY_WORD.get(word);
    const given = skill === 'intimidate'
        ? (kind === 'afraid' ? 1 : kind === 'defiant' ? -1 : 0)
        : (kind === 'warm' ? 1 : kind === 'cold' ? -1 : 0);
    if (given) raw.push({ text: `${who} is ${clean(disposition, 40)}`, value: given });

    const { scale, cap } = settings;
    const reasons = raw
        .map(reason => ({ text: clean(reason.text, TEXT_MAX), value: roundAway(reason.value * scale / 100) }))
        .filter(reason => reason.value !== 0);
    const sum = reasons.reduce((total, reason) => total + reason.value, 0);
    const mod = Math.min(cap, Math.max(-cap, sum));
    if (mod !== sum) reasons.push({ text: `Held to the most a check moves (${mod > 0 ? '+' : '−'}${cap})`, value: mod - sum });
    return { mod, name: who, skill, reasons };
}
