// A name with "|" is printed with "/" and citable as printed; a cut two names share means neither.
import test from 'node:test';
import assert from 'node:assert/strict';

import { readEventLine } from '../../../modules/arc/plan/read-parts/event-line.js';
import { finder } from '../../../modules/arc/plan/read-parts/cite-match.js';
import { worldBriefText } from '../../../modules/arc/plan/prompt-parts/world-brief.js';
import { judgeContext } from '../../../modules/arc/judge/context.js';
import { rollPrompt } from '../../../modules/arc/judge/roll-prompt.js';
import { parseChanges } from '../../../modules/world/changes-parts/parse.js';
import { flat } from '../../../modules/arc/plan/shared.js';

const brief = { threads: [{ key: 'Gate | Quay', now: 'The gate | quay is shut.' }], toCome: ['Salt | Iron'], conditions: ['gate shut at North | South: closed'] };

test('model briefs print "/" for "|", and the printed name is cited through the reply parser', () => {
    const planner = worldBriefText(brief);
    assert.match(planner, /- Gate \/ Quay — The gate \/ quay is shut\./);
    assert.match(planner, /- Salt \/ Iron\n/);
    assert.match(planner, /- gate shut at North \/ South: closed/);
    assert.doesNotMatch(`${planner.slice(planner.indexOf('World events:'))}\n${judgeContext({ brief })}`, /Gate \| Quay|Salt \| Iron|North \| South/);
    assert.match(rollPrompt({ items: [{ title: 'Gate | Quay', summary: 'Shut | fast.', place: 'Town' }] }), /1: Gate \/ Quay — Shut \/ fast\. \| place: Town/);
    const op = parseChanges('+ event Closure — Ships wait | where: Town | because: Gate / Quay; Salt / Iron').ops[0];
    const out = readEventLine({ key: op.key, desc: op.fields.desc, given: { ...op.fields, ...op.extra }, world: { place: () => 'Town', causes: ['Gate | Quay', 'Salt | Iron'] } });
    assert.deepEqual(out.causes, ['Gate | Quay', 'Salt | Iron']);
});

test('two names with one 80-character cut: the whole name (with words after it) picks its own, the cut picks neither', () => {
    const stem = 'The long council of the harbour wardens meets again to settle the matter of tolls on';
    const [ferry, grain] = [`${stem} the ferry`, `${stem} the grain`];
    assert.equal(flat(ferry, 80), flat(grain, 80));
    for (const names of [[ferry, grain], [grain, ferry]]) {
        const find = finder(names);
        assert.equal(find(ferry), ferry);
        assert.equal(find(`${grain} — the wardens argue`), grain);
        assert.equal(find(flat(ferry, 80)), null);
        assert.equal(find(`${flat(ferry, 80)} — the wardens argue`), null);
        assert.equal(find(`${stem} the salt`), null, 'an unknown ending is not either');
    }
    assert.equal(finder([ferry])(flat(ferry, 80)), ferry, 'a cut only one name has still reads');
    assert.equal(finder(['The long council', ferry])(`${flat(ferry, 80)} — they argue`), ferry, 'the longer match wins over a short whole name');
});

test('two names that print alike once "|" reads "/": the printed form cites neither', () => {
    for (const names of [['Gate | Quay', 'Gate / Quay'], ['Gate / Quay', 'Gate | Quay']]) {
        const find = finder(names);
        assert.equal(find('Gate / Quay'), null);
        assert.equal(find('Gate / Quay — The gate is shut.'), null);
        const out = readEventLine({ key: 'Closure', desc: 'Ships wait', given: { where: 'Town', because: 'Gate / Quay' }, world: { place: () => 'Town', causes: names } });
        assert.match(out.refused, /cites no cause/);
    }
    assert.equal(finder(['Gate | Quay', 'Gate | Quay'])('Gate / Quay'), 'Gate | Quay', 'one name listed twice is one name');
});

test('long names that print alike share no cut; a title and its own id still read', () => {
    const stem = 'The long council of the harbour wardens meets again to settle the matter of tolls on';
    const names = [`${stem} the ferry | north`, `${stem} the ferry / north`];
    for (const list of [names, [...names].reverse()]) {
        assert.equal(finder(list)(flat(names[0], 80)), null);
        assert.equal(finder(list)(`${flat(names[0], 80)} — they argue`), null);
    }
    assert.notEqual(finder(['Gate | Quay', 'gate-quay'])('Gate / Quay'), null, 'the judge looks an event up by title and id');
});
