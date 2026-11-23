// `? try Who | skill or stat | difficulty`: the code reads the verdict from the reply's recorded die, the bonus and the difficulty.
import { DIFFICULTIES, difficultyIndex, floorIndex, raiseToFloor } from '../../rules/difficulty.js';
import { dropStages, harmFor } from '../../rules/harm.js';
import { practiceGain } from '../../rules/growth.js';
import { verdict } from '../../rules/roll.js';
import { PRACTICE_MAX, rankOf } from '../../words/ranks.js';
import { stageOf } from '../../words/pools.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { recordOf } from '../dice-source.js';
import { bonusFor } from '../bonus.js';
import { gearOf } from '../gear.js';
import { partsOf, labelOf } from '../line-read.js';
import { toneStep } from '../settings.js';
import { spendCost } from './pools.js';
import { target } from './target.js';

const BAND_WORD = { great: 'more than was asked', success: 'success', cost: 'success at a cost', failure: 'failure', bad: 'a bad failure' };
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
    const found = bonusFor(member, what, gearOf(ctx.query, member).cap);
    if (!found) ctx.fail('NOT_FOUND', `${member.name} has no skill or stat called ${what.slice(0, 40)}.`);
    const refused = found.skill ? spendCost(member, found.skill) : '';
    if (refused) ctx.fail('NOT_ENOUGH', refused);

    const said = THREAT_WORDS.indexOf(labelOf(line, 'threat').toLowerCase());
    const threat = said >= 0 ? said : record.threat ?? 0;
    const drained = stageOf(member.pools.sp.now, member.pools.sp.max, 'energy').index >= 3;
    const floor = Math.max(record.floor, floorIndex({ threat, conditions: member.conditions.length, drained, physical: PHYSICAL.includes(found.stat) }));
    const asked = clamp(difficultyIndex(word) + toneStep(ctx), 0, 4);
    const { index, raised } = raiseToFloor(asked, floor);
    const die = record.list[record.used ?? 0];
    const result = verdict({ die, bonus: found.bonus, dc: DIFFICULTIES[index].dc });

    const inDanger = threat >= 2 || labelOf(line, 'danger').toLowerCase() === 'yes';
    const { hp } = member.pools;
    if (!member.companion) hp.now = dropStages(hp.now, hp.max, harmFor(result.band, inDanger));
    if (result.band === 'cost' && !inDanger && found.skill) spendCost(member, found.skill);
    let rankUp = null;
    if (found.skill) {
        const before = rankOf(found.skill.practice).index;
        found.skill.practice = Math.min(PRACTICE_MAX, found.skill.practice + practiceGain(result.band, index));
        const after = rankOf(found.skill.practice);
        if (after.index > before) rankUp = after.name;
    }
    record.used = (record.used ?? 0) + 1;
    record.hardest = Math.max(record.hardest ?? 0, index);
    if (said >= 0) record.threat = Math.max(record.threat ?? 0, said);
    const tail = `${DIFFICULTIES[index].word}${raised ? ' (raised: the scene allows nothing easier)' : ''}: ${BAND_WORD[result.band]}${rankUp ? `; ${found.skill.name} reaches ${rankUp}` : ''}.`;
    return {
        summary: `${member.name} tries ${found.skill?.name ?? what}, ${tail}`, narrate: true,
        data: { member: member.id, target: what, die, bonus: found.bonus, total: result.total, difficulty: index, band: result.band, raised, rankUp },
    };
}
