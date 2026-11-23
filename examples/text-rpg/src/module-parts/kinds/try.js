// `? try Who | skill or stat | difficulty`: the code reads the verdict from the reply's recorded die, the bonus and the difficulty.
import { DIFFICULTIES, difficultyIndex, floorIndex, raiseToFloor } from '../../rules/difficulty.js';
import { harmFor } from '../../rules/harm.js';
import { rollPractice } from '../../rules/practice.js';
import { verdict } from '../../rules/roll.js';
import { stageOf } from '../../words/pools.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { priorThreat, recordOf } from '../dice-source.js';
import { BAND_WORD } from '../band-words.js';
import { bonusFor } from '../bonus.js';
import { addPractice, threatHeard } from '../practice-gain.js';
import { costPaidAlready } from '../paid-marks.js';
import { floorWhy } from '../floor-why.js';
import { liveConditions } from '../conditions.js';
import { skillActive } from '../effective.js';
import { gearOf } from '../gear.js';
import { poolWith } from '../gear-sizes.js';
import { partsOf, labelOf } from '../line-read.js';
import { toneStep } from '../settings.js';
import { woundsAfter, woundsOf } from '../standing.js';
import { spendCost } from './pools.js';
import { wearGear } from './wear.js';
import { target } from './target.js';

const PHYSICAL = ['str', 'vit', 'agi', 'dex'];
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

export function applyTry(ctx, line) {
    const { slice, member } = target(ctx, line, { acts: true });
    const [what, ...rest] = partsOf(line);
    // The difficulty word is the first part that is one, so a narrator's extra part (`| slip past | hard`) does not hide it.
    const word = rest.find(part => DIFFICULTIES.some(item => item.word === part.toLowerCase())) ?? rest[0];
    if (!what) ctx.fail('INVALID', 'A roll needs a skill or a stat.');
    const record = recordOf(ctx, slice);
    if (!record) ctx.fail('REFUSED', 'There are no dice for this reply.');
    if ((record.used ?? 0) >= record.list.length) ctx.fail('LIMITED', 'This reply has used all its dice.');
    const { cap } = gearOf(ctx.query, member);
    const found = bonusFor(member, what, cap);
    if (!found) ctx.fail('NOT_FOUND', `${member.name} has no skill or stat called ${what.slice(0, 40)}.`);
    if (found.skill && !skillActive(member, found.skill)) ctx.fail('REFUSED', `${found.skill.name} is not known at this level.`);
    // A `~ spend` of the same skill earlier in this reply already paid it (and a later one will see this try paid).
    const costPaid = found.skill ? costPaidAlready(slice, ctx.reply?.sid, found.skill, 'try') : false;
    const refused = found.skill && !costPaid ? spendCost(member, found.skill, cap) : '';
    if (refused) ctx.fail('NOT_ENOUGH', refused);

    const said = THREAT_WORDS.indexOf(labelOf(line, 'threat').toLowerCase());
    // The threat is the line's own, else this reply's earlier one, else the latest earlier reply's, else none (not in danger).
    const threat = said >= 0 ? said : record.threat ?? priorThreat(slice, ctx.reply?.sid);
    const drained = stageOf(poolWith(member, 'sp', cap).now, poolWith(member, 'sp', cap).max, 'energy').index >= 3;
    const own = floorIndex({ threat, conditions: liveConditions(member, ctx.time?.() ?? null).length, drained, physical: PHYSICAL.includes(found.stat) });
    const floor = Math.max(record.floor, own);
    // The word is raised to the floor first, then the tone moves it: the dice note lists exactly these numbers (dice/note.js).
    const { index: floored, raised } = raiseToFloor(difficultyIndex(word), floor);
    const index = clamp(floored + toneStep(ctx), 0, 4);
    // (what raised it: the reader's own threat and conditions, else the floor the reply was offered with, which came from the last reply's danger)
    const why = floorWhy(member, { threat, now: ctx.time?.() ?? null, drained, physical: PHYSICAL.includes(found.stat) });
    const reasons = raised ? (own >= record.floor && why.length ? why : ['danger carried over from the last reply']) : [];
    const heard = said >= 0 ? said : threatHeard(slice, ctx.reply?.sid, record);
    const die = record.list[record.used ?? 0];
    const result = verdict({ die, bonus: found.bonus, dc: DIFFICULTIES[index].dc });

    const inDanger = threat >= 2 || labelOf(line, 'danger').toLowerCase() === 'yes';
    const stages = harmFor(result.band, inDanger);
    let paid = 'none';
    if (!member.companion) {
        paid = stages > 0 ? 'wound' : 'none';
        // The stored wounds is a counter: add the change, never write back a value computed from the clamped read.
        member.wounds += woundsAfter(member, stages) - woundsOf(member);
        // Success at a cost always costs: in danger the wound stage above; out of danger the skill's cost again, else a step of stamina.
        if (result.band === 'cost' && !inDanger) {
            if (found.skill?.cost && !spendCost(member, found.skill, cap)) paid = 'skill';
            else {
                const sp = poolWith(member, 'sp', cap);
                member.pools.sp.now = Math.max(0, sp.now - Math.ceil(sp.max / 4));
                paid = 'stamina';
            }
        }
    }
    // (the gear the roll used wears with the wounds, by the inventory's own rule; what it wore goes in the receipt)
    const worn = wearGear(ctx, member, { band: result.band, inDanger, stat: found.stat, skill: found.skill, wounded: stages > 0 && !member.companion });
    let rankUp = null;
    let practice = 0;
    if (found.skill) ({ gained: practice, rankUp } = addPractice(slice, ctx.reply?.sid, member, found.skill, 'try', rollPractice(result.band, index, heard)));
    record.used = (record.used ?? 0) + 1;
    record.hardest = Math.max(record.hardest ?? 0, index);
    if (said >= 0) record.threat = Math.max(record.threat ?? 0, said);
    const tail = `${DIFFICULTIES[floored].word}${raised ? ` (raised: ${reasons.join(', ')})` : ''}: ${BAND_WORD[result.band]}${rankUp ? `; ${found.skill.name} reaches ${rankUp}` : ''}${costPaid ? '; cost already paid' : ''}.`;
    return {
        summary: `${member.name} tries ${found.skill?.name ?? what}, ${tail}`, narrate: true,
        data: { member: member.id, target: what, die, bonus: found.bonus, total: result.total, difficulty: index, band: result.band, raised, ...(raised ? { why: reasons } : {}), paid, practice, rankUp, ...(costPaid ? { costPaid } : {}), ...(worn.length ? { worn } : {}) },
    };
}
